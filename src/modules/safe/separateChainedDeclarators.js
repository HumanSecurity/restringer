// Static regex to avoid recreation overhead
const FOR_STATEMENT_REGEX = /For.*Statement/;

/**
 * Creates individual VariableDeclaration nodes from a single declarator.
 * 
 * @param {ASTNode} originalDeclaration - The original VariableDeclaration node
 * @param {ASTNode} declarator - The individual VariableDeclarator to wrap
 * @return {ASTNode} New VariableDeclaration node with single declarator
 */
function createSingleDeclaration(originalDeclaration, declarator) {
	return {
		type: 'VariableDeclaration',
		kind: originalDeclaration.kind,
		declarations: [declarator],
	};
}

/**
 * Creates a replacement parent node with separated declarations.
 * 
 * Handles two cases:
 * 1. Parent accepts arrays - splice in separated declarations
 * 2. Parent accepts single nodes - wrap in BlockStatement
 * 
 * @param {ASTNode} n - The VariableDeclaration node to replace
 * @param {ASTNode[]} separatedDeclarations - Array of separated declaration nodes
 * @return {ASTNode} The replacement parent node
 */
function createReplacementParent(n, separatedDeclarations) {
	let replacementValue;
	
	if (Array.isArray(n.parentNode[n.parentKey])) {
		// Parent accepts multiple nodes - splice in the separated declarations
		const replacedArr = n.parentNode[n.parentKey];
		const idx = replacedArr.indexOf(n);
		replacementValue = [
			...replacedArr.slice(0, idx),
			...separatedDeclarations,
			...replacedArr.slice(idx + 1)
		];
	} else {
		// Parent accepts single node - wrap in BlockStatement
		replacementValue = {
			type: 'BlockStatement',
			body: separatedDeclarations,
		};
	}
	
	return {
		...n.parentNode,
		[n.parentKey]: replacementValue,
	};
}

/**
 * Finds VariableDeclaration nodes with multiple declarators that can be separated.
 * 
 * Identifies variable declarations with multiple declarators, excluding those inside
 * for-loop statements where multiple declarations serve a specific purpose.
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {ASTNode[]} Array of VariableDeclaration nodes that can be separated
 */
export function separateChainedDeclaratorsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.VariableDeclaration;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Must have multiple declarations, not be in a for-loop, and pass filter
		if (n.declarations.length > 1 &&
			!FOR_STATEMENT_REGEX.test(n.parentNode.type) &&
			candidateFilter(n)) {
			matches.push(n);
		}
	}
	
	return matches;
}

/**
 * Transforms a VariableDeclaration by separating its multiple declarators.
 * 
 * Converts a single VariableDeclaration with multiple declarators into
 * multiple VariableDeclaration nodes each with a single declarator.
 * 
 * @param {Arborist} arb - The Arborist instance to mark nodes for transformation
 * @param {ASTNode} n - The VariableDeclaration node to transform
 * @return {Arborist} The Arborist instance for chaining
 */
export function separateChainedDeclaratorsTransform(arb, n) {
	// Create individual declarations for each declarator
	const separatedDeclarations = [];
	for (let i = 0; i < n.declarations.length; i++) {
		separatedDeclarations.push(createSingleDeclaration(n, n.declarations[i]));
	}
	
	// Create replacement parent node and mark for transformation
	const replacementParent = createReplacementParent(n, separatedDeclarations);
	arb.markNode(n.parentNode, replacementParent);
	
	return arb;
}

/**
 * Separate multiple variable declarators under the same variable declaration into single variable declaration->variable declarator pairs.
 * 
 * This function improves code readability and simplifies analysis by converting
 * chained variable declarations into individual declaration statements.
 * 
 * Examples:
 * - `const foo = 5, bar = 7;` becomes `const foo = 5; const bar = 7;`
 * - `let a, b = 2, c = 3;` becomes `let a; let b = 2; let c = 3;`
 * - `var x = 1, y = 2;` becomes `var x = 1; var y = 2;`
 * 
 * Special handling:
 * - Preserves for-loop declarations: `for (let i = 0, len = arr.length; ...)` (unchanged)
 * - Wraps in BlockStatement when parent expects single node: `if (x) var a, b;` becomes `if (x) { var a; var b; }`
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply to candidates
 * @return {Arborist} The Arborist instance for chaining
 */
export default function separateChainedDeclarators(arb, candidateFilter = () => true) {
	const matches = separateChainedDeclaratorsMatch(arb, candidateFilter);
	
	for (let i = 0; i < matches.length; i++) {
		arb = separateChainedDeclaratorsTransform(arb, matches[i]);
	}
	
	return arb;
}