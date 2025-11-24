// Parent types that indicate a block statement is redundant (creates unnecessary nesting)
const REDUNDANT_BLOCK_PARENT_TYPES = ['BlockStatement', 'Program'];

/**
 * Find all block statements that are redundant and can be flattened.
 * 
 * Identifies block statements that create unnecessary nesting by being
 * direct children of other block statements or the Program node.
 * 
 * @param {Arborist} arb
 * @param {Function} [candidateFilter] a filter to apply on the candidates list. Defaults to true.
 * @return {ASTNode[]} Array of redundant block statement nodes
 */
export function removeRedundantBlockStatementsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.BlockStatement;
	const matchingNodes = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		// Block statements are redundant if:
		// 1. Their parent is a node type that creates unnecessary nesting
		// 2. They pass the candidate filter
		if (REDUNDANT_BLOCK_PARENT_TYPES.includes(n.parentNode.type) && candidateFilter(n)) {
			matchingNodes.push(n);
		}
	}
	return matchingNodes;
}

/**
 * Transform a redundant block statement by flattening it into its parent.
 * 
 * Handles three transformation scenarios:
 * 1. Single child replacement: parent becomes this block
 * 2. Single statement replacement: block becomes its single statement  
 * 3. Content flattening: block's contents spread into parent's body
 * 
 * @param {Arborist} arb
 * @param {Object} blockNode The redundant block statement node to flatten
 * @return {Arborist}
 */
export function removeRedundantBlockStatementsTransform(arb, blockNode) {
	const parent = blockNode.parentNode;
	
	// Case 1: Parent has only one child (this block) - replace parent with this block
	if (parent.body?.length === 1) {
		arb.markNode(parent, blockNode);
	}
	// Case 2: Parent has multiple children - need to flatten this block's contents
	else if (parent.body?.length > 1) {
		// If this block has only one statement, replace it directly
		if (blockNode.body.length === 1) {
			arb.markNode(blockNode, blockNode.body[0]);
		} else {
			// Flatten this block's contents into the parent's body
			const currentIdx = parent.body.indexOf(blockNode);
			const replacementNode = {
				type: parent.type,
				body: [
					...parent.body.slice(0, currentIdx),
					...blockNode.body,
					...parent.body.slice(currentIdx + 1)
				],
			};
			arb.markNode(parent, replacementNode);
		}
	}
	
	return arb;
}

/**
 * Remove redundant block statements by flattening unnecessarily nested blocks.
 * 
 * This module eliminates redundant block statements that create unnecessary nesting:
 * 1. Block statements that are direct children of other block statements
 * 2. Block statements that are direct children of the Program node
 * 
 * Transformations:
 *   if (a) {{do_a();}} → if (a) {do_a();}
 *   if (a) {{do_a();}{do_b();}} → if (a) {do_a(); do_b();}
 *   {{{{{statement;}}}}} → statement;
 * 
 * Algorithm:
 * 1. Find all block statements whose parent is BlockStatement or Program
 * 2. For each redundant block:
 *    - If parent has single child: replace parent with the block
 *    - If block has single statement: replace block with the statement
 *    - Otherwise: flatten block's contents into parent's body
 * 
 * Note: Processing stops after Program node replacement since the root changes.
 * 
 * @param {Arborist} arb
 * @param {Function} [candidateFilter] a filter to apply on the candidates list. Defaults to true.
 * @return {Arborist}
 */
export default function removeRedundantBlockStatements(arb, candidateFilter = () => true) {
	const matchingNodes = removeRedundantBlockStatementsMatch(arb, candidateFilter);
	
	for (let i = 0; i < matchingNodes.length; i++) {
		arb = removeRedundantBlockStatementsTransform(arb, matchingNodes[i]);
		
		// Stop processing if we replaced the Program node since the AST structure changed
		if (matchingNodes[i].parentNode.type === 'Program') {
			break;
		}
	}
	return arb;
}