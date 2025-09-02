import {BAD_VALUE} from '../config.js';
import {Sandbox} from '../utils/sandbox.js';
import {evalInVm} from '../utils/evalInVm.js';
import {doesBinaryExpressionContainOnlyLiterals} from '../utils/doesBinaryExpressionContainOnlyLiterals.js';

/**
 * Identifies BinaryExpression nodes that contain only literal values and can be safely evaluated.
 * Filters candidates to those with literal operands that are suitable for sandbox evaluation.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Filter function to apply on candidates
 * @return {ASTNode[]} Array of BinaryExpression nodes ready for evaluation
 */
export function resolveDefiniteBinaryExpressionsMatch(arb, candidateFilter = () => true) {
	const matches = [];
	const relevantNodes = arb.ast[0].typeMap.BinaryExpression;
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		if (doesBinaryExpressionContainOnlyLiterals(n) && candidateFilter(n)) {
			matches.push(n);
		}
	}
	return matches;
}

/**
 * Transforms matched BinaryExpression nodes by evaluating them in a sandbox and replacing
 * them with their computed literal values.
 * @param {Arborist} arb - The Arborist instance
 * @param {ASTNode[]} matches - Array of BinaryExpression nodes to transform
 * @return {Arborist} The updated Arborist instance
 */
export function resolveDefiniteBinaryExpressionsTransform(arb, matches) {
	if (!matches.length) return arb;
	
	const sharedSb = new Sandbox();
	
	for (let i = 0; i < matches.length; i++) {
		const n = matches[i];
		const replacementNode = evalInVm(n.src, sharedSb);
		
		if (replacementNode !== BAD_VALUE) {
			try {
				// Handle negative number edge case: when evaluating expressions like '5 - 10',
				// the result may be a UnaryExpression with '-5' instead of a Literal with value -5.
				// This ensures numeric operations remain as proper numeric literals.
				if (replacementNode.type === 'UnaryExpression' && 
					typeof n?.left?.value === 'number' && 
					typeof n?.right?.value === 'number') {
					const v = parseInt(replacementNode.argument.raw);
					replacementNode.argument.value = v;
					replacementNode.argument.raw = `${v}`;
				}
				arb.markNode(n, replacementNode);
			} catch (e) {
				logger.debug(e.message);
			}
		}
	}
	return arb;
}

/**
 * Resolves BinaryExpression nodes that contain only literal values by evaluating them
 * in a sandbox and replacing them with their computed results.
 * Handles expressions like: 5 * 3 → 15, '2' + 2 → '22', 10 - 15 → -5
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter function for candidates
 * @return {Arborist} The updated Arborist instance
 */
export default function resolveDefiniteBinaryExpressions(arb, candidateFilter = () => true) {
	const matches = resolveDefiniteBinaryExpressionsMatch(arb, candidateFilter);
	return resolveDefiniteBinaryExpressionsTransform(arb, matches);
}