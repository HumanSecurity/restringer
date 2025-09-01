// Static arrays extracted outside functions to avoid recreation overhead
const FUNCTION_EXPRESSION_TYPES = ['FunctionExpression', 'ArrowFunctionExpression'];

/**
 * Find all call expressions that can be replaced with unwrapped identifiers.
 * 
 * This function identifies call expressions where the callee is a function that
 * only returns an identifier or a call expression with no arguments. Such calls
 * can be safely replaced with the returned value directly.
 * 
 * Algorithm:
 * 1. Find all CallExpression nodes in the AST
 * 2. Check if the callee references a function declaration or function expression
 * 3. Analyze the function body to determine if it only returns an identifier
 * 4. Return matching nodes for transformation
 * 
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {ASTNode[]} Array of call expression nodes that can be unwrapped
 */
export function replaceCallExpressionsWithUnwrappedIdentifierMatch(arb, candidateFilter = () => true) {
	// Direct access to typeMap without spread operator for better performance
	const relevantNodes = arb.ast[0].typeMap.CallExpression;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const node = relevantNodes[i];
		
		// Check if the callee references a function declaration or expression
		const calleeDecl = node.callee?.declNode;
		if (!calleeDecl || !candidateFilter(node)) continue;
		
		const parentNode = calleeDecl.parentNode;
		const parentType = parentNode?.type;
		
		// Check if callee is from a variable declarator with function expression
		const isVariableFunction = parentType === 'VariableDeclarator' &&
			FUNCTION_EXPRESSION_TYPES.includes(parentNode.init?.type);
		
		// Check if callee is from a function declaration
		const isFunctionDeclaration = parentType === 'FunctionDeclaration' &&
			calleeDecl.parentKey === 'id';
		
		if (isVariableFunction || isFunctionDeclaration) {
			matches.push(node);
		}
	}
	
	return matches;
}

/**
 * Transform call expressions by replacing them with their unwrapped identifiers.
 * 
 * This function analyzes the function body referenced by each call expression
 * and replaces the call with the identifier or call expression that the function
 * returns, effectively unwrapping the function shell.
 * 
 * @param {Arborist} arb - The arborist instance to modify
 * @param {Object} node - The call expression node to transform
 * @return {Arborist} The modified arborist instance
 */
export function replaceCallExpressionsWithUnwrappedIdentifierTransform(arb, node) {
	const calleeDecl = node.callee.declNode;
	const parentNode = calleeDecl.parentNode;
	
	// Get the function body (either from init for expressions or body for declarations)
	const declBody = parentNode.init?.body || parentNode.body;
	
	// Handle function bodies (arrow functions without blocks or block statements)
	if (!Array.isArray(declBody)) {
		// Case 1: Arrow function with direct return (no block statement)
		if (isUnwrappableExpression(declBody)) {
			// Mark all references to this function for replacement
			for (const ref of calleeDecl.references) {
				arb.markNode(ref.parentNode, declBody);
			}
		}
		// Case 2: Block statement with single return statement
		else if (declBody.type === 'BlockStatement' && 
			declBody.body.length === 1 && 
			declBody.body[0].type === 'ReturnStatement') {
			
			const returnArg = declBody.body[0].argument;
			if (isUnwrappableExpression(returnArg)) {
				arb.markNode(node, returnArg);
			}
		}
	}
	
	return arb;
}

/**
 * Check if an expression can be safely unwrapped.
 * 
 * An expression is unwrappable if it's:
 * - An identifier (variable reference)
 * - A call expression with no arguments
 * 
 * @param {Object} expr - The expression node to check
 * @return {boolean} True if the expression can be unwrapped
 */
function isUnwrappableExpression(expr) {
	return expr.type === 'Identifier' || 
		(expr.type === 'CallExpression' && !expr.arguments?.length);
}

/**
 * Replace call expressions with unwrapped identifiers when the called function
 * only returns an identifier or parameterless call expression.
 * 
 * This transformation removes unnecessary function wrappers that only return
 * simple values, effectively flattening the call chain for better readability
 * and potential performance improvements.
 * 
 * Examples:
 * - function a() {return String} a()(val) → String(val)
 * - const b = () => btoa; b()('data') → btoa('data')
 * 
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Arborist} The modified arborist instance
 */
function replaceCallExpressionsWithUnwrappedIdentifier(arb, candidateFilter = () => true) {
	// Find all matching call expressions
	const matches = replaceCallExpressionsWithUnwrappedIdentifierMatch(arb, candidateFilter);
	
	// Transform each matching node
	for (let i = 0; i < matches.length; i++) {
		arb = replaceCallExpressionsWithUnwrappedIdentifierTransform(arb, matches[i]);
	}
	
	return arb;
}

export default replaceCallExpressionsWithUnwrappedIdentifier;