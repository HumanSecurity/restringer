/**
 * Extracts the function name from a CallExpression's callee for frequency counting and sorting.
 * Only returns names for direct function calls; returns empty string for method calls on literals
 * and complex expressions to avoid counting collisions.
 *
 * Resolution strategy:
 * - Direct function calls: returns function name (e.g., 'func' from func())
 * - Variable method calls: returns variable name (e.g., 'obj' from obj.method())
 * - Literal method calls: returns empty string (e.g., '' from 'str'.split())
 * - Complex expressions: returns empty string (e.g., '' from (a || b)())
 *
 * This prevents counting collisions between function calls and literal method calls:
 * - function t1() {}; t1(); => 't1' (counted)
 * - 't1'.toString(); => '' (not counted, different category)
 *
 * @param {ASTNode} callExpression - CallExpression AST node to analyze
 * @return {string} Function name for direct calls, variable name for method calls, empty string otherwise
 */
export function getCalleeName(callExpression) {
	// Input validation
	if (!callExpression?.callee) {
		return '';
	}
	
	const callee = callExpression.callee;
	
	// Direct function call: func()
	if (callee.type === 'Identifier') {
		return callee.name;
	}
	
	// Method call: traverse to base object
	if (callee.type === 'MemberExpression') {
		let current = callee;
		
		// Find the base object: obj.nested.method() -> find 'obj'
		while (current.object) {
			current = current.object;
		}
		
		// Only return name for variable-based method calls
		if (current.type === 'Identifier') {
			return current.name; // obj.method() => 'obj'
		}
		
		// Literal method calls return empty string to avoid collision
		// 'str'.method() => '' (not counted with function calls)
		return '';
	}
	
	// All complex expressions return empty string
	// (func || fallback)(), func()(), etc.
	return '';
}