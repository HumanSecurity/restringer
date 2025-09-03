/**
 * Function To Array Replacements Processor
 * 
 * This processor resolves obfuscation patterns where arrays are dynamically generated
 * by function calls and then accessed via member expressions throughout the script.
 * 
 * Common obfuscation pattern:
 * ```javascript
 * function getArr() { return ['a', 'b', 'c']; }
 * const data = getArr();
 * console.log(data[0], data[1]); // Array access pattern
 * ```
 * 
 * After processing:
 * ```javascript
 * function getArr() { return ['a', 'b', 'c']; }
 * const data = ['a', 'b', 'c'];  // Function call replaced with literal array
 * console.log(data[0], data[1]);
 * ```
 * 
 * The processor evaluates function calls in a sandbox environment to determine
 * their array result and replaces the call with the literal array, improving
 * readability and enabling further deobfuscation by other modules.
 * 
 * Implementation: Uses the resolveFunctionToArray module from the unsafe collection,
 * which provides sophisticated match/transform logic with context-aware evaluation.
 */
import {unsafe} from '../modules/index.js';
const {resolveFunctionToArray} = unsafe;

export const preprocessors = [resolveFunctionToArray.default];
export const postprocessors = [];