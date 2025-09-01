// Static arrays to avoid recreation overhead
const LOGICAL_OPERATORS = ['&&', '||'];
const TRUTHY_NODE_TYPES = ['ArrayExpression', 'ObjectExpression', 'FunctionExpression', 'ArrowFunctionExpression'];

/**
 * Evaluates the truthiness of an AST node according to JavaScript rules.
 * 
 * In JavaScript, these are always truthy:
 * - Arrays (even empty: [])
 * - Objects (even empty: {})  
 * - Functions
 * - Regular expressions
 * 
 * For literals, these values are falsy: false, 0, -0, 0n, "", null, undefined, NaN
 * All other literal values are truthy.
 * 
 * @param {ASTNode} node - The AST node to evaluate
 * @return {boolean|null} True if truthy, false if falsy, null if indeterminate
 */
function isNodeTruthy(node) {
	// Arrays, objects, functions, and regex are always truthy
	if (TRUTHY_NODE_TYPES.includes(node.type) || (node.type === 'Literal' && node.regex)) {
		return true;
	}
	
	// For literal values, evaluate using JavaScript truthiness rules
	if (node.type === 'Literal') {
		// JavaScript falsy values: false, 0, -0, 0n, "", null, undefined, NaN
		return Boolean(node.value);
	}
	
	// For other node types, we can't determine truthiness statically
	return null;
}

/**
 * Determines the replacement node for a redundant logical expression.
 * 
 * Uses JavaScript's short-circuit evaluation rules. See truth table below:
 * 
 * AND (&&) operator - returns first falsy value or last value:
 * | Left   | Right  | Result |
 * |--------|--------|--------|
 * | truthy | any    | right  |
 * | falsy  | any    | left   |
 * 
 * OR (||) operator - returns first truthy value or last value:
 * | Left   | Right  | Result |
 * |--------|--------|--------|
 * | truthy | any    | left   |
 * | falsy  | any    | right  |
 * 
 * @param {ASTNode} logicalExpr - The LogicalExpression node to simplify
 * @return {ASTNode|null} The replacement node or null if no simplification possible
 */
function getSimplifiedLogicalExpression(logicalExpr) {
	const {left, right, operator} = logicalExpr;
	
	// Check if left operand has deterministic truthiness
	const leftTruthiness = isNodeTruthy(left);
	if (leftTruthiness !== null) {
		if (operator === '&&') {
			// Apply AND truth table: truthy left → right, falsy left → left
			return leftTruthiness ? right : left;
		} else if (operator === '||') {
			// Apply OR truth table: truthy left → left, falsy left → right
			return leftTruthiness ? left : right;
		}
	}
	
	// Check if right operand has deterministic truthiness
	const rightTruthiness = isNodeTruthy(right);
	if (rightTruthiness !== null) {
		if (operator === '&&') {
			// Apply AND truth table: truthy right → left, falsy right → right
			return rightTruthiness ? left : right;
		} else if (operator === '||') {
			// Apply OR truth table: truthy right → right, falsy right → left
			return rightTruthiness ? right : left;
		}
	}
	
	return null; // No simplification possible
}

/**
 * Finds IfStatement nodes with redundant logical expressions that can be simplified.
 * 
 * Identifies if statements where the test condition is a logical expression (&&, ||)
 * with at least one operand that has deterministic truthiness, allowing the expression
 * to be simplified based on JavaScript's short-circuit evaluation rules.
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {ASTNode[]} Array of IfStatement nodes that can be simplified
 */
export function resolveRedundantLogicalExpressionsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.IfStatement;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Must have a LogicalExpression with supported operator and pass candidate filter
		if (n.test?.type !== 'LogicalExpression' || 
			!LOGICAL_OPERATORS.includes(n.test.operator) ||
			!candidateFilter(n)) {
			continue;
		}
		
		// Check if this logical expression can be simplified
		if (getSimplifiedLogicalExpression(n.test) !== null) {
			matches.push(n);
		}
	}
	
	return matches;
}

/**
 * Transforms an IfStatement by simplifying its redundant logical expression.
 * 
 * Replaces the test condition with the simplified expression determined by
 * JavaScript's logical operator short-circuit evaluation rules.
 * 
 * @param {Arborist} arb - The Arborist instance to mark nodes for transformation
 * @param {ASTNode} n - The IfStatement node to transform
 * @return {Arborist} The Arborist instance for chaining
 */
export function resolveRedundantLogicalExpressionsTransform(arb, n) {
	const simplifiedExpr = getSimplifiedLogicalExpression(n.test);
	
	if (simplifiedExpr !== null) {
		arb.markNode(n.test, simplifiedExpr);
	}
	
	return arb;
}

/**
 * Remove redundant logical expressions which will always resolve in the same way.
 * 
 * This function simplifies logical expressions in if statement conditions where
 * one operand has deterministic truthiness, making the result predictable based on
 * JavaScript's short-circuit evaluation rules.
 * 
 * Handles literals, arrays, objects, functions, and regular expressions:
 * - `if (false && expr)` becomes `if (false)` (AND with falsy literal)
 * - `if ([] || expr)` becomes `if ([])` (OR with truthy array)
 * - `if (expr && {})` becomes `if (expr)` (AND with truthy object)
 * - `if (function() {} || expr)` becomes `if (function() {})` (OR with truthy function)
 * - `if (true && expr)` becomes `if (expr)` (AND with truthy literal)
 * - `if (0 || expr)` becomes `if (expr)` (OR with falsy literal)
 * 
 * ⚠️  EDGE CASES WHERE THIS OPTIMIZATION COULD BREAK CODE:
 * 
 * 1. Getter side effects: Properties with getters that have side effects
 *    - `if (obj.prop && true)` → `if (obj.prop)` may change when getter is called
 *    - `if (false && obj.sideEffectProp)` → `if (false)` prevents getter execution
 * 
 * 2. Function call side effects: When expr contains function calls with side effects
 *    - `if (true && doSomething())` → `if (doSomething())` (still executes)
 *    - `if (false && doSomething())` → `if (false)` (skips execution entirely)
 * 
 * 3. Proxy object traps: Objects wrapped in Proxy with get/has trap side effects
 *    - Accessing properties can trigger custom proxy handlers
 * 
 * 4. Type coercion side effects: Objects with custom valueOf/toString methods
 *    - `if (customObj && true)` might trigger valueOf() during evaluation
 * 
 * 5. Reactive/Observable systems: Frameworks like Vue, MobX, or RxJS
 *    - Property access can trigger reactivity or subscription side effects
 * 
 * 6. Temporal dead zone: Variables accessed before declaration in let/const
 *    - May throw ReferenceError that gets prevented by short-circuiting
 * 
 * This optimization is SAFE for obfuscated code analysis because:
 * - Obfuscated code typically avoids complex side effects for reliability
 * - We only transform when operands are deterministically truthy/falsy
 * - The logic outcome remains semantically equivalent for pure expressions
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply to candidates
 * @return {Arborist} The Arborist instance for chaining
 */
export default function resolveRedundantLogicalExpressions(arb, candidateFilter = () => true) {
	const matches = resolveRedundantLogicalExpressionsMatch(arb, candidateFilter);
	
	for (let i = 0; i < matches.length; i++) {
		arb = resolveRedundantLogicalExpressionsTransform(arb, matches[i]);
	}
	
	return arb;
}