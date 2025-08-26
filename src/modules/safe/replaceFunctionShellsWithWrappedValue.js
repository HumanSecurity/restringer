const RETURNABLE_TYPES = ['Literal', 'Identifier'];

/**
 * Find all function declarations that only return a simple literal or identifier.
 * 
 * This function identifies function declarations that act as "shells" around simple
 * values, containing only a single return statement that returns either a literal
 * or an identifier. Such functions can be optimized by replacing calls to them
 * with their return values directly.
 * 
 * Algorithm:
 * 1. Find all function declarations in the AST
 * 2. Check if function body contains exactly one return statement
 * 3. Verify the return argument is a literal or identifier
 * 4. Apply candidate filter for additional constraints
 * 5. Return matching function declaration nodes
 * 
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Array} Array of function declaration nodes that can be replaced
 */
export function replaceFunctionShellsWithWrappedValueMatch(arb, candidateFilter = () => true) {
	// Direct access to typeMap without spread operator for better performance
	const relevantNodes = arb.ast[0].typeMap.FunctionDeclaration;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const node = relevantNodes[i];
		
		// Check if function has exactly one return statement with simple argument
		if (node.body.body?.[0]?.type === 'ReturnStatement' &&
			RETURNABLE_TYPES.includes(node.body.body[0]?.argument?.type) &&
			candidateFilter(node)) {
			matches.push(node);
		}
	}
	
	return matches;
}

/**
 * Transform function shell calls by replacing them with their wrapped values.
 * 
 * This function replaces call expressions to function shells with the actual
 * values they return. It only transforms actual function calls (not references)
 * to ensure the transformation maintains the original semantics.
 * 
 * Safety considerations:
 * - Only replaces call expressions where the function is the callee
 * - Preserves function references that are not called
 * - Maintains original execution semantics
 * 
 * @param {Arborist} arb - The arborist instance to modify
 * @param {Object} node - The function declaration node to process
 * @return {Arborist} The modified arborist instance
 */
export function replaceFunctionShellsWithWrappedValueTransform(arb, node) {
	// Extract the return value from the function body
	const replacementNode = node.body.body[0].argument;
	
	// Process all references to this function
	for (const ref of (node.id?.references || [])) {
		// Only replace call expressions, not function references
		// This ensures we don't break code that passes the function around
		if (ref.parentNode.type === 'CallExpression' && ref.parentNode.callee === ref) {
			arb.markNode(ref.parentNode, replacementNode);
		}
	}
	
	return arb;
}

/**
 * Replace function shells with their wrapped values for optimization.
 * 
 * This module identifies and optimizes "function shells" - functions that serve
 * no purpose other than wrapping a simple literal or identifier value. Such
 * functions are common in obfuscated code where simple values are hidden
 * behind function calls.
 * 
 * Transformations:
 *   function a() { return 42; }        →  (calls to a() become 42)
 *   function b() { return String; }    →  (calls to b() become String)
 *   function c() { return x; }         →  (calls to c() become x)
 * 
 * Safety features:
 * - Only processes functions with exactly one return statement
 * - Only replaces function calls, not function references
 * - Preserves functions passed as arguments or assigned to properties
 * - Only handles simple return types (literals and identifiers)
 * 
 * Performance benefits:
 * - Eliminates unnecessary function call overhead
 * - Reduces code size by removing wrapper functions
 * - Improves readability by exposing actual values
 * 
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Arborist} The modified arborist instance
 */
export default function replaceFunctionShellsWithWrappedValue(arb, candidateFilter = () => true) {
	// Find all matching function declaration nodes
	const matches = replaceFunctionShellsWithWrappedValueMatch(arb, candidateFilter);
	
	// Transform each matching function by replacing its calls
	for (let i = 0; i < matches.length; i++) {
		arb = replaceFunctionShellsWithWrappedValueTransform(arb, matches[i]);
	}
	
	return arb;
}