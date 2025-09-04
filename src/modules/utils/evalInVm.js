import {Sandbox} from './sandbox.js';
import {BAD_VALUE} from '../config.js';
import {getObjType} from './getObjType.js';
import {generateHash} from './generateHash.js';
import {createNewNode} from './createNewNode.js';

// Object types that cannot be safely resolved in the deobfuscation context
const BAD_TYPES = ['Promise'];

// Pre-computed console object key signatures for builtin object detection
const MATCHING_OBJECT_KEYS = {
	[Object.keys(console).sort().join('')]: {type: 'Identifier', name: 'console'},
	[Object.keys(console).sort().slice(1).join('')]: {type: 'Identifier', name: 'console'}, // Alternative console without the 'Console' object
};

// Anti-debugging and infinite loop trap patterns with their neutralization replacements
const TRAP_STRINGS = [
	{
		trap: /while\s*\(\s*(true|[1-9][0-9]*)\s*\)\s*\{\s*}/gi,
		replaceWith: 'while (0) {}',
	},
	{
		trap: /debugger/gi,
		replaceWith: '"debugge_"',
	},
	{   // TODO: Add as many permutations of this in an efficient manner
		trap: /["']debu["']\s*\+\s*["']gger["']/gi,
		replaceWith: `"debu" + "gge_"`,
	},
];

let CACHE = {};
const MAX_CACHE_SIZE = 100;

/**
 * Safely evaluates JavaScript code in a somewhat isolated sandbox environment.
 * Never trust the code you are evaluating, but if you do decide to execute it, this much is basic.
 * Includes built-in caching, anti-debugging trap neutralization, and result transformation to AST nodes.
 *
 * Security features:
 * - Runs code in an ~isolated~ sandbox
 * - Neutralizes common debugging traps (infinite loops, debugger statements)
 * - Limits memory usage and execution time through Sandbox configuration
 * - Filters out dangerous object types that could cause security issues
 *
 * Performance optimizations:
 * - Content-based caching prevents re-evaluation of identical code
 * - Cache size limit prevents memory bloat
 * - Reuses provided sandbox instances to avoid VM creation overhead
 *
 * @param {string} stringToEval - JavaScript code string to evaluate safely
 * @param {Sandbox} [sb] - Optional existing sandbox with pre-loaded context for performance
 * @return {ASTNode|string} AST node representation of the result, or BAD_VALUE if evaluation fails/unsafe
 *
 * @example
 * // evalInVm('5 + 3') => {type: 'Literal', value: 8, raw: '8'}
 * // evalInVm('Math.random()') => BAD_VALUE (unsafe/non-deterministic)
 * // evalInVm('[1,2,3].length') => {type: 'Literal', value: 3, raw: '3'}
 */
export function evalInVm(stringToEval, sb) {
	const cacheName = `eval-${generateHash(stringToEval)}`;
	if (CACHE[cacheName] === undefined) {
		// Simple cache eviction: clear all when hitting size limit
		if (Object.keys(CACHE).length >= MAX_CACHE_SIZE) CACHE = {};
		CACHE[cacheName] = BAD_VALUE;
		try {
			// Neutralize anti-debugging and infinite loop traps before evaluation
			for (let i = 0; i < TRAP_STRINGS.length; i++) {
				const ts = TRAP_STRINGS[i];
				stringToEval = stringToEval.replace(ts.trap, ts.replaceWith);
			}
			let vm = sb || new Sandbox();
			let res = vm.run(stringToEval);
			
			// Only process valid, safe references that can be converted to AST nodes
			if (vm.isReference(res) && !BAD_TYPES.includes(getObjType(res))) {
				// noinspection JSUnresolvedVariable
				res = res.copySync(); // Extract value from VM reference
				
				// Check if result matches a known builtin object (e.g., console)
				const objKeys = Object.keys(res).sort().join('');
				if (MATCHING_OBJECT_KEYS[objKeys]) {
					CACHE[cacheName] = MATCHING_OBJECT_KEYS[objKeys];
				} else {
					CACHE[cacheName] = createNewNode(res);
				}
			}
		} catch {
			// Evaluation failed - cache entry remains BAD_VALUE
		}
	}
	return CACHE[cacheName];
}

// Attach BAD_VALUE to evalInVm for convenient access by modules using evalInVm
evalInVm.BAD_VALUE = BAD_VALUE;