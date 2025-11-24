/**
 * Creates individual expression statements from each expression in a sequence expression.
 * 
 * This helper function takes an array of expressions from a SequenceExpression
 * and converts each one into a standalone ExpressionStatement AST node.
 * 
 * @param {Array} expressions - Array of expression AST nodes from SequenceExpression
 * @return {ASTNode[]} Array of ExpressionStatement AST nodes
 */
function createExpressionStatements(expressions) {
	const statements = [];
	for (let i = 0; i < expressions.length; i++) {
		statements.push({
			type: 'ExpressionStatement',
			expression: expressions[i]
		});
	}
	return statements;
}

/**
 * Creates a new BlockStatement body by replacing a target statement with multiple statements.
 * 
 * This optimized implementation avoids spread operators and builds the new array
 * incrementally for better performance with large parent bodies.
 * 
 * @param {Array} parentBody - Original body array from BlockStatement
 * @param {number} targetIndex - Index of statement to replace  
 * @param {Array} replacementStatements - Array of statements to insert
 * @return {ASTNode[]} New body array with replacements
 */
function createReplacementBody(parentBody, targetIndex, replacementStatements) {
	const newBody = [];
	let newIndex = 0;
	
	// Copy statements before target
	for (let i = 0; i < targetIndex; i++) {
		newBody[newIndex++] = parentBody[i];
	}
	
	// Insert replacement statements
	for (let i = 0; i < replacementStatements.length; i++) {
		newBody[newIndex++] = replacementStatements[i];
	}
	
	// Copy statements after target
	for (let i = targetIndex + 1; i < parentBody.length; i++) {
		newBody[newIndex++] = parentBody[i];
	}
	
	return newBody;
}

/**
 * Identifies ExpressionStatement nodes that contain SequenceExpressions suitable for transformation.
 * 
 * A sequence expression is a candidate for transformation when:
 * 1. The node is an ExpressionStatement 
 * 2. Its expression property is a SequenceExpression
 * 3. The SequenceExpression contains multiple expressions to expand
 * 4. The node passes the candidate filter
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {ASTNode[]} Array of nodes that can be transformed
 */
export function replaceSequencesWithExpressionsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.ExpressionStatement || [];
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Check if this ExpressionStatement contains a SequenceExpression
		if (n.expression &&
			n.expression.type === 'SequenceExpression' &&
			n.expression.expressions &&
			n.expression.expressions.length > 1 &&
			candidateFilter(n)) {
			matches[matches.length] = n;
		}
	}
	
	return matches;
}

/**
 * Transforms a SequenceExpression into individual ExpressionStatements.
 * 
 * The transformation strategy depends on the parent context:
 * - If parent is BlockStatement: Replace within the existing block by creating 
 *   a new BlockStatement with the sequence expanded into individual statements
 * - If parent is not BlockStatement: Replace the ExpressionStatement with a 
 *   new BlockStatement containing the individual statements
 * 
 * This ensures proper AST structure while expanding sequence expressions into
 * separate executable statements.
 * 
 * @param {Arborist} arb - The Arborist instance to mark changes on
 * @param {Object} n - The ExpressionStatement node containing SequenceExpression
 * @return {Arborist} The modified Arborist instance
 */
export function replaceSequencesWithExpressionsTransform(arb, n) {
	const parent = n.parentNode;
	const statements = createExpressionStatements(n.expression.expressions);
	
	if (parent && parent.type === 'BlockStatement') {
		// Find target statement position within parent block
		const currentIdx = parent.body.indexOf(n);
		
		if (currentIdx !== -1) {
			// Create new BlockStatement with sequence expanded inline
			const replacementNode = {
				type: 'BlockStatement',
				body: createReplacementBody(parent.body, currentIdx, statements)
			};
			arb.markNode(parent, replacementNode);
		}
	} else {
		// Replace ExpressionStatement with BlockStatement containing individual statements
		const blockStatement = {
			type: 'BlockStatement',
			body: statements
		};
		arb.markNode(n, blockStatement);
	}
	
	return arb;
}

/**
 * All expressions within a sequence will be replaced by their own expression statement.
 * 
 * This transformation converts SequenceExpressions into individual ExpressionStatements
 * to improve code readability and enable better analysis. For example:
 * 
 * Input:  if (a) (b(), c());
 * Output: if (a) { b(); c(); }
 * 
 * The transformation handles both cases where the sequence is:
 * 1. Already within a BlockStatement (inserts statements inline)
 * 2. Not within a BlockStatement (creates new BlockStatement)
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST to transform
 * @param {Function} [candidateFilter] - Optional filter to apply on candidates
 * @return {Arborist} The modified Arborist instance
 */
export default function replaceSequencesWithExpressions(arb, candidateFilter = () => true) {
	const matches = replaceSequencesWithExpressionsMatch(arb, candidateFilter);
	
	for (let i = 0; i < matches.length; i++) {
		arb = replaceSequencesWithExpressionsTransform(arb, matches[i]);
	}
	
	return arb;
}