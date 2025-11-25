/**
 * Gets the property name from a MemberExpression, handling both computed and non-computed access.
 * 
 * For computed access (obj['prop']), uses the value of the property only if it's a literal.
 * For non-computed access (obj.prop), uses the name of the property.
 * 
 * This function is conservative about computed access - it only resolves when the property
 * is a direct literal, not a variable that happens to have a literal value.
 * 
 * @param {ASTNode} memberExpr - The MemberExpression node
 * @return {string|number|null} The property name/value, or null if not determinable
 */
function getPropertyName(memberExpr) {
	if (!memberExpr.property) {
		return null;
	}
	
	if (memberExpr.computed) {
		// For computed access, only allow direct literals like obj['prop'] or obj[0]
		// Do not allow variables like obj[key] even if key has a literal value
		if (memberExpr.property.type === 'Literal') {
			return memberExpr.property.value;
		} else {
			// Conservative approach: don't resolve computed access with variables
			return null;
		}
	} else {
		// For dot notation access like obj.prop
		return memberExpr.property.name;
	}
}

/**
 * Checks if a member expression reference represents a modification (assignment or update).
 * 
 * Identifies cases where the member expression is being modified rather than read:
 * - Assignment expressions where the member expression is on the left side
 * - Update expressions like ++obj.prop or obj.prop++
 * 
 * @param {ASTNode} memberExpr - The MemberExpression node to check
 * @return {boolean} True if this is a modification, false if it's a read access
 */
function isModifyingReference(memberExpr) {
	const parent = memberExpr.parentNode;
	
	if (!parent) {
		return false;
	}
	
	// Check for update expressions (++obj.prop, obj.prop++, --obj.prop, obj.prop--)
	if (parent.type === 'UpdateExpression') {
		return true;
	}
	
	// Check for assignment expressions where member expression is on the left side
	if (parent.type === 'AssignmentExpression' && memberExpr.parentKey === 'left') {
		return true;
	}
	
	return false;
}

/**
 * Finds all references to a specific property on an object that can be replaced with a literal value.
 * 
 * Searches through all references to the object's declaration and identifies member expressions
 * that access the same property. Excludes references that modify the property to ensure
 * the transformation is safe.
 * 
 * @param {ASTNode} objectDeclNode - The declaration node of the object
 * @param {string|number} propertyName - The name/value of the property to find
 * @param {Object} assignmentMemberExpr - The original assignment member expression to exclude
 * @return {Object[]} Array of reference nodes that can be replaced
 */
function findReplaceablePropertyReferences(objectDeclNode, propertyName, assignmentMemberExpr) {
	const replaceableRefs = [];
	
	if (!objectDeclNode.references) {
		return replaceableRefs;
	}
	
	for (let i = 0; i < objectDeclNode.references.length; i++) {
		const ref = objectDeclNode.references[i];
		const memberExpr = ref.parentNode;
		
		// Skip if not a member expression or if it's the original assignment
		if (!memberExpr || 
			memberExpr.type !== 'MemberExpression' || 
			memberExpr === assignmentMemberExpr) {
			continue;
		}
		
		// Check if this member expression accesses the same property
		const refPropertyName = getPropertyName(memberExpr);
		if (refPropertyName !== propertyName) {
			continue;
		}
		
		// Don't replace any reference if any of them are modifying the property
		if (isModifyingReference(memberExpr)) {
			return [];
		}
		
		if (ref.scope !== assignmentMemberExpr.scope) {
			return [];
		}
		
		replaceableRefs.push(ref);
	}
	
	return replaceableRefs;
}

/**
 * Identifies MemberExpression nodes that are being assigned literal values and can have their references resolved.
 * 
 * A member expression is a candidate when:
 * 1. It's on the left side of an assignment expression
 * 2. The right side is a literal value
 * 3. The object has a declaration node with references
 * 4. There are other references to the same property that can be replaced
 * 5. No references modify the property (ensuring safe transformation)
 * 
 * This transformation is useful for resolving simple object property assignments
 * like `obj.prop = 'value'` where `obj.prop` is later accessed.
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {Object[]} Array of objects with memberExpr, propertyName, replacementNode, and references
 */
export function resolveMemberExpressionsWithDirectAssignmentMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.MemberExpression;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Must be a member expression with an object that has a declaration
		if (!n.object || !n.object.declNode) {
			continue;
		}
		
		// Must be on the left side of an assignment expression
		if (!n.parentNode || 
			n.parentNode.type !== 'AssignmentExpression' || 
			n.parentKey !== 'left') {
			continue;
		}
		
		// The assigned value must be a literal
		if (!n.parentNode.right || n.parentNode.right.type !== 'Literal') {
			continue;
		}
		
		// Must pass the candidate filter
		if (!candidateFilter(n)) {
			continue;
		}
		
		const propertyName = getPropertyName(n);
		if (propertyName === null) {
			continue;
		}
		
		// Find all references to this property that can be replaced
		const replaceableRefs = findReplaceablePropertyReferences(
			n.object.declNode, 
			propertyName, 
			n
		);
		
		// Only add as candidate if there are references to replace
		if (replaceableRefs.length) {
			matches.push({
				memberExpr: n,
				propertyName: propertyName,
				replacementNode: n.parentNode.right,
				references: replaceableRefs
			});
		}
	}
	
	return matches;
}

/**
 * Transforms member expression references by replacing them with their assigned literal values.
 * 
 * For each match, replaces all found references to the property with the literal value
 * that was assigned to it. This is safe because the match function ensures no
 * modifications occur to the property after assignment.
 * 
 * @param {Arborist} arb - The Arborist instance to mark changes on
 * @param {Object} match - Match object containing memberExpr, propertyName, replacementNode, and references
 * @return {Arborist} The modified Arborist instance
 */
export function resolveMemberExpressionsWithDirectAssignmentTransform(arb, match) {
	const {replacementNode, references} = match;
	
	// Replace each reference with the literal value
	for (let i = 0; i < references.length; i++) {
		const ref = references[i];
		const memberExpr = ref.parentNode;
		
		if (memberExpr && memberExpr.type === 'MemberExpression') {
			arb.markNode(memberExpr, replacementNode);
		}
	}
	
	return arb;
}

/**
 * Resolve the value of member expressions to objects which hold literals that were directly assigned to the expression.
 * 
 * This transformation replaces property access with literal values when the property
 * has been directly assigned a literal value and is not modified elsewhere.
 * 
 * Example transformation:
 *   Input:  function a() {} a.b = 3; a.c = '5'; console.log(a.b + a.c);
 *   Output: function a() {} a.b = 3; a.c = '5'; console.log(3 + '5');
 * 
 * Safety constraints:
 * - Only replaces when assigned value is a literal
 * - Skips if property is modified (assigned or updated) elsewhere
 * - Ensures all references are read-only accesses
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST to transform
 * @param {Function} [candidateFilter] - Optional filter to apply on candidates
 * @return {Arborist} The modified Arborist instance
 */
export default function resolveMemberExpressionsWithDirectAssignment(arb, candidateFilter = () => true) {
	const matches = resolveMemberExpressionsWithDirectAssignmentMatch(arb, candidateFilter);
	
	for (let i = 0; i < matches.length; i++) {
		arb = resolveMemberExpressionsWithDirectAssignmentTransform(arb, matches[i]);
	}
	
	return arb;
}