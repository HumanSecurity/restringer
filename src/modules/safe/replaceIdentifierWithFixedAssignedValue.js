import {areReferencesModified} from '../utils/areReferencesModified.js';

/**
 * Check if an identifier is a property name in an object expression.
 * 
 * This helper function determines if an identifier node is being used as a property
 * name in an object literal, which should not be replaced with its literal value
 * as that would change the object's structure.
 * 
 * @param {Object} n - The identifier node to check
 * @return {boolean} True if the identifier is a property name in an object expression
 */
function isObjectPropertyName(n) {
	return n.parentKey === 'property' && 
		   n.parentNode?.type === 'ObjectExpression';
}

/**
 * Find all identifiers with fixed literal assigned values that can be replaced.
 * 
 * This function identifies identifier nodes that:
 * - Have a declaration with a literal initializer (e.g., const x = 42)
 * - Are not used as property names in object expressions
 * - Have references that are not modified elsewhere in the code
 * 
 * Algorithm:
 * 1. Find all identifier nodes in the AST
 * 2. Check if they have a declaration with a literal init value
 * 3. Verify they're not object property names
 * 4. Ensure their references aren't modified
 * 5. Apply candidate filter for additional constraints
 * 6. Return matching identifier nodes
 * 
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} [candidateFilter] - Optional filter to apply on candidates
 * @return {ASTNode[]} Array of identifier nodes that can have their references replaced
 */
export function replaceIdentifierWithFixedAssignedValueMatch(arb, candidateFilter = () => true) {
	// Direct access to typeMap without spread operator for better performance
	const relevantNodes = arb.ast[0].typeMap.Identifier;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Optimized condition ordering: cheapest checks first for better performance
		// Added safety checks to prevent potential runtime errors
		if (candidateFilter(n) &&
			!isObjectPropertyName(n) &&
			n.declNode?.parentNode?.init?.type === 'Literal' &&
			n.declNode.references &&
			!areReferencesModified(arb.ast, n.declNode.references)) {
			matches.push(n);
		}
	}
	
	return matches;
}

/**
 * Transform identifier references by replacing them with their fixed literal values.
 * 
 * This function replaces all references to an identifier with its literal value,
 * effectively performing constant propagation optimization. It ensures that the
 * original declaration and its literal value are preserved while replacing only
 * the references.
 * 
 * @param {Arborist} arb - The arborist instance to modify
 * @param {Object} n - The identifier node whose references should be replaced
 * @return {Arborist} The modified arborist instance
 */
export function replaceIdentifierWithFixedAssignedValueTransform(arb, n) {
	// Extract the literal value from the declaration
	const valueNode = n.declNode.parentNode.init;
	const refs = n.declNode.references;
	
	// Replace all references with the literal value
	// Note: We use traditional for loop for better performance
	for (let i = 0; i < refs.length; i++) {
		arb.markNode(refs[i], valueNode);
	}
	
	return arb;
}

/**
 * Replace identifier references with their fixed assigned literal values.
 * 
 * This module performs constant propagation by identifying variables that are
 * assigned literal values and never modified, then replacing all references to
 * those variables with their literal values directly. This optimization improves
 * code readability and enables further optimizations.
 * 
 * Transformations:
 *   const x = 42; y = x + 1;          →  const x = 42; y = 42 + 1;
 *   let msg = "hello"; console.log(msg); →  let msg = "hello"; console.log("hello");
 *   var flag = true; if (flag) {...}  →  var flag = true; if (true) {...}
 * 
 * Safety features:
 * - Only processes identifiers with literal initializers
 * - Skips identifiers used as object property names to preserve structure
 * - Uses reference analysis to ensure variables are never modified
 * - Preserves original declaration for debugging and readability
 * 
 * Performance benefits:
 * - Eliminates variable lookups at runtime
 * - Enables further optimization opportunities (dead code elimination, etc.)
 * - Improves code clarity by making values explicit
 * - Reduces memory usage by eliminating variable references
 * 
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} [candidateFilter] - Optional filter to apply on candidates
 * @return {Arborist} The modified arborist instance
 */
export default function replaceIdentifierWithFixedAssignedValue(arb, candidateFilter = () => true) {
	// Find all matching identifier nodes
	const matches = replaceIdentifierWithFixedAssignedValueMatch(arb, candidateFilter);
	
	// Transform each matching identifier by replacing its references
	for (let i = 0; i < matches.length; i++) {
		arb = replaceIdentifierWithFixedAssignedValueTransform(arb, matches[i]);
	}
	return arb;
}