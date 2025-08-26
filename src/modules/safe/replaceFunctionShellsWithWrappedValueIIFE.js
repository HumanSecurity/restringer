// Static arrays extracted outside functions to avoid recreation overhead
const RETURNABLE_TYPES = ['Literal', 'Identifier'];

/**
 * Find all IIFE function expressions that only return a simple literal or identifier.
 * 
 * This function identifies Immediately Invoked Function Expressions (IIFEs) that act
 * as "shells" around simple values. These are function expressions that are immediately
 * called with no arguments and contain only a single return statement returning either
 * a literal or an identifier.
 * 
 * Algorithm:
 * 1. Find all function expressions in the AST
 * 2. Check if they are used as callees (IIFE pattern)
 * 3. Verify the call has no arguments
 * 4. Check if function body contains exactly one return statement
 * 5. Verify the return argument is a literal or identifier
 * 6. Apply candidate filter for additional constraints
 * 7. Return matching function expression nodes
 * 
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Array} Array of function expression nodes that can be replaced
 */
export function replaceFunctionShellsWithWrappedValueIIFEMatch(arb, candidateFilter = () => true) {
	// Direct access to typeMap without spread operator for better performance
	const relevantNodes = arb.ast[0].typeMap.FunctionExpression;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const node = relevantNodes[i];
		
		// Optimized condition ordering: cheapest checks first for better performance
		// Also added safety checks to prevent potential runtime errors
		if (candidateFilter(node) &&
			node.parentKey === 'callee' &&
			node.parentNode &&
			!node.parentNode.arguments.length &&
			node.body?.body?.[0]?.type === 'ReturnStatement' &&
			RETURNABLE_TYPES.includes(node.body.body[0].argument?.type)) {
			matches.push(node);
		}
	}
	
	return matches;
}

/**
 * Transform IIFE function shells by replacing them with their wrapped values.
 * 
 * This function replaces Immediately Invoked Function Expression (IIFE) calls
 * that only return simple values with the actual values themselves. This removes
 * the overhead of function creation and invocation for simple value wrapping.
 * 
 * The transformation changes patterns like (function(){return value})() to just value.
 * 
 * @param {Arborist} arb - The arborist instance to modify
 * @param {Object} node - The function expression node to process
 * @return {Arborist} The modified arborist instance
 */
export function replaceFunctionShellsWithWrappedValueIIFETransform(arb, node) {
	// Extract the return value from the function body
	const replacementNode = node.body.body[0].argument;
	
	// Replace the entire IIFE call expression with the return value
	// node.parentNode is the call expression (function(){...})(), we replace it with just the value
	arb.markNode(node.parentNode, replacementNode);
	
	return arb;
}

/**
 * Replace IIFE function shells with their wrapped values for optimization.
 * 
 * This module identifies and optimizes Immediately Invoked Function Expression (IIFE)
 * "shells" - function expressions that are immediately called with no arguments and
 * serve no purpose other than wrapping a simple literal or identifier value. Such
 * patterns are common in obfuscated code where simple values are hidden behind
 * function calls.
 * 
 * Transformations:
 *   (function() { return 42; })()        →  42
 *   (function() { return String; })()    →  String
 *   (function() { return x; })()         →  x
 *   (function() { return "test"; })()    →  "test"
 * 
 * Safety features:
 * - Only processes function expressions used as callees (IIFE pattern)
 * - Only handles calls with no arguments to preserve semantics
 * - Only processes functions with exactly one return statement
 * - Only handles simple return types (literals and identifiers)
 * - Preserves execution order and side effects
 * 
 * Performance benefits:
 * - Eliminates unnecessary function creation and invocation overhead
 * - Reduces code size by removing wrapper functions
 * - Improves readability by exposing actual values
 * - Enables further optimization opportunities
 * 
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Arborist} The modified arborist instance
 */
export default function replaceFunctionShellsWithWrappedValueIIFE(arb, candidateFilter = () => true) {
	// Find all matching IIFE function expression nodes
	const matches = replaceFunctionShellsWithWrappedValueIIFEMatch(arb, candidateFilter);
	
	// Transform each matching IIFE by replacing it with its return value
	for (let i = 0; i < matches.length; i++) {
		arb = replaceFunctionShellsWithWrappedValueIIFETransform(arb, matches[i]);
	}
	
	return arb;
}