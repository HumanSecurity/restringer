import {parseCode} from 'flast';
import {Sandbox} from '../utils/sandbox.js';
import {evalInVm} from '../utils/evalInVm.js';
import {createOrderedSrc} from '../utils/createOrderedSrc.js';
import {getDeclarationWithContext} from '../utils/getDeclarationWithContext.js';

/**
 * Identifies CallExpression nodes for eval() with non-literal arguments that can be resolved.
 * Matches eval calls where the argument is an expression (function call, array access, etc.)
 * rather than a direct string literal.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter for candidates
 * @return {ASTNode[]} Array of eval CallExpression nodes ready for resolution
 */
export function resolveEvalCallsOnNonLiteralsMatch(arb, candidateFilter = () => true) {
	const matches = [];
	const relevantNodes = arb.ast[0].typeMap.CallExpression;
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		// Only process eval calls with exactly one non-literal argument
		if (n.callee.name === 'eval' &&
			n.arguments.length === 1 &&
			n.arguments[0].type !== 'Literal' &&
			candidateFilter(n)) {
			matches.push(n);
		}
	}
	return matches;
}

/**
 * Transforms matched eval CallExpression nodes by evaluating their non-literal arguments
 * and replacing the eval calls with the resolved content. Handles context dependencies
 * and attempts to parse the result as JavaScript code.
 * @param {Arborist} arb - The Arborist instance
 * @param {ASTNode[]} matches - Array of eval CallExpression nodes to transform
 * @return {Arborist} The updated Arborist instance
 */
export function resolveEvalCallsOnNonLiteralsTransform(arb, matches) {
	if (!matches.length) return arb;
	
	const sharedSb = new Sandbox();
	
	for (let i = 0; i < matches.length; i++) {
		const n = matches[i];
		
		// Gather context nodes that might be referenced by the eval argument
		const contextNodes = getDeclarationWithContext(n, true);
		
		// Remove any nodes that are part of the eval expression itself to avoid circular references
		const possiblyRedundantNodes = [n, n?.parentNode, n?.parentNode?.parentNode];
		for (let j = 0; j < possiblyRedundantNodes.length; j++) {
			const redundantNode = possiblyRedundantNodes[j];
			const index = contextNodes.indexOf(redundantNode);
			if (index !== -1) {
				contextNodes.splice(index, 1);
			}
		}
		
		// Build evaluation context: dependencies + argument assignment + return value
		const context = contextNodes.length ? createOrderedSrc(contextNodes) : '';
		const src = `${context}\n;${createOrderedSrc([n.arguments[0]])}\n;`;
		
		const newNode = evalInVm(src, sharedSb);
		const targetNode = n.parentNode.type === 'ExpressionStatement' ? n.parentNode : n;
		let replacementNode = newNode;
		
		// If result is a literal string, try to parse it as JavaScript code
		try {
			if (newNode.type === 'Literal') {
				try {
					replacementNode = parseCode(newNode.value);
				} catch {
					// Handle malformed code by adding newlines after closing brackets
					// (except when part of regex patterns like "/}/")
					replacementNode = parseCode(newNode.value.replace(/([)}])(?!\/)/g, '$1\n'));
				} finally {
					// Fallback to unparsed literal if parsing results in empty program
					if (!replacementNode.body.length) replacementNode = newNode;
				}
			}
		} catch {
			// If all parsing attempts fail, keep the original evaluated result
		}
		
		if (replacementNode !== evalInVm.BAD_VALUE) {
			arb.markNode(targetNode, replacementNode);
		}
	}
	return arb;
}

/**
 * Resolves eval() calls with non-literal arguments by evaluating the arguments
 * and replacing the eval calls with their resolved content. Handles context dependencies
 * and attempts to parse string results as JavaScript code.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter function for candidates
 * @return {Arborist} The updated Arborist instance
 */
export default function resolveEvalCallsOnNonLiterals(arb, candidateFilter = () => true) {
	const matches = resolveEvalCallsOnNonLiteralsMatch(arb, candidateFilter);
	return resolveEvalCallsOnNonLiteralsTransform(arb, matches);
}