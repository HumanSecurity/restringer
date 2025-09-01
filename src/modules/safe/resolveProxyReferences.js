import {areReferencesModified} from '../utils/areReferencesModified.js';
import {doesDescendantMatchCondition} from '../utils/doesDescendantMatchCondition.js';
import {getMainDeclaredObjectOfMemberExpression} from '../utils/getMainDeclaredObjectOfMemberExpression.js';

// Static array for supported node types to avoid recreation overhead
const SUPPORTED_REFERENCE_TYPES = ['Identifier', 'MemberExpression'];

// Static regex for detecting loop statements to avoid recreation overhead
const LOOP_STATEMENT_REGEX = /(For.*Statement|WhileStatement|DoWhileStatement)/;

/**
 * Checks if a variable declarator represents a proxy reference.
 * 
 * A proxy reference is a variable that simply points to another variable
 * without modification. For example: `const b = a;` where `b` is a proxy to `a`.
 * 
 * @param {Object} declaratorNode - The VariableDeclarator node to check
 * @return {boolean} True if this is a valid proxy reference pattern
 */
function isProxyReferencePattern(declaratorNode) {
	// The variable being declared must be an Identifier or MemberExpression
	if (!SUPPORTED_REFERENCE_TYPES.includes(declaratorNode.id?.type)) {
		return false;
	}
	
	// CRITICAL: The value being assigned must also be Identifier or MemberExpression
	// This prevents transforming cases like: const b = getValue(); where getValue() is a CallExpression
	if (!SUPPORTED_REFERENCE_TYPES.includes(declaratorNode.init?.type)) {
		return false;
	}
	
	// Avoid proxy variables in loop contexts (for, while, do-while)
	// This prevents breaking loop semantics where variables may be modified during iteration
	if (LOOP_STATEMENT_REGEX.test(declaratorNode.parentNode?.parentNode?.type)) {
		return false;
	}
	
	return true;
}

/**
 * Validates that a proxy reference replacement is safe to perform.
 * 
 * Ensures that replacing the proxy with its target won't create circular
 * references or other problematic scenarios. This includes checking for
 * self-references and ensuring the proxy variable isn't used in its own
 * initialization.
 * 
 * @param {Object} proxyIdentifier - The main identifier being proxied
 * @param {Object} replacementNode - The node that will replace the proxy
 * @return {boolean} True if the replacement is safe
 */
function isReplacementSafe(proxyIdentifier, replacementNode) {
	// Get the main identifier from the replacement to check for circular references
	const replacementMainIdentifier = getMainDeclaredObjectOfMemberExpression(replacementNode)?.declNode;
	
	// Prevent circular references: proxy can't point to itself
	// Example: const a = b; const b = a; (circular - not safe)
	if (replacementMainIdentifier && replacementMainIdentifier === proxyIdentifier) {
		return false;
	}
	
	// Prevent self-reference in initialization
	// Example: const a = someFunction(a); (not safe - uses itself in init)
	if (doesDescendantMatchCondition(replacementNode, n => n === proxyIdentifier)) {
		return false;
	}
	
	return true;
}



/**
 * Identifies VariableDeclarator nodes that represent proxy references to other variables.
 * 
 * A proxy reference is a variable declaration where the variable simply points to
 * another variable without any modification. This pattern is common in obfuscated
 * code to create indirection layers.
 * 
 * Examples of proxy references:
 *   const b = a;           // Simple identifier proxy
 *   const d = obj.prop;    // Member expression proxy
 *   const e = b;           // Chained proxy (b -> a, e -> b)
 * 
 * Safety constraints:
 * - Both variable and value must be Identifier or MemberExpression
 * - Not in For statement context (to avoid breaking loop semantics)
 * - No circular references allowed
 * - References must not be modified after declaration
 * - Target must not be modified either
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {Array} Array of objects with proxyNode, targetNode, and references
 */
export function resolveProxyReferencesMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.VariableDeclarator;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Must pass the candidate filter
		if (!candidateFilter(n)) {
			continue;
		}
		
		// Must follow the proxy reference pattern
		if (!isProxyReferencePattern(n)) {
			continue;
		}
		
		// Get the main identifier that will be replaced
		const proxyIdentifier = getMainDeclaredObjectOfMemberExpression(n.id)?.declNode || n.id;
		const refs = proxyIdentifier.references || [];
		
		// Must have references to replace
		if (!refs.length) {
			continue;
		}
		
		// Must be safe to replace
		if (!isReplacementSafe(proxyIdentifier, n.init)) {
			continue;
		}
		
		// Both the proxy and target must not be modified
		if (areReferencesModified(arb.ast, refs) || areReferencesModified(arb.ast, [n.init])) {
			continue;
		}
		
		matches.push({
			declaratorNode: n,
			proxyIdentifier,
			targetNode: n.init,
			references: refs
		});
	}
	
	return matches;
}

/**
 * Transforms proxy references by replacing them with direct references to their targets.
 * 
 * For each reference to the proxy variable, replaces it with the target node
 * that the proxy was pointing to. This eliminates unnecessary indirection
 * in the code.
 * 
 * @param {Arborist} arb - The Arborist instance to mark changes on
 * @param {Object} match - Match object containing proxyIdentifier, targetNode, and references
 * @return {Arborist} The modified Arborist instance
 */
export function resolveProxyReferencesTransform(arb, match) {
	const {targetNode, references} = match;
	
	// Replace each reference to the proxy with the target
	for (let i = 0; i < references.length; i++) {
		arb.markNode(references[i], targetNode);
	}
	
	return arb;
}

/**
 * Replace variables which only point at other variables and do not change, with their target.
 * 
 * This transformation identifies proxy references where a variable simply points to
 * another variable without modification and replaces all references to the proxy
 * with direct references to the target. This is particularly useful for deobfuscating
 * code that uses multiple layers of variable indirection.
 * 
 * Example transformation:
 *   Input:  const a = ['hello']; const b = a; const c = b[0];
 *   Output: const a = ['hello']; const b = a; const c = a[0];
 * 
 * Safety constraints:
 * - Only processes simple variable-to-variable assignments
 * - Avoids loop iterator variables to prevent breaking loop semantics
 * - Prevents circular references and self-references
 * - Ensures neither proxy nor target variables are modified after declaration
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST to transform
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Arborist} The modified Arborist instance
 */
export default function resolveProxyReferences(arb, candidateFilter = () => true) {
	const matches = resolveProxyReferencesMatch(arb, candidateFilter);
	
	for (let i = 0; i < matches.length; i++) {
		arb = resolveProxyReferencesTransform(arb, matches[i]);
	}
	
	return arb;
}