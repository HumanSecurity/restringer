/**
 * Find all return statements and if statements that contain sequence expressions.
 * @param {Arborist} arb
 * @param {Function} candidateFilter (optional) a filter to apply on the candidates list
 * @return {Array} Array of nodes with sequence expressions that can be rearranged
 */
export function rearrangeSequencesMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.ReturnStatement
		.concat(arb.ast[0].typeMap.IfStatement);
	const matchingNodes = [];

	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		// Check if node has a sequence expression that can be rearranged
		const hasSequenceExpression = 
			(n.type === 'ReturnStatement' && n.argument?.type === 'SequenceExpression') ||
			(n.type === 'IfStatement' && n.test?.type === 'SequenceExpression');

		if (hasSequenceExpression && candidateFilter(n)) {
			matchingNodes.push(n);
		}
	}
	return matchingNodes;
}

/**
 * Transform a statement with sequence expressions by extracting all but the last expression
 * into separate expression statements.
 * @param {Arborist} arb
 * @param {Object} node The statement node to transform
 * @return {Arborist}
 */
export function rearrangeSequencesTransform(arb, node) {
	const parent = node.parentNode;
	// Get the sequence expression from either return argument or if test
	const sequenceExpression = node.argument || node.test;
	const { expressions } = sequenceExpression;

	// Create expression statements for all but the last expression
	const extractedStatements = expressions.slice(0, -1).map(expr => ({
		type: 'ExpressionStatement',
		expression: expr
	}));

	// Create the replacement node with only the last expression
	const replacementNode = node.type === 'IfStatement' ? {
		type: 'IfStatement',
		test: expressions[expressions.length - 1],
		consequent: node.consequent,
		alternate: node.alternate
	} : {
		type: 'ReturnStatement',
		argument: expressions[expressions.length - 1]
	};

	// Handle different parent contexts
	if (parent.type === 'BlockStatement') {
		// Insert extracted statements before the current statement in the block
		const currentIdx = parent.body.indexOf(node);
		const newBlockBody = [
			...parent.body.slice(0, currentIdx),
			...extractedStatements,
			replacementNode,
			...parent.body.slice(currentIdx + 1)
		];
		
		arb.markNode(parent, {
			type: 'BlockStatement',
			body: newBlockBody,
		});
	} else {
		// Wrap in a new block statement if parent is not a block
		arb.markNode(node, {
			type: 'BlockStatement',
			body: [
				...extractedStatements,
				replacementNode
			]
		});
	}
	return arb;
}

/**
 * Rearrange sequence expressions in return statements and if conditions by extracting
 * all expressions except the last one into separate expression statements.
 * 
 * This improves code readability by converting:
 *   return a(), b(), c();     ->  a(); b(); return c();
 *   if (x(), y(), z()) {...}  ->  x(); y(); if (z()) {...}
 * 
 * Algorithm:
 * 1. Find return statements with sequence expression arguments
 * 2. Find if statements with sequence expression tests  
 * 3. Extract all but the last expression into separate expression statements
 * 4. Replace the original statement with one containing only the last expression
 * 5. Handle both block statement parents and single statement contexts
 * 
 * @param {Arborist} arb
 * @param {Function} candidateFilter (optional) a filter to apply on the candidates list
 * @return {Arborist}
 */
export default function rearrangeSequences(arb, candidateFilter = () => true) {
	const matchingNodes = rearrangeSequencesMatch(arb, candidateFilter);
	
	for (let i = 0; i < matchingNodes.length; i++) {
		arb = rearrangeSequencesTransform(arb, matchingNodes[i]);
	}
	
	return arb;
}