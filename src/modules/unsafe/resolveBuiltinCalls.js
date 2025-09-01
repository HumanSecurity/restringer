import {logger} from 'flast';
import {badValue} from '../config.js';
import {Sandbox} from '../utils/sandbox.js';
import {evalInVm} from '../utils/evalInVm.js';
import {createNewNode} from '../utils/createNewNode.js';
import * as safeImplementations from '../utils/safeImplementations.js';
import {skipBuiltinFunctions, skipIdentifiers, skipProperties} from '../config.js';

const AVAILABLE_SAFE_IMPLEMENTATIONS = Object.keys(safeImplementations);

/**
 * Identifies builtin function calls that can be resolved to literal values.
 * Matches CallExpressions and MemberExpressions that reference builtin functions
 * with only literal arguments, and Identifiers that are builtin functions.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter for candidates
 * @return {ASTNode[]} Array of nodes that match the criteria
 */
export function resolveBuiltinCallsMatch(arb, candidateFilter = () => true) {
	const matches = [];
	const relevantNodes = arb.ast[0].typeMap.MemberExpression
		.concat(arb.ast[0].typeMap.CallExpression)
		.concat(arb.ast[0].typeMap.Identifier);
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		if (!candidateFilter(n)) continue;
		
		// Skip user-defined functions and objects, this expressions, constructor access
		if (n.callee?.declNode || n?.callee?.object?.declNode ||
			'ThisExpression' === (n.callee?.object?.type || n.callee?.type) ||
			'constructor' === (n.callee?.property?.name || n.callee?.property?.value)) {
			continue;
		}
				
		// Check for safe implementation calls
		if (n.type === 'CallExpression' && AVAILABLE_SAFE_IMPLEMENTATIONS.includes(n.callee.name)) {
			matches.push(n);
		}
		
		// Check for calls with only literal arguments
		else if (n.type === 'CallExpression' && !n.arguments.some(a => a.type !== 'Literal')) {
			// Check if callee is builtin identifier
			if (n.callee.type === 'Identifier' && !n.callee.declNode && 
				!skipBuiltinFunctions.includes(n.callee.name)) {
				matches.push(n);
				continue;
			}
			
			// Check if callee is builtin member expression
			if (n.callee.type === 'MemberExpression' && !n.callee.object.declNode &&
				!skipBuiltinFunctions.includes(n.callee.object?.name) &&
				!skipIdentifiers.includes(n.callee.object?.name) &&
				!skipProperties.includes(n.callee.property?.name || n.callee.property?.value)) {
				matches.push(n);
			}
		}
	}
	return matches;
}

/**
 * Transforms a builtin function call into its literal value.
 * Uses safe implementations when available, otherwise evaluates in sandbox.
 * @param {Arborist} arb - The Arborist instance
 * @param {ASTNode} n - The node to transform
 * @param {Sandbox} sharedSb - Shared sandbox instance for evaluation
 * @return {Arborist} The updated Arborist instance
 */
export function resolveBuiltinCallsTransform(arb, n, sharedSb) {
	try {
		const safeImplementation = safeImplementations[n.callee.name];
		if (safeImplementation) {
			// Use safe implementation for known functions (btoa, atob, etc.)
			const args = n.arguments.map(a => a.value);
			const tempValue = safeImplementation(...args);
			if (tempValue) {
				arb.markNode(n, createNewNode(tempValue));
			}
		} else {
			// Evaluate unknown builtin calls in sandbox
			const replacementNode = evalInVm(n.src, sharedSb);
			if (replacementNode !== badValue) arb.markNode(n, replacementNode);
		}
	} catch (e) {
		logger.debug(e.message);
	}
	return arb;
}

/**
 * Resolve calls to builtin functions (like atob, btoa, String.fromCharCode, etc.).
 * Replaces builtin function calls with literal arguments with their computed values.
 * Uses safe implementations when available to avoid potential security issues.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter to apply on candidates
 * @return {Arborist} The updated Arborist instance
 */
export default function resolveBuiltinCalls(arb, candidateFilter = () => true) {
	const matches = resolveBuiltinCallsMatch(arb, candidateFilter);
	let sharedSb;
	
	for (let i = 0; i < matches.length; i++) {
		// Create sandbox only when needed to avoid overhead
		sharedSb = sharedSb || new Sandbox();
		arb = resolveBuiltinCallsTransform(arb, matches[i], sharedSb);
	}
	return arb;
}