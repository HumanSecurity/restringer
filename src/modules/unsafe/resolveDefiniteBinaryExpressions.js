import {logger} from 'flast';
import {Sandbox} from '../utils/sandbox.js';
import {evalInVm} from '../utils/evalInVm.js';

/**
 * Recursively determines if an AST expression contains only literal values.
 * This is useful for identifying expressions that can be safely evaluated at compile time.
 * Supports binary expressions, unary expressions, logical expressions, conditional expressions,
 * sequence expressions, update expressions, and parenthesized expressions.
 *
 * @param {ASTNode} expression - The AST node to check for literal-only content
 * @return {boolean} True if the expression contains only literals; false otherwise
 *
 * @example
 * // Returns true
 * doesBinaryExpressionContainOnlyLiterals(parseCode('1 + 2').body[0].expression);
 * doesBinaryExpressionContainOnlyLiterals(parseCode('!true').body[0].expression);
 * doesBinaryExpressionContainOnlyLiterals(parseCode('true ? 1 : 2').body[0].expression);
 *
 * // Returns false  
 * doesBinaryExpressionContainOnlyLiterals(parseCode('1 + x').body[0].expression);
 * doesBinaryExpressionContainOnlyLiterals(parseCode('func()').body[0].expression);
 */
export function doesBinaryExpressionContainOnlyLiterals(expression) {
	// Early return for null/undefined to prevent errors
	if (!expression || !expression.type) {
		return false;
	}

	switch (expression.type) {
		case 'BinaryExpression':
			// Both operands must contain only literals
			return doesBinaryExpressionContainOnlyLiterals(expression.left) &&
				doesBinaryExpressionContainOnlyLiterals(expression.right);
			
		case 'UnaryExpression':
			// Argument must contain only literals (e.g., !true, -5, +"hello")
			return doesBinaryExpressionContainOnlyLiterals(expression.argument);
			
		case 'UpdateExpression':
			// UpdateExpression requires lvalue (variable/property), never a literal
			// Valid: ++x, invalid: ++5 (flast won't generate UpdateExpression for invalid syntax)
			return false;
			
		case 'LogicalExpression':
			// Both operands must contain only literals (e.g., true && false, 1 || 2)
			return doesBinaryExpressionContainOnlyLiterals(expression.left) &&
				doesBinaryExpressionContainOnlyLiterals(expression.right);
			
		case 'ConditionalExpression':
			// All three parts must contain only literals (e.g., true ? 1 : 2)
			return doesBinaryExpressionContainOnlyLiterals(expression.test) &&
				doesBinaryExpressionContainOnlyLiterals(expression.consequent) &&
				doesBinaryExpressionContainOnlyLiterals(expression.alternate);
			
		case 'SequenceExpression':
			// All expressions in sequence must contain only literals (e.g., (1, 2, 3))
			for (let i = 0; i < expression.expressions.length; i++) {
				if (!doesBinaryExpressionContainOnlyLiterals(expression.expressions[i])) {
					return false;
				}
			}
			return true;
			
		case 'Literal':
			// Base case: literals are always literal-only
			return true;
			
		default:
			// Any other node type (Identifier, CallExpression, etc.) is not literal-only
			return false;
	}
}

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
		
		if (replacementNode !== evalInVm.BAD_VALUE) {
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
 * @param {Function} [candidateFilter] - Optional filter function for candidates
 * @return {Arborist} The updated Arborist instance
 */
export default function resolveDefiniteBinaryExpressions(arb, candidateFilter = () => true) {
	const matches = resolveDefiniteBinaryExpressionsMatch(arb, candidateFilter);
	return resolveDefiniteBinaryExpressionsTransform(arb, matches);
}