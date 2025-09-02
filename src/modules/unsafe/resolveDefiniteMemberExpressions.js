import {BAD_VALUE} from '../config.js';
import {Sandbox} from '../utils/sandbox.js';
import {evalInVm} from '../utils/evalInVm.js';

const VALID_OBJECT_TYPES = ['ArrayExpression', 'Literal'];

/**
 * Identifies MemberExpression nodes that can be safely resolved to literal values.
 * Matches expressions like '123'[0], 'hello'.length, [1,2,3][0] that access
 * literal properties of literal objects/arrays.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter for candidates
 * @return {ASTNode[]} Array of MemberExpression nodes ready for evaluation
 */
export function resolveDefiniteMemberExpressionsMatch(arb, candidateFilter = () => true) {
	const matches = [];
	const relevantNodes = arb.ast[0].typeMap.MemberExpression;
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Prevent unsafe transformations that could break semantics
		if (n.parentNode.type === 'UpdateExpression') {
			// Prevent replacing (++[[]][0]) with (++1) which changes semantics
			continue;
		}
		
		if (n.parentKey === 'callee') {
			// Prevent replacing obj.method() with undefined() calls
			continue;
		}
		
		// Property must be a literal or non-computed identifier (safe to evaluate)
		const hasValidProperty = n.property.type === 'Literal' || 
			(n.property.name && !n.computed);
		if (!hasValidProperty) continue;
		
		// Object must be a literal or array expression (deterministic)
		if (!VALID_OBJECT_TYPES.includes(n.object.type)) continue;
		
		// Object must have content to access (length or elements)
		if (!(n.object?.value?.length || n.object?.elements?.length)) continue;
		
		if (candidateFilter(n)) {
			matches.push(n);
		}
	}
	return matches;
}

/**
 * Transforms matched MemberExpression nodes by evaluating them in a sandbox
 * and replacing them with their computed literal values.
 * @param {Arborist} arb - The Arborist instance
 * @param {ASTNode[]} matches - Array of MemberExpression nodes to transform
 * @return {Arborist} The updated Arborist instance
 */
export function resolveDefiniteMemberExpressionsTransform(arb, matches) {
	if (!matches.length) return arb;
	
	const sharedSb = new Sandbox();
	
	for (let i = 0; i < matches.length; i++) {
		const n = matches[i];
		const replacementNode = evalInVm(n.src, sharedSb);
		
		if (replacementNode !== BAD_VALUE) {
			arb.markNode(n, replacementNode);
		}
	}
	return arb;
}

/**
 * Resolves MemberExpression nodes that access literal properties of literal objects/arrays.
 * Transforms expressions like '123'[0] → '1', 'hello'.length → 5, [1,2,3][0] → 1
 * Only processes safe expressions that won't change program semantics.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter function for candidates
 * @return {Arborist} The updated Arborist instance
 */
export default function resolveDefiniteMemberExpressions(arb, candidateFilter = () => true) {
	const matches = resolveDefiniteMemberExpressionsMatch(arb, candidateFilter);
	return resolveDefiniteMemberExpressionsTransform(arb, matches);
}