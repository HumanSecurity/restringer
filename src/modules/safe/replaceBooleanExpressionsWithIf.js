// Logical operators that can be converted to if statements
const LOGICAL_OPERATORS = ['&&', '||'];

/**
 * Find all expression statements containing logical expressions that can be converted to if statements.
 * 
 * Identifies expression statements where the expression is a logical operation (&&, ||)
 * that can be converted from short-circuit evaluation to explicit if statements.
 * 
 * @param {Arborist} arb
 * @param {Function} [candidateFilter] a filter to apply on the candidates list. Defaults to true.
 * @return {ASTNode[]} Array of expression statement nodes with logical expressions
 */
export function replaceBooleanExpressionsWithIfMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.ExpressionStatement;
	const matchingNodes = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		// Check if the expression statement contains a logical expression with && or ||
		if (n.expression?.type === 'LogicalExpression' &&
			LOGICAL_OPERATORS.includes(n.expression.operator) && 
			candidateFilter(n)) {
			matchingNodes.push(n);
		}
	}
	return matchingNodes;
}

/**
 * Transform a logical expression into an if statement.
 * 
 * Converts logical expressions using short-circuit evaluation into explicit if statements:
 * - For &&: if (left) { right; } 
 * - For ||: if (!left) { right; } (inverted logic)
 * 
 * The transformation preserves the original semantics where:
 * - && only executes right side if left is truthy
 * - || only executes right side if left is falsy
 * 
 * @param {Arborist} arb
 * @param {Object} expressionStatementNode The expression statement node to transform
 * @return {Arborist}
 */
export function replaceBooleanExpressionsWithIfTransform(arb, expressionStatementNode) {
	const logicalExpr = expressionStatementNode.expression;
	
	// For ||, we need to invert the test condition since || executes right side when left is falsy
	const testExpression = logicalExpr.operator === '||' 
		? {
			type: 'UnaryExpression',
			operator: '!',
			argument: logicalExpr.left,
		}
		: logicalExpr.left;
	
	// Create the if statement with the right operand as the consequent
	const ifStatement = {
		type: 'IfStatement',
		test: testExpression,
		consequent: {
			type: 'BlockStatement',
			body: [{
				type: 'ExpressionStatement',
				expression: logicalExpr.right
			}]
		},
	};
	
	arb.markNode(expressionStatementNode, ifStatement);
	return arb;
}

/**
 * Replace logical expressions with equivalent if statements for better readability.
 * 
 * This module converts short-circuit logical expressions into explicit if statements,
 * making the control flow more obvious and easier to understand.
 * 
 * Transformations:
 *   x && y();           →  if (x) { y(); }
 *   x || y();           →  if (!x) { y(); }
 *   a && b && c();      →  if (a && b) { c(); }
 *   a || b || c();      →  if (!(a || b)) { c(); }
 * 
 * Algorithm:
 * 1. Find expression statements containing logical expressions (&& or ||)
 * 2. Extract the rightmost operand as the consequent action
 * 3. Use the left operand(s) as the test condition
 * 4. For ||, invert the test condition to preserve semantics
 * 5. Wrap the consequent in a block statement for proper syntax
 * 
 * Note: This transformation maintains the original short-circuit evaluation semantics
 * where && executes the right side only if left is truthy, and || executes the right
 * side only if left is falsy.
 * 
 * @param {Arborist} arb
 * @param {Function} [candidateFilter] a filter to apply on the candidates list. Defaults to true.
 * @return {Arborist}
 */
export default function replaceBooleanExpressionsWithIf(arb, candidateFilter = () => true) {
	const matchingNodes = replaceBooleanExpressionsWithIfMatch(arb, candidateFilter);
	
	for (let i = 0; i < matchingNodes.length; i++) {
		arb = replaceBooleanExpressionsWithIfTransform(arb, matchingNodes[i]);
	}
	
	return arb;
}