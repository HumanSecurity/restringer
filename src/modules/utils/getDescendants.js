/**
 * Collects all descendant nodes from a given AST node.
 * The function uses caching to avoid recomputation for nodes that have already been processed,
 * storing results in a 'descendants' property on the target node.
 *
 * Algorithm:
 * - Uses a stack-based traversal to avoid recursion depth limits
 * - Uses Set for O(1) duplicate detection during traversal
 * - Caches results as array on the node to prevent redundant computation
 * - Returns a flat array containing all child nodes
 *
 * @param {ASTNode} targetNode - The AST node to collect descendants from
 * @return {ASTNode[]} Flat array of all descendant nodes, or empty array if no descendants or invalid input
 *
 * @example
 * // For a binary expression like "a + b"
 * const descendants = getDescendants(binaryExprNode);
 * // Returns [leftIdentifier, rightIdentifier] - all nested child nodes
 */
export function getDescendants(targetNode) {
	// Input validation
	if (!targetNode) {
		return [];
	}
	
	// Return cached result if available
	if (targetNode.descendants) {
		return targetNode.descendants;
	}
	
	/** @type {Set<ASTNode>} */
	const descendants = new Set();
	/** @type {ASTNode[]} */
	const stack = [targetNode];
	
	while (stack.length) {
		const currentNode = stack.pop();
		const childNodes = currentNode?.childNodes || [];
		
		for (let i = 0; i < childNodes.length; i++) {
			const childNode = childNodes[i];
			if (!descendants.has(childNode)) {
				descendants.add(childNode);
				stack.push(childNode);
			}
		}
	}
	
	// Cache results as array on the target node for future calls
	const descendantsArray = [...descendants];
	return targetNode.descendants = descendantsArray;
}