import {createNewNode} from '../utils/createNewNode.js';

/**
 * Find all template literals that contain only literal expressions and can be converted to string literals.
 * @param {Arborist} arb
 * @param {Function} candidateFilter (optional) a filter to apply on the candidates list
 * @return {Array} Array of template literal nodes that can be converted to string literals
 */
export function parseTemplateLiteralsIntoStringLiteralsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = [].concat(arb.ast[0].typeMap.TemplateLiteral);
	const matchingNodes = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		// Only process template literals where all expressions are literals (not variables or function calls)
		if (!n.expressions.some(exp => exp.type !== 'Literal') &&
			candidateFilter(n)) {
			matchingNodes.push(n);
		}
	}
	return matchingNodes;
}

/**
 * Convert a template literal with only literal expressions into a plain string literal.
 * @param {Arborist} arb
 * @param {Object} node The template literal node to transform
 * @return {Arborist}
 */
export function parseTemplateLiteralsIntoStringLiteralsTransform(arb, node) {
	// Template literals have alternating quasis (string parts) and expressions
	// e.g. `hello ${name}!` has quasis=["hello ", "!"] and expressions=[name]
	// The build process is: quasi[0] + expr[0] + quasi[1] + expr[1] + ... + final_quasi
	let newStringLiteral = '';
	
	// Process all expressions, adding the preceding quasi each time
	for (let i = 0; i < node.expressions.length; i++) {
		newStringLiteral += node.quasis[i].value.raw + node.expressions[i].value;
	}
	
	// Add the final quasi (there's always one more quasi than expressions)
	newStringLiteral += node.quasis.slice(-1)[0].value.raw;
	
	arb.markNode(node, createNewNode(newStringLiteral));
	return arb;
}

/**
 * Convert template literals that contain only literal expressions into regular string literals.
 * This simplifies expressions by replacing template syntax with plain strings when no dynamic content exists.
 * 
 * Transforms:
 *   `hello ${'world'}!` -> 'hello world!'
 *   `static ${42} text` -> 'static 42 text'
 *   `just text` -> 'just text'
 * 
 * Only processes template literals where all interpolated expressions are literals (strings, numbers, booleans),
 * not variables or function calls which could change at runtime.
 * 
 * @param {Arborist} arb
 * @param {Function} candidateFilter (optional) a filter to apply on the candidates list
 * @return {Arborist}
 */
export default function parseTemplateLiteralsIntoStringLiterals(arb, candidateFilter = () => true) {
	const matchingNodes = parseTemplateLiteralsIntoStringLiteralsMatch(arb, candidateFilter);
	
	for (let i = 0; i < matchingNodes.length; i++) {
		arb = parseTemplateLiteralsIntoStringLiteralsTransform(arb, matchingNodes[i]);
	}
	
	return arb;
}