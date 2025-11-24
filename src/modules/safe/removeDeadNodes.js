const RELEVANT_PARENTS = [
	'VariableDeclarator',
	'AssignmentExpression',
	'FunctionDeclaration',
	'ClassDeclaration',
];

/**
 * Find identifiers that are declared but never referenced (dead code).
 * 
 * Identifies identifiers in declaration contexts that have no references,
 * indicating they are declared but never used anywhere in the code.
 * 
 * @param {Arborist} arb
 * @param {Function} [candidateFilter] a filter to apply on the candidates list
 * @return {ASTNode[]} Array of dead identifier nodes
 */
function removeDeadNodesMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.Identifier;
	const matchingNodes = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		// Check if identifier is in a declaration context and has no references
		if (RELEVANT_PARENTS.includes(n.parentNode.type) &&
			(!n?.declNode?.references?.length && !n?.references?.length) &&
			candidateFilter(n)) {
			const parent = n.parentNode;
			// Skip root-level declarations as they might be referenced externally
			if (parent.parentNode.type === 'Program') continue;
			matchingNodes.push(n);
		}
	}
	return matchingNodes;
}

/**
 * Remove a dead code declaration node.
 * 
 * Determines the appropriate node to remove based on the declaration type:
 * - For expression statements: removes the entire expression statement
 * - For other declarations: removes the declaration itself
 * 
 * @param {Arborist} arb
 * @param {Object} identifierNode - The dead identifier node
 * @return {Arborist}
 */
function removeDeadNodesTransform(arb, identifierNode) {
	const parent = identifierNode.parentNode;
	// Remove expression statement wrapper if present, otherwise remove the declaration
	const nodeToRemove = parent?.parentNode?.type === 'ExpressionStatement' 
		? parent.parentNode 
		: parent;
	arb.markNode(nodeToRemove);
	return arb;
}

/**
 * Remove declared but unused code (dead code elimination).
 * 
 * This function identifies and removes variables, functions, and classes that are
 * declared but never referenced in the code. This helps clean up obfuscated code
 * that may contain many unused declarations.
 * 
 * ⚠️  **WARNING**: This is a potentially dangerous operation that should be used with caution.
 * Dynamic references (e.g., `eval`, `window[varName]`) cannot be detected statically,
 * so removing "dead" code might break functionality that relies on dynamic access.
 * 
 * Algorithm:
 * 1. Find all identifiers in declaration contexts (variables, functions, classes)
 * 2. Check if they have any references in the AST
 * 3. Skip root-level declarations (might be used by external scripts)
 * 4. Remove unreferenced declarations
 * 
 * Handles these declaration types:
 * - Variable declarations: `var unused = 5;`
 * - Function declarations: `function unused() {}`
 * - Class declarations: `class Unused {}`
 * - Assignment expressions: `unused = value;` (if unused is unreferenced)
 * 
 * @param {Arborist} arb
 * @param {Function} [candidateFilter] a filter to apply on the candidates list
 * @return {Arborist}
 */
function removeDeadNodes(arb, candidateFilter = () => true) {
	const matchingNodes = removeDeadNodesMatch(arb, candidateFilter);
	for (let i = 0; i < matchingNodes.length; i++) {
		arb = removeDeadNodesTransform(arb, matchingNodes[i]);
	}
	return arb;
}

export default removeDeadNodes;