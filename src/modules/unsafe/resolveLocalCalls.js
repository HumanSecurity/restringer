import {Sandbox} from '../utils/sandbox.js';
import {evalInVm} from '../utils/evalInVm.js';
import {getCache} from '../utils/getCache.js';
import {getCalleeName} from '../utils/getCalleeName.js';
import {isNodeInRanges} from '../utils/isNodeInRanges.js';
import {createOrderedSrc} from '../utils/createOrderedSrc.js';
import {getDeclarationWithContext} from '../utils/getDeclarationWithContext.js';
import {BAD_VALUE, SKIP_IDENTIFIERS, SKIP_PROPERTIES} from '../config.js';

const VALID_UNWRAP_TYPES = ['Literal', 'Identifier'];
const CACHE_LIMIT = 100;
// Arguments that shouldn't be touched since the context may not be inferred during deobfuscation.
const BAD_ARGUMENT_TYPES = ['ThisExpression'];

// Module-level variables for appearance tracking  
let appearances = new Map();

/**
 * Sorts call expression nodes by their appearance frequency in descending order.
 * @param {ASTNode} a - First call expression node
 * @param {ASTNode} b - Second call expression node  
 * @return {number} Comparison result for sorting
 */
function sortByApperanceFrequency(a, b) {
	return appearances.get(getCalleeName(b)) - appearances.get(getCalleeName(a));
}

/**
 * Counts and tracks the appearance frequency of a call expression's callee.
 * @param {ASTNode} n - Call expression node
 * @return {number} Updated appearance count
 */
function countAppearances(n) {
	const calleeName = getCalleeName(n);
	const count = (appearances.get(calleeName) || 0) + 1;
	appearances.set(calleeName, count);
	return count;
}

/**
 * Identifies CallExpression nodes that can be resolved through local function definitions.
 * Collects call expressions where the callee has a declaration node and meets specific criteria.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter for candidates
 * @return {ASTNode[]} Array of call expression nodes that can be transformed
 */
export function resolveLocalCallsMatch(arb, candidateFilter = () => true) {
	appearances = new Map();
	const matches = [];
	const relevantNodes = arb.ast[0].typeMap.CallExpression;

	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		
		// Check if call expression has proper declaration context
		if ((n.callee?.declNode ||
			(n.callee?.object?.declNode &&
				!SKIP_PROPERTIES.includes(n.callee.property?.value || n.callee.property?.name)) ||
			n.callee?.object?.type === 'Literal') &&
		candidateFilter(n)) {
			countAppearances(n);	// Count appearances during the match phase to allow sorting by appearance frequency
			matches.push(n);
		}
	}
	
	// Sort by appearance frequency for optimization (most frequent first)
	matches.sort(sortByApperanceFrequency);
	return matches;
}

/**
 * Transforms call expressions by resolving them to their evaluated values using local function context.
 * Uses caching and sandbox evaluation to safely determine replacement values.
 * @param {Arborist} arb - The Arborist instance
 * @param {ASTNode[]} matches - Array of call expression nodes to transform
 * @return {Arborist} The modified Arborist instance
 */
export function resolveLocalCallsTransform(arb, matches) {
	if (!matches.length) return arb;

	const cache = getCache(arb.ast[0].scriptHash);
	const modifiedRanges = [];

	candidateLoop: for (let i = 0; i < matches.length; i++) {
		const c = matches[i];
		
		// Skip if already modified in this iteration
		if (isNodeInRanges(c, modifiedRanges)) continue;
		
		// Skip if any argument has problematic type
		for (let j = 0; j < c.arguments.length; j++) {
			if (BAD_ARGUMENT_TYPES.includes(c.arguments[j].type)) continue candidateLoop;
		}
		
		const callee = c.callee?.object || c.callee;
		const declNode = callee?.declNode || callee?.object?.declNode;
		
		// Skip simple wrappers that should be handled by safe modules
		if (declNode?.parentNode?.body?.body?.[0]?.type === 'ReturnStatement') {
			const returnArg = declNode.parentNode.body.body[0].argument;
			// Leave simple literal/identifier returns to safe unwrapping modules
			if (VALID_UNWRAP_TYPES.includes(returnArg.type) || returnArg.type.includes('unction')) continue;
			// Leave function shell unwrapping to dedicated module
			else if (returnArg.type === 'CallExpression' &&
				returnArg.callee?.object?.type === 'FunctionExpression' &&
				(returnArg.callee.property?.name || returnArg.callee.property?.value) === 'apply') continue;
		}
		
		// Cache management for performance
		const cacheName = `rlc-${callee.name || callee.value}-${declNode?.nodeId}`;
		if (!cache[cacheName]) {
			cache[cacheName] = BAD_VALUE;
			
			// Skip problematic callee types that shouldn't be evaluated
			if (SKIP_IDENTIFIERS.includes(callee.name) ||
				(callee.type === 'ArrayExpression' && !callee.elements.length) ||
				(callee.arguments || []).some(arg => SKIP_IDENTIFIERS.includes(arg) || arg?.type === 'ThisExpression')) continue;
			
			if (declNode) {
				// Skip simple function wrappers (handled by safe modules)
				if (declNode.parentNode.type === 'FunctionDeclaration' &&
					VALID_UNWRAP_TYPES.includes(declNode.parentNode?.body?.body?.[0]?.argument?.type)) continue;
				
				// Build execution context in sandbox
				const contextSb = new Sandbox();
				try {
					contextSb.run(createOrderedSrc(getDeclarationWithContext(declNode.parentNode)));
					if (Object.keys(cache) >= CACHE_LIMIT) cache.flush();
					cache[cacheName] = contextSb;
				} catch {}
			}
		}
		
		// Evaluate call expression in appropriate context
		const contextVM = cache[cacheName];
		const nodeSrc = createOrderedSrc([c]);
		const replacementNode = contextVM === BAD_VALUE ? evalInVm(nodeSrc) : evalInVm(nodeSrc, contextVM);
		
		if (replacementNode !== BAD_VALUE && replacementNode.type !== 'FunctionDeclaration' && replacementNode.name !== 'undefined') {
			// Anti-debugging protection: avoid resolving function toString that might trigger detection
			if (c.callee.type === 'MemberExpression' && 
				(c.callee.property?.name || c.callee.property?.value) === 'toString' &&
				replacementNode?.value?.substring(0, 8) === 'function') continue;
			
			arb.markNode(c, replacementNode);
			modifiedRanges.push(c.range);
		}
	}
	return arb;
}

/**
 * Resolves local function calls by evaluating them with their declaration context.
 * This module identifies call expressions where the callee is defined locally and attempts
 * to resolve their values through safe evaluation in a sandbox environment.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter for candidates
 * @return {Arborist} The modified Arborist instance
 */
export default function resolveLocalCalls(arb, candidateFilter = () => true) {
	const matches = resolveLocalCallsMatch(arb, candidateFilter);
	return resolveLocalCallsTransform(arb, matches);
}
