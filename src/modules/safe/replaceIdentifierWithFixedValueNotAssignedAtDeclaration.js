import {areReferencesModified} from '../utils/areReferencesModified.js';
import {getMainDeclaredObjectOfMemberExpression} from '../utils/getMainDeclaredObjectOfMemberExpression.js';

const FOR_STATEMENT_REGEX = /For.*Statement/;

/**
 * Check if a reference is used in a for-loop left side (iterator variable).
 *
 * This prevents replacement of variables that are loop iterators, such as:
 * let a; for (a in obj) { ... } or for (a of arr) { ... }
 *
 * @param {Object} ref - The reference node to check
 * @return {boolean} True if reference is a for-loop iterator
 */
function isForLoopIterator(ref) {
	return FOR_STATEMENT_REGEX.test(ref.parentNode.type) && ref.parentKey === 'left';
}

/**
 * Check if a reference is within a conditional expression context.
 *
 * This prevents replacement in complex conditional scenarios like:
 * let a; b === c ? (b++, a = 1) : a = 2
 * where the assignment context matters for execution flow.
 *
 * @param {Object} ref - The reference node to check
 * @return {boolean} True if reference is in conditional context
 */
function isInConditionalContext(ref) {
	// Check up to 3 levels up the AST for ConditionalExpression
	let currentNode = ref.parentNode;
	for (let depth = 0; depth < 3 && currentNode; depth++) {
		if (currentNode.type === 'ConditionalExpression') {
			return true;
		}
		currentNode = currentNode.parentNode;
	}
	return false;
}

/**
 * Get the single assignment reference for an identifier.
 *
 * Finds the one reference that assigns a value to the identifier after
 * its declaration. Returns null if there isn't exactly one assignment.
 *
 * @param {Object} n - The identifier node
 * @return {Object|null} The assignment reference or null
 */
function getSingleAssignmentReference(n) {
	if (!n.references) return null;
	
	const assignmentRefs = n.references.filter(r =>
		r.parentNode.type === 'AssignmentExpression' &&
		getMainDeclaredObjectOfMemberExpression(r.parentNode.left) === r
	);
	
	return assignmentRefs.length === 1 ? assignmentRefs[0] : null;
}

/**
 * Find all identifiers declared without initialization that have exactly one
 * literal assignment afterwards and are safe to replace.
 *
 * This function identifies variables that follow the pattern:
 * let a; a = 3; // later uses of 'a' can be replaced with 3
 *
 * Algorithm:
 * 1. Find all Identifier nodes in the AST
 * 2. Check if identifier is declared without initial value
 * 3. Verify exactly one assignment to a literal value exists
 * 4. Ensure no unsafe usage patterns (for-loops, conditionals)
 * 5. Apply candidate filter for additional constraints
 *
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {ASTNode[]} Array of identifier nodes that can be safely replaced
 */
export function replaceIdentifierWithFixedValueNotAssignedAtDeclarationMatch(arb, candidateFilter = () => true) {
	// Direct access to typeMap without spread operator for better performance
	const relevantNodes = arb.ast[0].typeMap.Identifier;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Optimized condition ordering: cheapest checks first for better performance
		if (candidateFilter(n) &&
			n.parentNode?.type === 'VariableDeclarator' &&
			!n.parentNode.init && // Variable declared without initial value
			n.references) {
			
			// Check for exactly one assignment to a literal value
			const assignmentRef = getSingleAssignmentReference(n);
			if (assignmentRef && assignmentRef.parentNode.right.type === 'Literal') {
				
				// Ensure no unsafe usage patterns exist
				const hasUnsafeReferences = n.references.some(r =>
					isForLoopIterator(r) || isInConditionalContext(r)
				);
				
				if (!hasUnsafeReferences) {
					matches.push(n);
				}
			}
		}
	}
	
	return matches;
}

/**
 * Transform identifier references by replacing them with their assigned literal values.
 *
 * This function takes an identifier that was declared without initialization but
 * later assigned a literal value, and replaces all safe references with that value.
 * The assignment itself is preserved.
 *
 * @param {Arborist} arb - The arborist instance to modify
 * @param {Object} n - The identifier node whose references should be replaced
 * @return {Arborist} The modified arborist instance
 */
export function replaceIdentifierWithFixedValueNotAssignedAtDeclarationTransform(arb, n) {
	// Get the single assignment reference (validated in match function)
	const assignmentRef = getSingleAssignmentReference(n);
	const valueNode = assignmentRef.parentNode.right;
	
	// Get all references except the assignment itself
	const referencesToReplace = n.references.filter(r => r !== assignmentRef);
	
	// Additional safety check: ensure references aren't modified in complex ways
	if (!areReferencesModified(arb.ast, referencesToReplace)) {
		for (let i = 0; i < referencesToReplace.length; i++) {
			const ref = referencesToReplace[i];
			
			// Skip function calls where identifier is the callee
			// Example: let func; func = someFunction; func(); // Don't replace func()
			if (ref.parentNode.type === 'CallExpression' && ref.parentKey === 'callee') {
				continue;
			}
			
			// Replace the reference with the literal value
			arb.markNode(ref, valueNode);
		}
	}
	
	return arb;
}

/**
 * Replace identifier references with their fixed assigned values when safe to do so.
 *
 * This transformation handles variables that are declared without initialization
 * but are later assigned a single literal value and never modified afterwards.
 * It replaces all safe references to such variables with their literal values.
 *
 * Examples:
 * - let a; a = 3; console.log(a); → let a; a = 3; console.log(3);
 * - let x; x = "hello"; alert(x); → let x; x = "hello"; alert("hello");
 *
 * Safety constraints:
 * - Only works with exactly one assignment to a literal value
 * - Skips variables used as for-loop iterators
 * - Avoids replacement in complex conditional contexts
 * - Preserves function calls where variable is the callee
 *
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Arborist} The modified arborist instance
 */
export default function replaceIdentifierWithFixedValueNotAssignedAtDeclaration(arb, candidateFilter = () => true) {
	// Find all matching identifier nodes
	const matches = replaceIdentifierWithFixedValueNotAssignedAtDeclarationMatch(arb, candidateFilter);
	
	// Transform each matching node
	for (let i = 0; i < matches.length; i++) {
		arb = replaceIdentifierWithFixedValueNotAssignedAtDeclarationTransform(arb, matches[i]);
	}
	
	return arb;
}