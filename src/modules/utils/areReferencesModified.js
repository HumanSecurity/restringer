import {PROPERTIES_THAT_MODIFY_CONTENT} from '../config.js';



// AST node types that indicate potential modification
const ASSIGNMENT_TYPES = ['AssignmentExpression', 'ForInStatement', 'ForOfStatement', 'ForAwaitStatement'];

/**
 * Checks if a member expression reference matches an assignment target.
 * Handles cases like obj.prop = value where obj.prop is being assigned to.
 * @param {ASTNode} memberExpr - The member expression reference to check
 * @param {ASTNode[]} assignmentExpressions - Array of assignment expressions to check against
 * @return {boolean} True if the member expression is being assigned to
 */
function isMemberExpressionAssignedTo(memberExpr, assignmentExpressions) {
	for (let i = 0; i < assignmentExpressions.length; i++) {
		const assignment = assignmentExpressions[i];
		if (assignment.left.type !== 'MemberExpression') continue;
		
		const leftObj = assignment.left.object;
		const rightObj = memberExpr.object;
		
		// Compare object identities - both should refer to the same declared node
		const leftDeclNode = leftObj.declNode || leftObj;
		const rightDeclNode = rightObj.declNode || rightObj;
		
		if (leftDeclNode !== rightDeclNode) continue;
		
		// Compare property names/values
		const leftProp = assignment.left.property?.name || assignment.left.property?.value;
		const rightProp = memberExpr.property?.name || memberExpr.property?.value;
		
		if (leftProp === rightProp) return true;
	}
	return false;
}

/**
 * Checks if a reference is used as the target of a delete operation.
 * E.g. delete obj.prop, delete arr[index] 
 * @param {ASTNode} ref - The reference to check
 * @return {boolean} True if the reference is being deleted
 */
function isReferenceDeleted(ref) {
	// Direct deletion: delete ref
	if (ref.parentNode.type === 'UnaryExpression' && 
		ref.parentNode.operator === 'delete' && 
		ref.parentNode.argument === ref) {
		return true;
	}
	
	// Member expression deletion: delete obj.prop, delete arr[index]
	if (ref.parentNode.type === 'MemberExpression' && 
		ref.parentKey === 'object' &&
		ref.parentNode.parentNode.type === 'UnaryExpression' && 
		ref.parentNode.parentNode.operator === 'delete') {
		return true;
	}
	
	return false;
}

/**
 * Checks if a reference is part of a destructuring pattern that could modify the original.
 * E.g. const {prop} = obj; prop = newValue; (modifies the destructured value, not obj)
 * Note: This is a conservative check - actual modification depends on usage.
 * @param {ASTNode} ref - The reference to check
 * @return {boolean} True if the reference is in a destructuring context
 */
function isInDestructuringPattern(ref) {
	let current = ref;
	while (current.parentNode) {
		if (['ObjectPattern', 'ArrayPattern'].includes(current.parentNode.type)) {
			return true;
		}
		current = current.parentNode;
	}
	return false;
}

/**
 * Checks if a reference is used in an increment/decrement operation.
 * E.g. ++ref, ref++, --ref, ref--, ++obj.prop, obj.prop++
 * @param {ASTNode} ref - The reference to check
 * @return {boolean} True if the reference is being incremented/decremented
 */
function isReferenceIncremented(ref) {
	// Direct increment: ++ref, ref++, --ref, ref--
	if (ref.parentNode.type === 'UpdateExpression' && ref.parentNode.argument === ref) {
		return true;
	}
	
	// Member expression increment: ++obj.prop, obj.prop++
	if (ref.parentNode.type === 'MemberExpression' && 
		ref.parentKey === 'object' &&
		ref.parentNode.parentNode.type === 'UpdateExpression' && 
		ref.parentNode.parentNode.argument === ref.parentNode) {
		return true;
	}
	
	return false;
}

/**
 * Determines if any of the given references are potentially modified in ways that would
 * make code transformations unsafe. This function performs comprehensive checks for various
 * modification patterns including assignments, method calls, destructuring, and more.
 * 
 * Critical for safe transformations: if this returns true, the variable/object should not
 * be replaced or transformed as its value may change during execution.
 * 
 * @param {ASTNode[]} ast - The AST array (expects ast[0] to contain typeMap)
 * @param {ASTNode[]} refs - Array of reference nodes to analyze for modifications
 * @return {boolean} True if any reference might be modified, false if all are safe to transform
 * 
 * @example
 * // Safe cases (returns false):
 * const arr = [1, 2, 3]; const x = arr[0];        // No modification
 * const obj = {a: 1}; console.log(obj.a);        // Read-only access
 * 
 * @example  
 * // Unsafe cases (returns true):
 * const arr = [1, 2, 3]; arr[0] = 5;              // Direct assignment
 * const obj = {a: 1}; obj.a = 2;                  // Property assignment
 * const arr = [1, 2, 3]; arr.push(4);            // Mutating method call
 * let x = 1; x++;                                 // Increment operation
 * const obj = {a: 1}; delete obj.a;              // Delete operation
 */
export function areReferencesModified(ast, refs) {
	if (!refs.length) return false;
	
	// Cache assignment expressions for performance
	const assignmentExpressions = ast[0].typeMap.AssignmentExpression || [];
	
	for (let i = 0; i < refs.length; i++) {
		const ref = refs[i];
		
		// Check for direct assignment: ref = value, ref += value, etc.
		if (ref.parentKey === 'left' && ASSIGNMENT_TYPES.includes(ref.parentNode.type)) {
			return true;
		}
		
		// Check for for-in/for-of/for-await with member expression: for (obj.prop in/of/await ...)
		if (ref.parentNode.type === 'MemberExpression' && 
			ref.parentKey === 'object' &&
			ref.parentNode.parentKey === 'left' &&
			['ForInStatement', 'ForOfStatement', 'ForAwaitStatement'].includes(ref.parentNode.parentNode.type)) {
			return true;
		}
		
		// Check for increment/decrement: ++ref, ref++, --ref, ref--
		if (isReferenceIncremented(ref)) {
			return true;
		}
		
		// Check for variable redeclaration in subscope: const ref = ...
		if (ref.parentNode.type === 'VariableDeclarator' && ref.parentKey === 'id') {
			return true;
		}
		
		// Check for delete operations: delete ref, delete obj.prop
		if (isReferenceDeleted(ref)) {
			return true;
		}
		
		// Check for destructuring patterns (conservative approach)
		if (isInDestructuringPattern(ref)) {
			return true;
		}
		
		// Check for member expression modifications: obj.method(), obj.prop = value
		if (ref.parentNode.type === 'MemberExpression') {
			const memberExpr = ref.parentNode;
			const grandParent = memberExpr.parentNode;
			
			// Check for mutating method calls: arr.push(), obj.sort()
			if (grandParent.type === 'CallExpression' && 
				grandParent.callee === memberExpr &&
				memberExpr.object === ref) {
				const methodName = memberExpr.property?.value || memberExpr.property?.name;
				if (PROPERTIES_THAT_MODIFY_CONTENT.includes(methodName)) {
					return true;
				}
			}
			
			// Check for property assignments: obj.prop = value
			if (grandParent.type === 'AssignmentExpression' && 
				memberExpr.parentKey === 'left') {
				return true;
			}
		}
		
		// Check for member expressions being assigned to: complex cases like nested.prop = value
		if (ref.type === 'MemberExpression' && 
			isMemberExpressionAssignedTo(ref, assignmentExpressions)) {
			return true;
		}
	}
	
	return false;
}