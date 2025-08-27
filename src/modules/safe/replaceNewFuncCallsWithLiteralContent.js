import {getCache} from '../utils/getCache.js';
import {generateFlatAST, logger} from 'flast';
import {generateHash} from '../utils/generateHash.js';

/**
 * Parse a JavaScript code string into an AST body with appropriate normalization.
 *
 * This function handles various code string formats:
 * - Empty strings become literal nodes
 * - Single expressions are unwrapped from ExpressionStatement
 * - Multiple statements become BlockStatement
 *
 * @param {string} codeStr - The JavaScript code string to parse
 * @return {Object} The parsed AST node
 */
function parseCodeStringToAST(codeStr) {
	if (!codeStr) {
		return {
			type: 'Literal',
			value: codeStr,
		};
	}
	
	const body = generateFlatAST(codeStr, {detailed: false, includeSrc: false})[0].body;
	
	if (body.length > 1) {
		return {
			type: 'BlockStatement',
			body,
		};
	}
	
	const singleStatement = body[0];
	
	// Unwrap single expressions from ExpressionStatement wrapper
	if (singleStatement.type === 'ExpressionStatement') {
		return singleStatement.expression;
	}
	
	// For immediately-executed functions, unwrap single return statements
	if (singleStatement.type === 'ReturnStatement' && singleStatement.argument) {
		return singleStatement.argument;
	}
	
	return singleStatement;
}

/**
 * Determine the appropriate target node for replacement based on context.
 *
 * When replacing `new Function(code)()` with a BlockStatement, we need to
 * replace the entire ExpressionStatement that contains the call, not just
 * the call expression itself. For variable assignments and other contexts,
 * we replace just the call expression.
 *
 * @param {Object} callNode - The call expression node (parent of NewExpression)
 * @param {Object} replacementNode - The AST node that will replace the call
 * @return {Object} The node that should be replaced
 */
function getReplacementTarget(callNode, replacementNode) {
	// For BlockStatement replacements in standalone expressions, replace the entire ExpressionStatement
	if (callNode.parentNode.type === 'ExpressionStatement' && 
		replacementNode.type === 'BlockStatement') {
		return callNode.parentNode;
	}
	
	// For all other cases (including variable assignments), replace just the call expression
	return callNode;
}

/**
 * Find all NewExpression nodes that represent immediately-called Function constructors
 * with single string arguments.
 *
 * This function identifies patterns like:
 * new Function("code")() - Function constructor called immediately
 *
 * Algorithm:
 * 1. Find all NewExpression nodes in the AST
 * 2. Check if used as callee in immediate call (parentKey === 'callee')
 * 3. Verify the immediate call has no arguments
 * 4. Confirm callee is 'Function' constructor
 * 5. Ensure exactly one literal string argument
 * 6. Apply candidate filter for additional constraints
 *
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Array} Array of NewExpression nodes that can be safely replaced
 */
export function replaceNewFuncCallsWithLiteralContentMatch(arb, candidateFilter = () => true) {
	// Direct access to typeMap without spread operator for better performance
	const relevantNodes = arb.ast[0].typeMap.NewExpression || [];
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Optimized condition ordering: cheapest checks first for better performance
		if (candidateFilter(n) &&
			n.parentKey === 'callee' && // Used as callee in immediate call
			n.callee?.name === 'Function' && // Constructor is 'Function'
			n.arguments?.length === 1 && // Exactly one argument
			n.arguments[0].type === 'Literal' && // Argument is a literal string
			!n.parentNode?.arguments?.length) { // Immediate call has no arguments
			
			matches.push(n);
		}
	}
	
	return matches;
}

/**
 * Transform a NewExpression node by replacing the entire Function constructor call
 * with the parsed content of its string argument.
 *
 * This function takes a `new Function(code)()` pattern and replaces it with
 * the actual parsed JavaScript code, effectively "unwrapping" the dynamic
 * function creation and execution.
 *
 * @param {Arborist} arb - The arborist instance to modify
 * @param {Object} n - The NewExpression node to transform
 * @return {Arborist} The modified arborist instance
 */
export function replaceNewFuncCallsWithLiteralContentTransform(arb, n) {
	const cache = getCache(arb.ast[0].scriptHash);
	const targetCodeStr = n.arguments[0].value;
	const cacheName = `replaceEval-${generateHash(targetCodeStr)}`;
	
	try {
		// Use cache to avoid re-parsing identical code strings
		if (!cache[cacheName]) {
			cache[cacheName] = parseCodeStringToAST(targetCodeStr);
		}
		
		const replacementNode = cache[cacheName];
		const targetNode = getReplacementTarget(n.parentNode, replacementNode);
		
		arb.markNode(targetNode, replacementNode);
	} catch (e) {
		// Log parsing failures but don't crash the transformation
		logger.debug(`[-] Unable to replace new function's body with call expression: ${e}`);
	}
	
	return arb;
}

/**
 * Replace Function constructor calls with their literal content when safe to do so.
 *
 * This transformation handles patterns where JavaScript code is dynamically created
 * using the Function constructor and immediately executed. It replaces such patterns
 * with the actual parsed code, eliminating the dynamic construction overhead.
 *
 * Examples:
 * - new Function("console.log('hello')")() → console.log('hello')
 * - new Function("x = 1; y = 2;")() → { x = 1; y = 2; }
 * - new Function("return 42")() → 42
 *
 * Safety constraints:
 * - Only works with literal string arguments to Function constructor
 * - Only processes immediately-called Function constructors
 * - Skips constructions that can't be parsed as valid JavaScript
 * - Uses caching to avoid re-parsing identical code strings
 *
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Arborist} The modified arborist instance
 */
export default function replaceNewFuncCallsWithLiteralContent(arb, candidateFilter = () => true) {
	// Find all matching NewExpression nodes
	const matches = replaceNewFuncCallsWithLiteralContentMatch(arb, candidateFilter);
	
	// Transform each matching node
	for (let i = 0; i < matches.length; i++) {
		arb = replaceNewFuncCallsWithLiteralContentTransform(arb, matches[i]);
	}
	
	return arb;
}