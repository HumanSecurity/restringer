/**
 * Performs depth-first search through AST node descendants to find nodes matching a condition.
 * Uses an iterative stack-based approach to avoid call stack overflow on deeply nested ASTs.
 * This function is commonly used to check if transformations should be skipped due to
 * specific node types being present in the subtree (e.g., ThisExpression, marked nodes).
 *
 * @param {ASTNode} targetNode - The root AST node to start searching from
 * @param {Function} condition - Predicate function that takes an ASTNode and returns boolean
 * @param {boolean} [returnNode=false] - If true, returns the matching node; if false, returns boolean
 * @return {boolean|ASTNode} True/false if returnNode is false, or the matching ASTNode if returnNode is true
 *
 * // Example usage:
 * // Check if any descendant is marked: doesDescendantMatchCondition(node, n => n.isMarked)
 * // Find ThisExpression: doesDescendantMatchCondition(node, n => n.type === 'ThisExpression', true)
 */
export function doesDescendantMatchCondition(targetNode, condition, returnNode = false) {
	// Input validation - handle null/undefined gracefully
	if (!targetNode || typeof condition !== 'function') {
		return false;
	}

	// Use stack-based DFS to avoid recursion depth limits
	const stack = [targetNode];
	while (stack.length) {
		const currentNode = stack.pop();
		
		// Test current node against condition
		if (condition(currentNode)) {
			return returnNode ? currentNode : true;
		}
		
		// Add children to stack for continued traversal (use traditional loop for performance)
		if (currentNode.childNodes?.length) {
			for (let i = currentNode.childNodes.length - 1; i >= 0; i--) {
				stack.push(currentNode.childNodes[i]);
			}
		}
	}
	
	return false;
}