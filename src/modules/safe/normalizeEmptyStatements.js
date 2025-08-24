/**
 * Remove unrequired empty statements.
 * @param {Arborist} arb
 * @param {Function} candidateFilter (optional) a filter to apply on the candidates list
 * @return {Arborist}
 */
function normalizeEmptyStatements(arb, candidateFilter = () => true) {
	const relevantNodes = [
		...(arb.ast[0].typeMap.EmptyStatement || []),
	];
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		if (candidateFilter(n)) {
			// A loop can be used to execute code even without providing a loop body, just an empty statement.
			// If we delete that empty statement the syntax breaks
			// e.g. for (var i = 0, b = 8;;); - this is a valid for statement.
			if (!/(For.*|(Do)?While)Statement/.test(n.parentNode.type)) arb.markNode(n);
		}
	}
	return arb;
}

export default normalizeEmptyStatements;