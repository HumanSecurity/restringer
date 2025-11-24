const IIFE_FUNCTION_TYPES = ['ArrowFunctionExpression', 'FunctionExpression'];

/**
 * Determines if a node represents an unwrappable IIFE.
 * 
 * @param {ASTNode} n - The CallExpression node to check
 * @return {boolean} True if the node is an unwrappable IIFE
 */
function isUnwrappableIIFE(n) {
	return !n.arguments.length &&
		IIFE_FUNCTION_TYPES.includes(n.callee.type) &&
		!n.callee.id &&
		// IIFEs with a single return statement for variable initialization
		(((n.callee.body.type !== 'BlockStatement' ||
			(n.callee.body.body.length === 1 &&
			n.callee.body.body[0].type === 'ReturnStatement')) &&
		n.parentKey === 'init') ||
		// Generic IIFE wrappers for statement unwrapping
		(n.parentKey === 'ExpressionStatement' ||
			(n.parentKey === 'argument' && n.parentNode.type === 'UnaryExpression')));
}

/**
 * Computes target and replacement nodes for IIFE unwrapping.
 * 
 * @param {ASTNode} n - The IIFE CallExpression node
 * @return {Object|null} Object with targetNode and replacementNode, or null if unwrapping should be skipped
 */
function computeUnwrappingNodes(n) {
	let targetNode = n;
	let replacementNode = n.callee.body;
	
	if (replacementNode.type === 'BlockStatement') {
		let targetChild = replacementNode;
		
		// IIFEs with a single return statement
		if (replacementNode.body?.[0]?.argument) {
			replacementNode = replacementNode.body[0].argument;
		}
		// IIFEs with multiple statements or expressions
		else {
			while (targetNode && !targetNode.body) {
				// Skip cases where IIFE is used to initialize or set a value
				if (targetNode.parentKey === 'init' || targetNode.type === 'AssignmentExpression') {
					return null; // Signal to skip this candidate
				}
				targetChild = targetNode;
				targetNode = targetNode.parentNode;
			}
			
			if (!targetNode?.body?.filter) {
				targetNode = n;
			} else {
				// Place the wrapped code instead of the wrapper node
				replacementNode = {
					...targetNode,
					body: targetNode.body.filter(t => t !== targetChild).concat(replacementNode.body),
				};
			}
		}
	}
	
	return { targetNode, replacementNode };
}

/**
 * Finds IIFE nodes that can be unwrapped.
 * 
 * Identifies Immediately Invoked Function Expressions (IIFEs) that:
 * - Have no arguments
 * - Use anonymous functions (arrow or function expressions)
 * - Are used for variable initialization or statement wrapping
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {ASTNode[]} Array of IIFE CallExpression nodes that can be unwrapped
 */
export function unwrapIIFEsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.CallExpression;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		if (isUnwrappableIIFE(n) && candidateFilter(n)) {
			// Verify that unwrapping is actually possible
			const unwrappingNodes = computeUnwrappingNodes(n);
			if (unwrappingNodes !== null) {
				matches.push(n);
			}
		}
	}
	
	return matches;
}

/**
 * Transforms an IIFE by unwrapping it to reveal its content.
 * 
 * Handles two main transformation patterns:
 * 1. Variable initialization: Replace IIFE with returned function/value
 * 2. Statement unwrapping: Replace IIFE with its body statements
 * 
 * @param {Arborist} arb - The Arborist instance to mark nodes for transformation
 * @param {ASTNode} n - The IIFE CallExpression node to unwrap
 * @return {Arborist} The Arborist instance for chaining
 */
export function unwrapIIFEsTransform(arb, n) {
	const unwrappingNodes = computeUnwrappingNodes(n);
	
	if (unwrappingNodes !== null) {
		const { targetNode, replacementNode } = unwrappingNodes;
		arb.markNode(targetNode, replacementNode);
	}
	
	return arb;
}

/**
 * Replace IIFEs that are unwrapping a function with the unwrapped function.
 * 
 * This optimization removes unnecessary IIFE wrappers around functions or statements
 * that serve no purpose other than immediate execution. The transformation handles
 * both variable initialization patterns and statement unwrapping scenarios.
 * 
 * Transforms:
 * ```javascript
 * var a = (() => { return b => c(b - 40); })();
 * ```
 * 
 * Into:
 * ```javascript
 * var a = b => c(b - 40);
 * ```
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} [candidateFilter] - Optional filter to apply to candidates
 * @return {Arborist} The Arborist instance for chaining
 */
export default function unwrapIIFEs(arb, candidateFilter = () => true) {
	const matches = unwrapIIFEsMatch(arb, candidateFilter);
	
	for (let i = 0; i < matches.length; i++) {
		arb = unwrapIIFEsTransform(arb, matches[i]);
	}
	
	return arb;
}