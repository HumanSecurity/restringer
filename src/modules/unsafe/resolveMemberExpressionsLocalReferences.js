import {SKIP_PROPERTIES} from '../config.js';
import {evalInVm} from '../utils/evalInVm.js';
import {createOrderedSrc} from '../utils/createOrderedSrc.js';
import {areReferencesModified} from '../utils/areReferencesModified.js';
import {getDeclarationWithContext} from '../utils/getDeclarationWithContext.js';
import {getMainDeclaredObjectOfMemberExpression} from '../utils/getMainDeclaredObjectOfMemberExpression.js';

const VALID_PROPERTY_TYPES = ['Identifier', 'Literal'];

/**
 * Identifies member expressions that can be resolved to their local reference values.
 * Only processes member expressions with literal properties or identifiers, excluding
 * assignment targets, call expression callees, function parameters, and modified references.
 * @param {Arborist} arb - Arborist instance
 * @param {Function} candidateFilter - Optional filter function for additional candidate filtering
 * @return {ASTNode[]} Array of member expression nodes that can be resolved
 */
export function resolveMemberExpressionsLocalReferencesMatch(arb, candidateFilter = () => true) {
	const matches = [];
	const relevantNodes = arb.ast[0].typeMap.MemberExpression;

	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		if (VALID_PROPERTY_TYPES.includes(n.property.type) &&
		!SKIP_PROPERTIES.includes(n.property?.name || n.property?.value) &&
		!(n.parentKey === 'left' && n.parentNode.type === 'AssignmentExpression') &&
		candidateFilter(n)) {
			// Skip member expressions used as call expression callees
			if (n.parentNode.type === 'CallExpression' && n.parentKey === 'callee') continue;
			
			// Find the main declared identifier for the member expression being processed
			// E.g. processing 'c.d' in 'a.b[c.d]' -> mainObj is 'c' (declared identifier for c.d)
			// E.g. processing 'data.user.name' in 'const data = {...}; data.user.name' -> mainObj is 'data'
			const mainObj = getMainDeclaredObjectOfMemberExpression(n);
			if (mainObj?.declNode) {
				// Skip if identifier is assignment target
				// E.g. const obj = {a: 1}; obj.a = 2; -> mainObj is 'obj', skip obj.a (obj on left side)
				if (mainObj.parentNode.parentNode.type === 'AssignmentExpression' &&
					mainObj.parentNode.parentKey === 'left') continue;
				
				const declNode = mainObj.declNode;
				// Skip function parameters as they may have dynamic values
				// E.g. function test(arr) { return arr[0]; } -> mainObj is 'arr', skip arr[0] (arr is parameter)
				if (/Function/.test(declNode.parentNode.type) &&
					(declNode.parentNode.params || []).find(p => p === declNode)) continue;
				
				const prop = n.property;
				// Skip if property identifier has modified references (not safe to resolve)
				// E.g. let idx = 0; idx = 1; const val = arr[idx]; -> mainObj is 'arr', prop is 'idx', skip because idx modified
				if (prop.type === 'Identifier' && prop.declNode?.references && 
					areReferencesModified(arb.ast, prop.declNode.references)) continue;
				
				matches.push(n);
			}
		}
	}
	
	return matches;
}

/**
 * Transforms member expressions by resolving them to their evaluated values using local context.
 * Uses sandbox evaluation to safely determine replacement values and skips empty results.
 * @param {Arborist} arb - Arborist instance  
 * @param {ASTNode[]} matches - Array of member expression nodes to transform
 * @return {Arborist} The modified Arborist instance
 */
export function resolveMemberExpressionsLocalReferencesTransform(arb, matches) {
	if (!matches.length) return arb;

	for (let i = 0; i < matches.length; i++) {
		const n = matches[i];
		const relevantIdentifier = getMainDeclaredObjectOfMemberExpression(n);
		const context = createOrderedSrc(getDeclarationWithContext(relevantIdentifier.declNode.parentNode));
		
		if (context) {
			const src = `${context}\n${n.src}`;
			const replacementNode = evalInVm(src);
			if (replacementNode !== evalInVm.BAD_VALUE) {
				// Check if replacement would result in empty/meaningless values
				let isEmptyReplacement = false;
				switch (replacementNode.type) {
					case 'ArrayExpression':
						if (!replacementNode.elements.length) isEmptyReplacement = true;
						break;
					case 'ObjectExpression':
						if (!replacementNode.properties.length) isEmptyReplacement = true;
						break;
					case 'Literal':
						if (!String(replacementNode.value).length || replacementNode.raw === 'null') {
							isEmptyReplacement = true;
						}
						break;
					case 'Identifier':
						if (replacementNode.name === 'undefined') isEmptyReplacement = true;
						break;
				}
				if (!isEmptyReplacement) {
					arb.markNode(n, replacementNode);
				}
			}
		}
	}
	
	return arb;
}

/**
 * Resolve member expressions to the value they stand for, if they're defined in the script.
 * E.g.
 * const a = [1, 2, 3];
 * const b = a[2]; // <-- will be resolved to 3
 * const c = 0;
 * const d = a[c]; // <-- will be resolved to 1
 * ---
 * const a = {hello: 'world'};
 * const b = a['hello']; // <-- will be resolved to 'world'
 * @param {Arborist} arb - Arborist instance
 * @param {Function} candidateFilter - Optional filter function for additional candidate filtering
 * @return {Arborist} The modified Arborist instance
 */
export default function resolveMemberExpressionsLocalReferences(arb, candidateFilter = () => true) {
	const matches = resolveMemberExpressionsLocalReferencesMatch(arb, candidateFilter);
	return resolveMemberExpressionsLocalReferencesTransform(arb, matches);
}