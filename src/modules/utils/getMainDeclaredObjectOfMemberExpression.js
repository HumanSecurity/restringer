/**
 * Traverses a member expression chain to find the root object that has a declaration.
 * This function walks up nested member expressions (e.g., a.b.c.d) to locate the base
 * identifier or object that contains a declNode, which indicates it was declared in the code.
 *
 * Algorithm:
 * - Starts with the given member expression
 * - Traverses up the object chain (.object property) until finding a node with declNode
 * - Stops when reaching a non-MemberExpression or finding a declared object
 * - Includes safety check to prevent infinite loops
 *
 * @param {ASTNode} memberExpression - MemberExpression AST node to analyze
 * @return {ASTNode|null} The root object in the chain, or null if invalid input
 *
 * @example
 * // a.b.c.d --> returns the 'a' identifier (if it has declNode)
 * // obj.nested.prop --> returns 'obj' identifier (if it has declNode)
 * // computed[key].value --> returns 'computed' identifier (if it has declNode)
 */
export function getMainDeclaredObjectOfMemberExpression(memberExpression) {
	// Input validation: only reject null/undefined, allow any valid AST node
	if (!memberExpression) {
		return null;
	}

	let mainObject = memberExpression;
	let iterationCount = 0;
	const MAX_ITERATIONS = 50; // Prevent infinite loops in malformed AST

	// Traverse up the member expression chain to find the root object with a declaration
	while (mainObject && 
		   !mainObject.declNode && 
		   mainObject.type === 'MemberExpression' && 
		   iterationCount < MAX_ITERATIONS) {
		mainObject = mainObject.object;
		iterationCount++;
	}

	// Return the final object in the chain (original behavior preserved)
	return mainObject;
}