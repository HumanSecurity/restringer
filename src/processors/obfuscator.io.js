/**
 * Obfuscator.io Processor
 * 
 * This processor handles obfuscation patterns specific to obfuscator.io, particularly
 * the "debug protection" mechanism that creates infinite loops when the script detects
 * it has been beautified or modified.
 * 
 * The debug protection works by:
 * 1. Testing function toString() output against a regex
 * 2. If the test fails (indicating beautification), triggering an infinite loop
 * 3. Preventing the script from executing normally
 * 
 * This processor bypasses the protection by replacing the tested functions with
 * strings that pass the validation tests, effectively "freezing" their values.
 * 
 * Combined with augmentedArray processors for comprehensive obfuscator.io support.
 */
import * as augmentedArrayProcessors from './augmentedArray.js';

// String literal values that trigger debug protection mechanisms
const DEBUG_PROTECTION_TRIGGERS = ['newState', 'removeCookie'];

// Replacement string that bypasses obfuscator.io debug protection
const FREEZE_REPLACEMENT_STRING = 'function () {return "bypassed!"}';

/**
 * Identifies Literal nodes that contain debug protection trigger values.
 * These literals are part of obfuscator.io's anti-debugging mechanisms that test
 * function stringification to detect code beautification or modification.
 * 
 * Matching criteria:
 * - Literal nodes with values 'newState' or 'removeCookie'
 * - Literals positioned within function expressions or property assignments
 * - Valid parent node structure for replacement targeting
 * 
 * @param {Arborist} arb - Arborist instance containing the AST
 * @param {Function} [candidateFilter=(() => true)] - Optional filter function for additional criteria
 * @return {ASTNode[]} Array of matching Literal nodes suitable for debug protection bypass
 * 
 * @example
 * // Matches: 'newState' in function context, 'removeCookie' in property assignment
 * // Ignores: Other literal values, literals in invalid contexts
 */
export function obfuscatorIoMatch(arb, candidateFilter = () => true) {
	const matches = [];
	const candidates = arb.ast[0].typeMap.Literal;

	for (let i = 0; i < candidates.length; i++) {
		const n = candidates[i];
		if (DEBUG_PROTECTION_TRIGGERS.includes(n.value) && candidateFilter(n)) {
			matches.push(n);
		}
	}
	return matches;
}

/**
 * Transforms a debug protection trigger literal by replacing the associated function
 * or value with a bypass string that satisfies obfuscator.io's validation tests.
 * 
 * This function handles two specific protection patterns:
 * 1. 'newState' - targets parent FunctionExpression nodes
 * 2. 'removeCookie' - targets parent property values
 * 
 * Algorithm:
 * 1. Identify the protection trigger type ('newState' or 'removeCookie')
 * 2. Navigate the AST structure to find the appropriate target node
 * 3. Replace the target with a literal containing the bypass string
 * 4. Mark the node for replacement in the Arborist instance
 * 
 * @param {Arborist} arb - Arborist instance containing the AST
 * @param {ASTNode} n - The Literal AST node containing the debug protection trigger
 * @return {Arborist} The modified Arborist instance
 */
export function obfuscatorIoTransform(arb, n) {
	let targetNode;

	// Determine target node based on protection trigger type
	switch (n.value) {
		case 'newState':
			// Navigate up to find the containing FunctionExpression
			if (n.parentNode?.parentNode?.parentNode?.type === 'FunctionExpression') {
				targetNode = n.parentNode.parentNode.parentNode;
			}
			break;
		case 'removeCookie':
			// Target the parent value directly
			targetNode = n.parentNode?.value;
			break;
	}

	// Apply the bypass replacement if a valid target was found
	if (targetNode) {
		arb.markNode(targetNode, {
			type: 'Literal',
			value: FREEZE_REPLACEMENT_STRING,
			raw: `"${FREEZE_REPLACEMENT_STRING}"`,
		});
	}

	return arb;
}

/**
 * Main function for obfuscator.io debug protection bypass.
 * Orchestrates the matching and transformation of debug protection mechanisms
 * to prevent infinite loops and allow deobfuscation to proceed.
 * 
 * @param {Arborist} arb - Arborist instance containing the AST
 * @param {Function} [candidateFilter=(() => true)] - Optional filter function for additional criteria
 * @return {Arborist} The modified Arborist instance
 */
function freezeUnbeautifiedValues(arb, candidateFilter = () => true) {
	const matches = obfuscatorIoMatch(arb, candidateFilter);

	for (let i = 0; i < matches.length; i++) {
		const n = matches[i];
		arb = obfuscatorIoTransform(arb, n);
	}
	return arb;
}

export const preprocessors = [freezeUnbeautifiedValues, ...augmentedArrayProcessors.preprocessors];
export const postprocessors = [...augmentedArrayProcessors.postprocessors];
