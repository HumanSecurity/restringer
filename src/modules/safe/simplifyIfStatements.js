/**
 * Checks if an AST node represents an empty statement or block.
 * 
 * @param {ASTNode} node - The AST node to check
 * @return {boolean} True if the node is empty, false otherwise
 */
function isEmpty(node) {
	if (!node) return true;
	if (node.type === 'EmptyStatement') return true;
	if (node.type === 'BlockStatement' && !node.body.length) return true;
	return false;
}

/**
 * Creates an inverted test expression wrapped in UnaryExpression with '!' operator.
 * 
 * @param {ASTNode} test - The original test expression
 * @return {ASTNode} UnaryExpression node with '!' operator
 */
function createInvertedTest(test) {
	return {
		type: 'UnaryExpression',
		operator: '!',
		prefix: true,
		argument: test,
	};
}

/**
 * Finds IfStatement nodes that can be simplified by removing empty branches.
 * 
 * Identifies if statements where:
 * - Both consequent and alternate are empty (convert to expression)
 * - Consequent is empty but alternate has content (invert and swap)
 * - Alternate is empty but consequent has content (remove alternate)
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {ASTNode[]} Array of IfStatement nodes that can be simplified
 */
export function simplifyIfStatementsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.IfStatement;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		if (!candidateFilter(n)) {
			continue;
		}
		
		const consequentEmpty = isEmpty(n.consequent);
		const alternateEmpty = isEmpty(n.alternate);
		
		// Can simplify if: both empty, or consequent empty with populated alternate, or alternate empty with populated consequent
		if ((consequentEmpty && alternateEmpty) ||
			(consequentEmpty && !alternateEmpty) ||
			(!consequentEmpty && alternateEmpty)) {
			matches.push(n);
		}
	}
	
	return matches;
}

/**
 * Transforms an IfStatement by simplifying empty branches.
 * 
 * Applies one of three transformations:
 * 1. Both branches empty: Convert to ExpressionStatement with test only
 * 2. Empty consequent with populated alternate: Invert test and move alternate to consequent
 * 3. Empty alternate with populated consequent: Remove the alternate clause
 * 
 * @param {Arborist} arb - The Arborist instance to mark nodes for transformation
 * @param {ASTNode} n - The IfStatement node to transform
 * @return {Arborist} The Arborist instance for chaining
 */
export function simplifyIfStatementsTransform(arb, n) {
	const consequentEmpty = isEmpty(n.consequent);
	const alternateEmpty = isEmpty(n.alternate);
	let replacementNode;
	
	if (consequentEmpty) {
		if (alternateEmpty) {
			// Both branches empty - convert to expression statement
			replacementNode = {
				type: 'ExpressionStatement',
				expression: n.test,
			};
		} else {
			// Empty consequent with populated alternate - invert test and swap
			replacementNode = {
				type: 'IfStatement',
				test: createInvertedTest(n.test),
				consequent: n.alternate,
				alternate: null,
			};
		}
	} else if (alternateEmpty) {
		// Populated consequent with empty alternate - remove alternate
		replacementNode = {
			...n,
			alternate: null,
		};
	}
	
	if (replacementNode) {
		arb.markNode(n, replacementNode);
	}
	
	return arb;
}

/**
 * Simplify if statements by removing or restructuring empty branches.
 * 
 * This function optimizes if statements that have empty consequents or alternates,
 * improving code readability and reducing unnecessary branching.
 * 
 * Transformations applied:
 * - `if (test) {} else {}` becomes `test;`
 * - `if (test) {} else action()` becomes `if (!test) action()`
 * - `if (test) action() else {}` becomes `if (test) action()`
 * - `if (test);` becomes `test;`
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply to candidates
 * @return {Arborist} The Arborist instance for chaining
 */
export default function simplifyIfStatements(arb, candidateFilter = () => true) {
	const matches = simplifyIfStatementsMatch(arb, candidateFilter);
	
	for (let i = 0; i < matches.length; i++) {
		arb = simplifyIfStatementsTransform(arb, matches[i]);
	}
	
	return arb;
}