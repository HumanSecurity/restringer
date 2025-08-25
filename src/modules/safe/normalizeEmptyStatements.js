// Control flow statement types where empty statements must be preserved as statement bodies
const controlFlowStatementTypes = ['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement', 'IfStatement'];

/**
 * Find all empty statements that can be safely removed.
 * @param {Arborist} arb
 * @param {Function} candidateFilter (optional) a filter to apply on the candidates list
 * @return {Array} Array of empty statement nodes that can be safely removed
 */
export function normalizeEmptyStatementsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = []
		.concat(arb.ast[0].typeMap.EmptyStatement);
		
	const matchingNodes = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		if (candidateFilter(n)) {
			// Control flow statements can have empty statements as their body.
			// If we delete that empty statement the syntax breaks
			// e.g. for (var i = 0, b = 8;;); - valid for statement
			// e.g. if (condition); - valid if statement with empty consequent
			if (!controlFlowStatementTypes.includes(n.parentNode.type)) {
				matchingNodes.push(n);
			}
		}
	}
	return matchingNodes;
}

/**
 * Remove an empty statement node.
 * @param {Arborist} arb
 * @param {Object} node The empty statement node to remove
 * @return {Arborist}
 */
export function normalizeEmptyStatementsTransform(arb, node) {
	arb.markNode(node);
	return arb;
}

/**
 * Remove empty statements that are not required for syntax correctness.
 * 
 * Empty statements (just semicolons) can be safely removed in most contexts,
 * but must be preserved in control flow statements where they serve as the statement body:
 *   - for (var i = 0; i < 10; i++); // The semicolon is the empty loop body
 *   - while (condition); // The semicolon is the empty loop body
 *   - if (condition); else;// The semicolon is the empty if consequent and the empty else alternate
 * 
 * Safe to remove:
 *   - Standalone empty statements: "var x = 1;;"
 *   - Empty statements in blocks: "if (true) {;}"
 * 
 * Must preserve:
 *   - Control flow body empty statements: "for(;;);", "while(true);", "if(condition);"
 * 
 * @param {Arborist} arb
 * @param {Function} candidateFilter (optional) a filter to apply on the candidates list
 * @return {Arborist}
 */
export default function normalizeEmptyStatements(arb, candidateFilter = () => true) {
	const matchingNodes = normalizeEmptyStatementsMatch(arb, candidateFilter);
	
	for (let i = 0; i < matchingNodes.length; i++) {
		arb = normalizeEmptyStatementsTransform(arb, matchingNodes[i]);
	}
	
	return arb;
}