/**
 * Determines if an AST node's source range is completely contained within any of the provided ranges.
 * A node is considered "in range" if its start position is greater than or equal to the range start
 * AND its end position is less than or equal to the range end.
 *
 * This function is commonly used for:
 * - Filtering nodes that overlap with already collected ranges
 * - Excluding nodes from processing based on position constraints
 * - Checking if modifications fall within specific code regions
 *
 * Range format: Each range is a two-element array [startIndex, endIndex] representing
 * character positions in the source code, where startIndex is inclusive and endIndex is exclusive.
 *
 * @param {ASTNode} targetNode - AST node to check (must have a .range property)
 * @param {number[][]} ranges - Array of range tuples [start, end] to check against
 * @return {boolean} True if the target node is completely contained within any range; false otherwise.
 *
 * @example
 * // Check if a node at positions 5-8 is within range 0-10
 * // const node = {range: [5, 8]};
 * // isNodeInRanges(node, [[0, 10]]) => true
 * // isNodeInRanges(node, [[0, 7]]) => false (node extends beyond range)
 * // isNodeInRanges(node, [[6, 10]]) => false (node starts before range)
 */
export function isNodeInRanges(targetNode, ranges) {
	// Early return for empty ranges array - no ranges means node is not in any range
	if (!ranges.length) {
		return false;
	}

	const [nodeStart, nodeEnd] = targetNode.range;

	// Check if node range is completely contained within any provided range
	for (let i = 0; i < ranges.length; i++) {
		const [rangeStart, rangeEnd] = ranges[i];
		if (nodeStart >= rangeStart && nodeEnd <= rangeEnd) {
			return true;
		}
	}

	return false;
}