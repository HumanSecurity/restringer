import {logger} from 'flast';

const MIN_ARRAY_LENGTH = 20;

/**
 * Validates if a property access represents a valid numeric array index.
 * 
 * Checks that the property is a literal, represents a valid integer,
 * and is within the bounds of the array. Non-numeric properties like
 * 'length' or 'indexOf' are excluded.
 * 
 * @param {Object} memberExpr - The MemberExpression node
 * @param {number} arrayLength - Length of the array being accessed
 * @return {boolean} True if this is a valid numeric index access
 */
function isValidArrayIndex(memberExpr, arrayLength) {
	if (!memberExpr.property || memberExpr.property.type !== 'Literal') {
		return false;
	}
	
	const value = memberExpr.property.value;
	
	// Must be a number (not string like 'indexOf' or 'length')
	if (typeof value !== 'number') {
		return false;
	}
	
	// Must be a valid integer within array bounds
	const index = Math.floor(value);
	return index >= 0 && index < arrayLength && index === value;
}

/**
 * Checks if a reference is a valid candidate for array index resolution.
 * 
 * Valid candidates are MemberExpression nodes that:
 * 1. Are not on the left side of assignments (not being modified)
 * 2. Have numeric literal properties within array bounds
 * 3. Are not accessing array methods or properties
 * 
 * @param {Object} ref - Reference node to check
 * @param {number} arrayLength - Length of the array being accessed
 * @return {boolean} True if reference can be resolved to array element
 */
function isResolvableReference(ref, arrayLength) {
	// Must be a member expression (array[index] access)
	if (ref.type !== 'MemberExpression') {
		return false;
	}
	
	// Skip if this reference is being assigned to (left side of assignment)
	if (ref.parentNode.type === 'AssignmentExpression' && ref.parentKey === 'left') {
		return false;
	}
	
	// Must be a valid numeric array index
	return isValidArrayIndex(ref, arrayLength);
}

/**
 * Identifies VariableDeclarator nodes with large array initializers that can have their references resolved.
 * 
 * A variable declarator is a candidate when:
 * 1. It's initialized with an ArrayExpression
 * 2. The array has more than MIN_ARRAY_LENGTH elements (performance threshold)
 * 3. The identifier has references that can be resolved
 * 4. It passes the candidate filter
 * 
 * Large arrays are targeted because this optimization is most beneficial for
 * obfuscated code that uses large lookup tables.
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {Array} Array of VariableDeclarator nodes that can be processed
 */
export function resolveMemberExpressionReferencesToArrayIndexMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.VariableDeclarator || [];
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Must be array initialization with sufficient length
		if (!n.init || 
			n.init.type !== 'ArrayExpression' ||
			n.init.elements.length <= MIN_ARRAY_LENGTH) {
			continue;
		}
		
		// Must have identifier with references to resolve
		if (!n.id || !n.id.references || n.id.references.length === 0) {
			continue;
		}
		
		if (candidateFilter(n)) {
			matches.push(n);
		}
	}
	
	return matches;
}

/**
 * Transforms array index references into their literal values.
 * 
 * For each reference to the array variable, if it's a valid numeric index access,
 * replace the member expression with the corresponding array element.
 * 
 * This transformation is safe because:
 * - Only literal numeric indices are replaced
 * - Array bounds are validated
 * - Assignment targets are excluded
 * 
 * @param {Arborist} arb - The Arborist instance to mark changes on
 * @param {Object} n - The VariableDeclarator node with array initialization
 * @return {Arborist} The modified Arborist instance
 */
export function resolveMemberExpressionReferencesToArrayIndexTransform(arb, n) {
	const arrayElements = n.init.elements;
	const arrayLength = arrayElements.length;
	
	// Get parent nodes of all references (the actual member expressions)
	const memberExpressions = [];
	for (let i = 0; i < n.id.references.length; i++) {
		memberExpressions.push(n.id.references[i].parentNode);
	}
	
	// Process each member expression reference
	for (let i = 0; i < memberExpressions.length; i++) {
		const memberExpr = memberExpressions[i];
		
		if (isResolvableReference(memberExpr, arrayLength)) {
			const index = memberExpr.property.value;
			const arrayElement = arrayElements[index];
			
			// Only replace if the array element exists (handle sparse arrays)
			if (arrayElement) {
				try {
					arb.markNode(memberExpr, arrayElement);
				} catch (e) {
					logger.debug(`[-] Unable to mark node for replacement: ${e}`);
				}
			}
		}
	}
	
	return arb;
}

/**
 * Resolve member expressions to their targeted index in an array.
 * 
 * This transformation replaces array index access with the literal values
 * for large arrays (> 20 elements). This is particularly useful for deobfuscating
 * code that uses large lookup tables.
 * 
 * Example transformation:
 *   Input:  const a = [1, 2, 3, ...]; b = a[0]; c = a[2];
 *   Output: const a = [1, 2, 3, ...]; b = 1; c = 3;
 * 
 * Only safe transformations are performed:
 * - Numeric literal indices only
 * - Within array bounds
 * - Not modifying assignments
 * - Array methods/properties excluded
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST to transform
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Arborist} The modified Arborist instance
 */
export default function resolveMemberExpressionReferencesToArrayIndex(arb, candidateFilter = () => true) {
	const matches = resolveMemberExpressionReferencesToArrayIndexMatch(arb, candidateFilter);
	
	for (let i = 0; i < matches.length; i++) {
		arb = resolveMemberExpressionReferencesToArrayIndexTransform(arb, matches[i]);
	}
	
	return arb;
}