import {generateFlatAST} from 'flast';

/**
 * Builds the function arguments string from constructor arguments.
 * 
 * When Function.constructor is called with multiple arguments, all but the last
 * are parameter names, and the last is the function body. This helper extracts
 * and formats the parameter names properly.
 * 
 * @param {Array} args - Array of literal argument values
 * @return {string} Comma-separated parameter names
 */
function buildArgumentsString(args) {
	if (args.length <= 1) {
		return '';
	}
	
	// All arguments except the last are parameter names
	const paramNames = [];
	for (let i = 0; i < args.length - 1; i++) {
		paramNames.push(args[i]);
	}
	
	return paramNames.join(', ');
}

/**
 * Generates a function expression AST node from constructor arguments.
 * 
 * This function recreates the same behavior as Function.constructor by:
 * 1. Taking all but the last argument as parameter names
 * 2. Using the last argument as the function body
 * 3. Wrapping in a function expression for valid syntax
 * 4. Generating AST without nodeIds to avoid conflicts
 * 
 * @param {Array} argumentValues - Array of literal values from constructor call
 * @return {ASTNode|null} Function expression AST node or null if generation fails
 */
function generateFunctionExpression(argumentValues) {
	const argsString = buildArgumentsString(argumentValues);
	const code = argumentValues[argumentValues.length - 1];
	
	try {
		// Create function expression string matching Function.constructor behavior
		const functionCode = `(function (${argsString}) {${code}})`;
		
		// Generate AST without nodeIds to avoid duplicates with existing code
		const ast = generateFlatAST(functionCode, {detailed: false, includeSrc: false});
		
		// Return the function expression node (index 2 in the generated AST)
		return ast[2] || null;
	} catch {
		// Return null if code generation fails (invalid syntax, etc.)
		return null;
	}
}

/**
 * Identifies CallExpression nodes that are Function.constructor calls with literal arguments.
 * 
 * A call expression is a candidate for transformation when:
 * 1. It's a call to Function.constructor (member expression with 'constructor' property)
 * 2. All arguments are literal values (required for static analysis)
 * 3. Has at least one argument (the function body)
 * 4. Passes the candidate filter
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {ASTNode[]} Array of CallExpression nodes that can be transformed
 */
export function resolveFunctionConstructorCallsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.CallExpression || [];
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Check if this is a .constructor call
		if (!n.callee || 
			n.callee.type !== 'MemberExpression' ||
			!n.callee.property ||
			(n.callee.property.name !== 'constructor' && n.callee.property.value !== 'constructor')) {
			continue;
		}
		
		// Must have at least one argument (the function body)
		if (!n.arguments || n.arguments.length === 0) {
			continue;
		}
		
		// All arguments must be literals for static evaluation
		let allLiterals = true;
		for (let j = 0; j < n.arguments.length; j++) {
			if (n.arguments[j].type !== 'Literal') {
				allLiterals = false;
				break;
			}
		}
		
		if (allLiterals && candidateFilter(n)) {
			matches.push(n);
		}
	}
	
	return matches;
}

/**
 * Transforms a Function.constructor call into a function expression.
 * 
 * The transformation process:
 * 1. Extract literal values from constructor arguments
 * 2. Generate equivalent function expression AST
 * 3. Replace constructor call with function expression
 * 
 * This transformation is safe because all arguments are literals, ensuring
 * the function can be statically analyzed and transformed.
 * 
 * @param {Arborist} arb - The Arborist instance to mark changes on
 * @param {Object} n - The CallExpression node to transform
 * @return {Arborist} The modified Arborist instance
 */
export function resolveFunctionConstructorCallsTransform(arb, n) {
	// Extract literal values from arguments
	const argumentValues = [];
	for (let i = 0; i < n.arguments.length; i++) {
		argumentValues.push(n.arguments[i].value);
	}
	
	// Generate equivalent function expression
	const functionExpression = generateFunctionExpression(argumentValues);
	
	if (functionExpression) {
		arb.markNode(n, functionExpression);
	}
	
	return arb;
}

/**
 * Typical for packers, function constructor calls where the last argument
 * is a code snippet, should be replaced with the code nodes.
 * 
 * This transformation converts Function.constructor calls into equivalent function expressions
 * when all arguments are literal values. For example:
 * 
 * Input:  Function.constructor('a', 'b', 'return a + b')
 * Output: function (a, b) { return a + b }
 * 
 * The transformation preserves the exact semantics of Function.constructor while
 * making the code more readable and enabling further static analysis.
 * 
 * @param {Arborist} arb - The Arborist instance containing the AST to transform
 * @param {Function} [candidateFilter] - Optional filter to apply on candidates
 * @return {Arborist} The modified Arborist instance
 */
export default function resolveFunctionConstructorCalls(arb, candidateFilter = () => true) {
	const matches = resolveFunctionConstructorCallsMatch(arb, candidateFilter);
	
	for (let i = 0; i < matches.length; i++) {
		arb = resolveFunctionConstructorCallsTransform(arb, matches[i]);
	}
	
	return arb;
}