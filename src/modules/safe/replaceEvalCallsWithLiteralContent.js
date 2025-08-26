import {getCache} from '../utils/getCache.js';
import {generateFlatAST, logger} from 'flast';
import {generateHash} from '../utils/generateHash.js';

/**
 * Parse the string argument of an eval call into an AST node.
 * 
 * This function takes the string content from an eval() call and converts it
 * into the appropriate AST representation, handling single statements,
 * multiple statements, and expression statements appropriately.
 * 
 * @param {string} code - The code string to parse
 * @return {Object} The parsed AST node
 */
function parseEvalArgument(code) {
	let body = generateFlatAST(code, {detailed: false, includeSrc: false})[0].body;
	
	// Multiple statements become a block statement
	if (body.length > 1) {
		return {
			type: 'BlockStatement',
			body,
		};
	}
	
	// Single statement processing
	body = body[0];
	
	// Unwrap expression statements to just the expression when appropriate
	if (body.type === 'ExpressionStatement') {
		body = body.expression;
	}
	
	return body;
}

/**
 * Handle replacement when eval is used as a callee in a call expression.
 * 
 * This handles the edge case where eval returns a function that is immediately
 * called, such as eval('Function')('alert("hacked!")').
 * 
 * @param {Object} evalNode - The original eval call node
 * @param {Object} replacementNode - The parsed replacement AST node
 * @return {Object} The modified call expression with eval replaced
 */
function handleCalleeReplacement(evalNode, replacementNode) {
	// Unwrap expression statement if needed
	if (replacementNode.type === 'ExpressionStatement') {
		replacementNode = replacementNode.expression;
	}
	
	// Create new call expression with eval replaced by the parsed content
	return {
		...evalNode.parentNode,
		callee: replacementNode
	};
}

/**
 * Find all eval call expressions that can be replaced with their literal content.
 * 
 * This function identifies eval() calls where the argument is a string literal
 * that can be safely parsed and replaced with the actual AST nodes without
 * executing the eval.
 * 
 * Algorithm:
 * 1. Find all CallExpression nodes in the AST
 * 2. Check if callee is 'eval' and first argument is a string literal
 * 3. Apply candidate filter for additional constraints
 * 4. Return matching nodes for transformation
 * 
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Array} Array of eval call expression nodes that can be replaced
 */
export function replaceEvalCallsWithLiteralContentMatch(arb, candidateFilter = () => true) {
	// Direct access to typeMap without spread operator for better performance
	const relevantNodes = arb.ast[0].typeMap.CallExpression;
	const matches = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const node = relevantNodes[i];
		
		// Check if this is an eval call with a literal string argument
		if (node.callee?.name === 'eval' &&
			node.arguments[0]?.type === 'Literal' &&
			candidateFilter(node)) {
			matches.push(node);
		}
	}
	
	return matches;
}

/**
 * Transform eval call expressions by replacing them with their parsed content.
 * 
 * This function takes an eval() call with a string literal and replaces it with
 * the actual AST nodes that the string represents. It handles various edge cases
 * including block statements, expression statements, and nested call expressions.
 * 
 * @param {Arborist} arb - The arborist instance to modify
 * @param {Object} node - The eval call expression node to transform
 * @return {Arborist} The modified arborist instance
 */
export function replaceEvalCallsWithLiteralContentTransform(arb, node) {
	const cache = getCache(arb.ast[0].scriptHash);
	const cacheName = `replaceEval-${generateHash(node.src)}`;
	
	try {
		// Generate or retrieve cached AST for the eval argument
		if (!cache[cacheName]) {
			cache[cacheName] = parseEvalArgument(node.arguments[0].value);
		}
		
		let replacementNode = cache[cacheName];
		let targetNode = node;
		
		// Handle edge case: eval used as callee in call expression
		// Example: eval('Function')('alert("hacked!")');
		if (node.parentKey === 'callee') {
			targetNode = node.parentNode;
			replacementNode = handleCalleeReplacement(node, replacementNode);
		}
		
		// Handle block statement placement
		if (targetNode.parentNode.type === 'ExpressionStatement' && 
			replacementNode.type === 'BlockStatement') {
			targetNode = targetNode.parentNode;
		}
		
		// Handle expression statement unwrapping
		// Example: console.log(eval('1;')) → console.log(1)
		if (targetNode.parentNode.type !== 'ExpressionStatement' && 
			replacementNode.type === 'ExpressionStatement') {
			replacementNode = replacementNode.expression;
		}
		
		arb.markNode(targetNode, replacementNode);
	} catch (e) {
		logger.debug(`[-] Unable to replace eval's body with call expression: ${e}`);
	}
	
	return arb;
}

/**
 * Replace eval call expressions with their literal content without executing eval.
 * 
 * This transformation safely replaces eval() calls that contain string literals
 * with the actual AST nodes that the strings represent. This improves code
 * readability and removes the security concerns associated with eval.
 * 
 * Examples:
 * - eval('console.log("hello")') → console.log("hello")
 * - eval('a; b;') → {a; b;}
 * - console.log(eval('1;')) → console.log(1)
 * - eval('Function')('code') → Function('code')
 * 
 * @param {Arborist} arb - The arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Arborist} The modified arborist instance
 */
export default function replaceEvalCallsWithLiteralContent(arb, candidateFilter = () => true) {
	// Find all matching eval call expressions
	const matches = replaceEvalCallsWithLiteralContentMatch(arb, candidateFilter);
	
	// Transform each matching node
	for (let i = 0; i < matches.length; i++) {
		arb = replaceEvalCallsWithLiteralContentTransform(arb, matches[i]);
	}
	
	return arb;
}