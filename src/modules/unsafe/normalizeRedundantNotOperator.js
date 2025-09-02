import {BAD_VALUE} from '../config.js';
import {Sandbox} from '../utils/sandbox.js';
import {evalInVm} from '../utils/evalInVm.js';
import {canUnaryExpressionBeResolved} from '../utils/canUnaryExpressionBeResolved.js';

const RESOLVABLE_ARGUMENT_TYPES = ['Literal', 'ArrayExpression', 'ObjectExpression', 'UnaryExpression'];

/**
 * Finds UnaryExpression nodes with redundant NOT operators that can be normalized.
 * 
 * Identifies NOT operators (!expr) where the expression can be safely evaluated
 * to determine the boolean result. This includes NOT operations on:
 * - Literals (numbers, strings, booleans, null)
 * - Array expressions (empty or with literal elements)
 * - Object expressions (empty or with literal properties)
 * - Nested unary expressions
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {ASTNode[]} Array of UnaryExpression nodes with redundant NOT operators
 */
export function normalizeRedundantNotOperatorMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.UnaryExpression;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		if (n.operator === '!' &&
			RESOLVABLE_ARGUMENT_TYPES.includes(n.argument.type) &&
			canUnaryExpressionBeResolved(n.argument) &&
			candidateFilter(n)) {
			matches.push(n);
		}
	}
	
	return matches;
}

/**
 * Transforms a redundant NOT operator by evaluating it to its boolean result.
 * 
 * Evaluates the NOT expression in a sandbox environment and replaces it with
 * the computed boolean literal. This normalizes expressions like `!true` to `false`,
 * `!0` to `true`, `![]` to `false`, etc.
 * 
 * @param {Arborist} arb - The Arborist instance to mark nodes for transformation
 * @param {ASTNode} n - The UnaryExpression node with redundant NOT operator
 * @param {Sandbox} sharedSandbox - Shared sandbox instance for evaluation
 * @return {Arborist} The Arborist instance for chaining
 */
export function normalizeRedundantNotOperatorTransform(arb, n, sharedSandbox) {
	const replacementNode = evalInVm(n.src, sharedSandbox);
	
	if (replacementNode !== BAD_VALUE) {
		arb.markNode(n, replacementNode);
	}
	
	return arb;
}

/**
 * Replace redundant NOT operators with their actual boolean values.
 * 
 * This optimization evaluates NOT expressions that can be safely computed at
 * transformation time, replacing them with boolean literals. This includes
 * expressions like `!true`, `!0`, `![]`, `!{}`, etc.
 * 
 * The evaluation is performed in a secure sandbox environment to prevent
 * code execution side effects.
 * 
 * Transforms:
 * ```javascript
 * !true || !false || !0 || !1
 * ```
 * 
 * Into:
 * ```javascript
 * false || true || true || false
 * ```
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply to candidates
 * @return {Arborist} The Arborist instance for chaining
 */
export default function normalizeRedundantNotOperator(arb, candidateFilter = () => true) {
	const matches = normalizeRedundantNotOperatorMatch(arb, candidateFilter);
	
	if (matches.length === 0) {
		return arb;
	}
	
	let sharedSandbox = new Sandbox();
	
	for (let i = 0; i < matches.length; i++) {
		arb = normalizeRedundantNotOperatorTransform(arb, matches[i], sharedSandbox);
	}
	
	return arb;
}