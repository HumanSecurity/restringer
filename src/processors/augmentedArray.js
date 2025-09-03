/**
 * Augmented Array Replacements
 * 
 * Detects and resolves obfuscation patterns where arrays are shuffled by immediately-invoked
 * function expressions (IIFEs). This processor identifies shuffled arrays that are re-ordered
 * by IIFEs and replaces them with their final static state.
 *
 * Obfuscation Pattern:
 * const a = ['hello', 'log'];
 * (function(arr, times) {
 *   for (let i = 0; i < times; i++) {
 *     a.push(a.shift());
 *   }
 * })(a, 1);
 * console[a[0]](a[1]);   // Before: console['hello']('log') -> Error
 *                        // After:  console['log']('hello') -> Works
 * 
 * Resolution Process:
 * 1. Identify IIFE patterns that manipulate arrays with literal shift counts
 * 2. Execute the IIFE in a secure VM to determine final array state
 * 3. Replace the original array declaration with the final static array
 * 4. Remove the augmenting IIFE as it's no longer needed
 */
import {config, unsafe, utils} from '../modules/index.js';
const {resolveFunctionToArray} = unsafe;
const {BAD_VALUE} = config;
const {createOrderedSrc, evalInVm, getDeclarationWithContext} = utils.default;

// Function declaration type pattern for detecting array source context
const FUNCTION_DECLARATION_PATTERN = /function/i;

/**
 * Identifies CallExpression nodes that represent IIFE patterns for array augmentation.
 * These are function expressions or arrow functions called immediately with an array identifier
 * and a literal number representing the shuffle operations to perform.
 *
 * Matching criteria:
 * - CallExpression with FunctionExpression or ArrowFunctionExpression callee
 * - At least 2 arguments: array identifier and literal numeric shift count
 * - Valid numeric shift count (not NaN)
 * - First argument must be either:
 *   - A variable (VariableDeclarator) containing an array, OR
 *   - A self-modifying function declaration (reassigns itself internally)
 *
 * @param {Arborist} arb - Arborist instance containing the AST
 * @param {Function} [candidateFilter] - Optional filter function for additional criteria
 * @return {ASTNode[]} Array of matching CallExpression nodes suitable for augmentation resolution
 *
 * @example
 * // Matches: (function(arr, 3) { shuffle_logic })(myArrayVar, 3)
 * // Matches: ((arr, n) => { shuffle_logic })(myArrayVar, 1) 
 * // Matches: (function(fn, n) { shuffle_logic })(selfModifyingFunc, 2) [if fn reassigns itself]
 * // Ignores: (function() {})(), myFunc(arr), (function(fn) {})(staticFunction)
 */
export function augmentedArrayMatch(arb, candidateFilter = () => true) {
	const matches = [];
	const candidates = arb.ast[0].typeMap.CallExpression;
	
	for (let i = 0; i < candidates.length; i++) {
		const n = candidates[i];
		if ((n.callee.type === 'FunctionExpression' || n.callee.type === 'ArrowFunctionExpression') &&
			n.arguments.length > 1 && 
			n.arguments[0].type === 'Identifier' &&
			n.arguments[1].type === 'Literal' && 
			!Number.isNaN(parseInt(n.arguments[1].value)) &&
			candidateFilter(n)) {
			// For function declarations, only match if they are self-modifying
			if (n.arguments[0].declNode?.parentNode?.type === 'FunctionDeclaration') {
				const functionBody = n.arguments[0].declNode.parentNode.body;
				const functionName = n.arguments[0].name;
				// Check if function reassigns itself (self-modifying pattern)
				const isSelfModifying = functionBody?.body?.some(stmt => 
					stmt.type === 'ExpressionStatement' &&
					stmt.expression?.type === 'AssignmentExpression' &&
					stmt.expression.left?.type === 'Identifier' &&
					stmt.expression.left.name === functionName
				);
				if (isSelfModifying) {
					matches.push(n);
				}
			} else if (n.arguments[0].declNode?.parentNode?.type === 'VariableDeclarator') {
				// Variables are always potential candidates
				matches.push(n);
			}
		}
	}
	return matches;
}

/**
 * Transforms a matched IIFE augmentation pattern by executing the IIFE to determine
 * the final array state and replacing the original array with the computed result.
 *
 * The transformation process:
 * 1. Locates the target ExpressionStatement containing the IIFE
 * 2. Identifies the array being augmented from the IIFE arguments
 * 3. Builds execution context including array declaration and IIFE code
 * 4. Evaluates the context in a secure VM to get final array state
 * 5. Replaces array declaration with computed static array
 * 6. Marks IIFE for removal
 *
 * @param {Arborist} arb - Arborist instance to modify
 * @param {ASTNode} n - CallExpression node representing the IIFE augmentation
 * @return {Arborist} The modified Arborist instance
 *
 * @example
 * // Input:  const arr = [1, 2]; (function(a,n){a.push(a.shift())})(arr, 1);
 * // Output: const arr = [2, 1];
 */
export function augmentedArrayTransform(arb, n) {
	// Find the target ExpressionStatement or SequenceExpression containing this IIFE
	let targetNode = n;
	while (targetNode && (targetNode.type !== 'ExpressionStatement' && targetNode.parentNode.type !== 'SequenceExpression')) {
		targetNode = targetNode?.parentNode;
	}
	
	// Extract the array identifier being augmented (first argument of the IIFE)
	const relevantArrayIdentifier = n.arguments.find(node => node.type === 'Identifier');
	
	// Determine if the array comes from a function declaration or variable declaration
	const declKind = FUNCTION_DECLARATION_PATTERN.test(relevantArrayIdentifier.declNode.parentNode.type) ? '' : 'var ';
	const ref = !declKind ? `${relevantArrayIdentifier.name}()` : relevantArrayIdentifier.name;
	
	// Build execution context: array declaration + IIFE + array reference for final state
	const contextNodes = getDeclarationWithContext(n, true);
	const context = `${contextNodes.length ? createOrderedSrc(contextNodes) : ''}`;
	const src = `${context};\n${createOrderedSrc([targetNode])}\n${ref};`;
	
	// Execute the augmentation in VM to get the final array state
	const replacementNode = evalInVm(src);
	if (replacementNode !== BAD_VALUE) {
		// Mark the IIFE for removal
		arb.markNode(targetNode || n);
		
		// Replace the array with its final augmented state
		if (relevantArrayIdentifier.declNode.parentNode.type === 'FunctionDeclaration') {
			// For function declarations, replace the function body with a return statement
			arb.markNode(relevantArrayIdentifier.declNode.parentNode.body, {
				type: 'BlockStatement',
				body: [{
					type: 'ReturnStatement',
					argument: replacementNode,
				}],
			});
		} else {
			// For variable declarations, replace the initializer with the computed array
			arb.markNode(relevantArrayIdentifier.declNode.parentNode.init, replacementNode);
		}
	}
	
	return arb;
}

/**
 * Resolves obfuscated arrays that are augmented (shuffled/re-ordered) by immediately-invoked
 * function expressions. This processor detects IIFE patterns that manipulate arrays through
 * push/shift operations and replaces them with their final static state.
 *
 * The processor handles complex obfuscation where arrays are deliberately shuffled to hide
 * their true content order, then un-shuffled by execution-time IIFEs. By pre-computing
 * the final array state, we can eliminate the runtime shuffling logic entirely.
 *
 * Algorithm:
 * 1. Identify IIFE patterns with array arguments and literal shift counts
 * 2. For each match, execute the IIFE in a secure VM environment
 * 3. Replace the original array declaration with the computed final state
 * 4. Remove the augmenting IIFE as it's no longer needed
 *
 * @param {Arborist} arb - Arborist instance containing the AST to process
 * @return {Arborist} The modified Arborist instance with augmented arrays resolved
 *
 * @example
 * // Before: const a = [1,2]; (function(arr,n){for(let i=0;i<n;i++)arr.push(arr.shift())})(a,1);
 * // After:  const a = [2,1];
 */
export function replaceArrayWithStaticAugmentedVersion(arb) {
	const matches = augmentedArrayMatch(arb);
	
	for (let i = 0; i < matches.length; i++) {
		arb = augmentedArrayTransform(arb, matches[i]);
	}
	
	return arb;
}

export const preprocessors = [replaceArrayWithStaticAugmentedVersion, resolveFunctionToArray.default];
export const postprocessors = [];