const CALL_APPLY_METHODS = ['apply', 'call'];

/**
 * Gets the property name from a non-computed member expression.
 * 
 * @param {ASTNode} memberExpr - The MemberExpression node
 * @return {string|null} The property name or null if computed/not extractable
 */
function getPropertyName(memberExpr) {
	// Only handle non-computed property access (obj.prop, not obj['prop'])
	if (memberExpr.computed) {
		return null;
	}
	return memberExpr.property?.name || null;
}

/**
 * Extracts arguments for the simplified call based on method type.
 * 
 * For 'apply': extracts elements from the array argument
 * For 'call': extracts arguments after the first (this) argument
 * 
 * @param {ASTNode} n - The CallExpression node
 * @param {string} methodName - Either 'apply' or 'call'
 * @return {ASTNode[]} Array of argument nodes for the simplified call
 */
function extractSimplifiedArguments(n, methodName) {
	if (methodName === 'apply') {
		// For apply: func.apply(this, [arg1, arg2]) -> get elements from array
		const arrayArg = n.arguments?.[1];
		return Array.isArray(arrayArg?.elements) ? arrayArg.elements : [];
	} else {
		// For call: func.call(this, arg1, arg2) -> get args after 'this'
		return n.arguments?.slice(1) || [];
	}
}

/**
 * Finds CallExpression nodes that use .call(this) or .apply(this) patterns.
 * 
 * Identifies function calls that can be simplified by removing unnecessary
 * .call(this) or .apply(this) wrappers when the context is 'this'.
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {ASTNode[]} Array of CallExpression nodes that can be simplified
 */
export function simplifyCallsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.CallExpression;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Must be a call/apply on a member expression with 'this' as first argument
		if (n.arguments?.[0]?.type !== 'ThisExpression' ||
			n.callee.type !== 'MemberExpression' ||
			!candidateFilter(n)) {
			continue;
		}
		
		const propertyName = getPropertyName(n.callee);
		
		// Must be 'apply' or 'call' method
		if (!CALL_APPLY_METHODS.includes(propertyName)) {
			continue;
		}
		
		// Exclude Function constructor calls and function expressions
		const objectName = n.callee.object?.name || n.callee?.value;
		if (objectName === 'Function' || /function/i.test(n.callee.object.type)) {
			continue;
		}
		
		matches.push(n);
	}
	
	return matches;
}

/**
 * Transforms a .call(this) or .apply(this) call into a direct function call.
 * 
 * Converts patterns like:
 * - func.call(this, arg1, arg2) -> func(arg1, arg2)
 * - func.apply(this, [arg1, arg2]) -> func(arg1, arg2)
 * - func.apply(this) -> func()
 * 
 * @param {Arborist} arb - The Arborist instance to mark nodes for transformation
 * @param {ASTNode} n - The CallExpression node to transform
 * @return {Arborist} The Arborist instance for chaining
 */
export function simplifyCallsTransform(arb, n) {
	const propertyName = getPropertyName(n.callee);
	const simplifiedArgs = extractSimplifiedArguments(n, propertyName);
	
	const simplifiedCall = {
		type: 'CallExpression',
		callee: n.callee.object,
		arguments: simplifiedArgs,
	};
	
	arb.markNode(n, simplifiedCall);
	return arb;
}

/**
 * Remove unnecessary usage of .call(this) or .apply(this) when calling a function.
 * 
 * This function simplifies function calls that use .call(this, ...) or .apply(this, [...])
 * by converting them to direct function calls, improving code readability and performance.
 * 
 * Examples:
 * - `func.call(this, arg1, arg2)` becomes `func(arg1, arg2)`
 * - `func.apply(this, [arg1, arg2])` becomes `func(arg1, arg2)`
 * - `func.apply(this)` becomes `func()`
 * - `func.call(this)` becomes `func()`
 * 
 * Restrictions:
 * - Only transforms calls where first argument is exactly 'this'
 * - Does not transform Function constructor calls
 * - Does not transform calls on function expressions
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} [candidateFilter] - Optional filter to apply to candidates
 * @return {Arborist} The Arborist instance for chaining
 */
export default function simplifyCalls(arb, candidateFilter = () => true) {
	const matches = simplifyCallsMatch(arb, candidateFilter);
	
	for (let i = 0; i < matches.length; i++) {
		arb = simplifyCallsTransform(arb, matches[i]);
	}
	
	return arb;
}