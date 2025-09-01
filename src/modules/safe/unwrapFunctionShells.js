const FUNCTION_TYPES = ['FunctionDeclaration', 'FunctionExpression'];

/**
 * Gets the property name from a member expression property.
 * 
 * @param {ASTNode} property - The property node from MemberExpression
 * @return {string} The property name or an empty string if not extractable
 */
function getPropertyName(property) {
	return property?.name || property?.value || '';
}

/**
 * Creates a replacement function by transferring outer function properties to inner function.
 * 
 * Preserves the inner function while adding:
 * - Outer function's identifier if inner function is anonymous
 * - Outer function's parameters if inner function has no parameters
 * 
 * @param {ASTNode} outerFunction - The outer function shell to unwrap
 * @param {ASTNode} innerFunction - The inner function to enhance
 * @return {ASTNode} The enhanced inner function node
 */
function createUnwrappedFunction(outerFunction, innerFunction) {
	const replacementNode = { ...innerFunction };
	
	// Transfer identifier from outer function if inner function is anonymous
	if (outerFunction.id && !replacementNode.id) {
		replacementNode.id = outerFunction.id;
	}
	
	// Transfer parameters from outer function if inner function has no parameters
	if (outerFunction.params.length && !replacementNode.params.length) {
		replacementNode.params = outerFunction.params.slice();
	}
	
	return replacementNode;
}

/**
 * Finds function shells that can be unwrapped.
 * 
 * Identifies functions that:
 * - Only contain a single return statement
 * - Return the result of calling another function with .apply(this, arguments)
 * - Have a FunctionExpression as the callee object
 * 
 * Pattern: `function outer() { return inner().apply(this, arguments); }`
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {ASTNode[]} Array of function nodes that can be unwrapped
 */
export function unwrapFunctionShellsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.FunctionExpression
							.concat(arb.ast[0].typeMap.FunctionDeclaration);
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		if (!candidateFilter(n) || 
			!FUNCTION_TYPES.includes(n.type) ||
			n.body?.body?.length !== 1) {
			continue;
		}
		
		const returnStmt = n.body.body[0];
		if (returnStmt?.type !== 'ReturnStatement') {
			continue;
		}
		
		const callExpr = returnStmt.argument;
		if (callExpr?.type !== 'CallExpression' ||
			callExpr.arguments?.length !== 2 ||
			callExpr.callee?.type !== 'MemberExpression' ||
			callExpr.callee.object?.type !== 'FunctionExpression') {
			continue;
		}
		
		const propertyName = getPropertyName(callExpr.callee.property);
		if (propertyName === 'apply') {
			matches.push(n);
		}
	}
	
	return matches;
}

/**
 * Transforms a function shell by unwrapping it to reveal the inner function.
 * 
 * The transformation preserves the outer function's identifier and parameters
 * by transferring them to the inner function when appropriate.
 * 
 * @param {Arborist} arb - The Arborist instance to mark nodes for transformation
 * @param {ASTNode} n - The function shell node to unwrap
 * @return {Arborist} The Arborist instance for chaining
 */
export function unwrapFunctionShellsTransform(arb, n) {
	const innerFunction = n.body.body[0].argument.callee.object;
	const replacementNode = createUnwrappedFunction(n, innerFunction);
	
	arb.markNode(n, replacementNode);
	return arb;
}

/**
 * Remove functions which only return another function via .apply(this, arguments).
 * 
 * This optimization unwraps function shells that serve no purpose other than
 * forwarding calls to an inner function. The outer function's identifier and
 * parameters are preserved by transferring them to the inner function.
 * 
 * Transforms:
 * ```javascript
 * function outer(x) {
 *   return function inner() { return x + 3; }.apply(this, arguments);
 * }
 * ```
 * 
 * Into:
 * ```javascript
 * function inner(x) {
 *   return x + 3;
 * }
 * ```
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply to candidates
 * @return {Arborist} The Arborist instance for chaining
 */
export default function unwrapFunctionShells(arb, candidateFilter = () => true) {
	const matches = unwrapFunctionShellsMatch(arb, candidateFilter);
	
	for (let i = 0; i < matches.length; i++) {
		arb = unwrapFunctionShellsTransform(arb, matches[i]);
	}
	
	return arb;
}