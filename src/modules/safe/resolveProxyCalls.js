/**
 * Checks if a function contains only a single return statement with no other code.
 * 
 * A proxy function candidate must have exactly one statement in its body,
 * and that statement must be a return statement. This ensures the function
 * doesn't perform any side effects beyond passing through arguments.
 * 
 * @param {Object} funcNode - The FunctionDeclaration node to check
 * @return {boolean} True if function has only a return statement
 */
function hasOnlyReturnStatement(funcNode) {
	if (!funcNode.body || 
		!funcNode.body.body || 
		funcNode?.body?.body?.length !== 1) {
		return false;
	}
	
	return funcNode?.body?.body[0]?.type === 'ReturnStatement';
}

/**
 * Validates that parameter names are passed through in the same order to the target function.
 * 
 * For a valid proxy function, each parameter must be passed to the target function
 * in the exact same order and position. This ensures the proxy doesn't modify,
 * reorder, or omit any arguments.
 * 
 * @param {Array} params - Function parameters array
 * @param {Array} callArgs - Arguments passed to the target function call
 * @return {boolean} True if all parameters are passed through correctly
 */
function areParametersPassedThrough(params, callArgs) {
	// Must have same number of parameters and arguments
	if (!params || !callArgs || params.length !== callArgs.length) {
		return false;
	}
	
	// Each parameter must match corresponding argument by name
	for (let i = 0; i < params.length; i++) {
		const param = params[i];
		const arg = callArgs[i];
		
		// Both must be identifiers with matching names
		if (param?.type !== 'Identifier' ||
			arg?.type !== 'Identifier' ||
			param?.name !== arg?.name) {
			return false;
		}
	}
	
	return true;
}

/**
 * Identifies FunctionDeclaration nodes that act as proxy calls to other functions.
 * 
 * A proxy function is one that:
 * 1. Contains only a single return statement
 * 2. Returns a call expression
 * 3. The call target is an identifier (not a complex expression)
 * 4. All parameters are passed through to the target in the same order
 * 5. No parameters are modified, reordered, or omitted
 * 
 * This pattern is common in obfuscated code where simple wrapper functions
 * are used to indirect function calls.
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {Array} Array of objects with funcNode, targetCallee, and references
 */
export function resolveProxyCallsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.FunctionDeclaration;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Must pass the candidate filter
		if (!candidateFilter(n)) {
			continue;
		}
		
		// Must have only a return statement
		if (!hasOnlyReturnStatement(n)) {
			continue;
		}
		
		const returnStmt = n.body.body[0];
		const returnArg = returnStmt.argument;
		
		// Must return a call expression
		if (returnArg?.type !== 'CallExpression') {
			continue;
		}
		
		// Call target must be a simple identifier
		if (returnArg.callee?.type !== 'Identifier') {
			continue;
		}
		
		// Must have a function name with references to replace
		if (!n.id?.references?.length) {
			continue;
		}
		
		// All parameters must be passed through correctly
		if (!areParametersPassedThrough(n.params, returnArg.arguments)) {
			continue;
		}
		
		matches.push({
			funcNode: n,
			targetCallee: returnArg.callee,
			references: n.id.references
		});
	}
	
	return matches;
}

/**
 * Transforms proxy function calls by replacing them with direct calls to the target function.
 * 
 * For each reference to the proxy function, replaces it with a reference to the
 * target function that the proxy was calling. This eliminates the unnecessary
 * indirection and simplifies the call chain.
 * 
 * @param {Arborist} arb - The Arborist instance to mark changes on
 * @param {Object} match - Match object containing funcNode, targetCallee, and references
 * @return {Arborist} The modified Arborist instance
 */
export function resolveProxyCallsTransform(arb, match) {
	const {targetCallee, references} = match;
	
	// Replace each reference to the proxy function with the target function
	for (let i = 0; i < references.length; i++) {
		arb.markNode(references[i], targetCallee);
	}
	
	return arb;
}

/**
 * Remove redundant call expressions which only pass the arguments to other call expression.
 * 
 * This transformation identifies proxy functions that simply pass their arguments
 * to another function and replaces calls to the proxy with direct calls to the target.
 * This is particularly useful for deobfuscating code that uses wrapper functions
 * to indirect function calls.
 * 
 * Example transformation:
 *   Input:  function call2(c, d) { return call1(c, d); } call2(1, 2);
 *   Output: function call2(c, d) { return call1(c, d); } call1(1, 2);
 * 
 * Safety constraints:
 * - Only processes functions with single return statements
 * - Target must be a simple identifier (not complex expression)
 * - All parameters must be passed through in exact order
 * - No parameter modification, reordering, or omission allowed
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST to transform
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Arborist} The modified Arborist instance
 */
export default function resolveProxyCalls(arb, candidateFilter = () => true) {
	const matches = resolveProxyCallsMatch(arb, candidateFilter);
	
	for (let i = 0; i < matches.length; i++) {
		arb = resolveProxyCallsTransform(arb, matches[i]);
	}
	
	return arb;
}