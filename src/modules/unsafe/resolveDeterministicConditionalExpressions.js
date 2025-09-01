import {Sandbox} from '../utils/sandbox.js';
import {evalInVm} from '../utils/evalInVm.js';

/**
 * Identifies ConditionalExpression nodes with literal test values that can be deterministically resolved.
 * Matches ternary expressions like 'a' ? x : y, 0 ? x : y, true ? x : y where the test is a literal.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter for candidates
 * @return {ASTNode[]} Array of ConditionalExpression nodes ready for evaluation
 */
export function resolveDeterministicConditionalExpressionsMatch(arb, candidateFilter = () => true) {
	const matches = [];
	const relevantNodes = arb.ast[0].typeMap.ConditionalExpression;
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		// Only resolve conditionals where test is a literal (deterministic)
		if (n.test.type === 'Literal' && candidateFilter(n)) {
			matches.push(n);
		}
	}
	return matches;
}

/**
 * Transforms matched ConditionalExpression nodes by evaluating their literal test values
 * and replacing the entire conditional with either the consequent or alternate branch.
 * @param {Arborist} arb - The Arborist instance
 * @param {ASTNode[]} matches - Array of ConditionalExpression nodes to transform
 * @return {Arborist} The updated Arborist instance
 */
export function resolveDeterministicConditionalExpressionsTransform(arb, matches) {
	if (!matches.length) return arb;
	
	const sharedSb = new Sandbox();
	
	for (let i = 0; i < matches.length; i++) {
		const n = matches[i];
		// Evaluate the literal test value to determine truthiness
		const replacementNode = evalInVm(`Boolean(${n.test.src});`, sharedSb);
		
		if (replacementNode.type === 'Literal') {
			// Replace conditional with consequent if truthy, alternate if falsy
			arb.markNode(n, replacementNode.value ? n.consequent : n.alternate);
		}
	}
	return arb;
}

/**
 * Resolves ConditionalExpression nodes with literal test values to their deterministic outcomes.
 * Transforms expressions like 'a' ? do_a() : do_b() → do_a() since 'a' is truthy.
 * Only processes conditionals where the test is a literal for safe evaluation.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter function for candidates
 * @return {Arborist} The updated Arborist instance
 */
export default function resolveDeterministicConditionalExpressions(arb, candidateFilter = () => true) {
	const matches = resolveDeterministicConditionalExpressionsMatch(arb, candidateFilter);
	return resolveDeterministicConditionalExpressionsTransform(arb, matches);
}