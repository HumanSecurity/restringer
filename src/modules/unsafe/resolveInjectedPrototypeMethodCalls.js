import {logger} from 'flast';
import {BAD_VALUE} from '../config.js';
import {Sandbox} from '../utils/sandbox.js';
import {evalInVm} from '../utils/evalInVm.js';
import {createOrderedSrc} from '../utils/createOrderedSrc.js';
import {getDeclarationWithContext} from '../utils/getDeclarationWithContext.js';

// Valid right-hand side types for prototype method assignments
// Note: ArrowFunctionExpression is supported - works fine when not relying on 'this' binding
const VALID_PROTOTYPE_FUNCTION_TYPES = ['FunctionExpression', 'ArrowFunctionExpression', 'Identifier'];

/**
 * Identifies AssignmentExpression nodes that assign functions to prototype properties.
 * Matches patterns like `String.prototype.method = function() {...}`, `Obj.prototype.prop = () => value`, 
 * or `Obj.prototype.prop = identifier`. Arrow functions work fine when they don't rely on 'this' binding.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter for candidates
 * @return {Object[]} Array of match objects containing prototype assignments and method details
 */
export function resolveInjectedPrototypeMethodCallsMatch(arb, candidateFilter = () => true) {
	const matches = [];
	const relevantNodes = arb.ast[0].typeMap.AssignmentExpression;

	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];

		// Must be assignment to a prototype property with a function value
		if (n.left?.type === 'MemberExpression' &&
			n.left.object?.type === 'MemberExpression' &&
			'prototype' === (n.left.object.property?.name || n.left.object.property?.value) &&
			n.operator === '=' &&
			VALID_PROTOTYPE_FUNCTION_TYPES.includes(n.right?.type) &&
			candidateFilter(n)) {

			const methodName = n.left.property?.name || n.left.property?.value;
			if (methodName) {
				matches.push({
					assignmentNode: n,
					methodName: methodName
				});
			}
		}
	}
	return matches;
}

/**
 * Transforms prototype method assignments by resolving their corresponding call expressions.
 * Evaluates calls to injected prototype methods in a sandbox and replaces them with results.
 * @param {Arborist} arb - The Arborist instance
 * @param {Object[]} matches - Array of prototype method assignments from match function
 * @return {Arborist} The updated Arborist instance
 */
export function resolveInjectedPrototypeMethodCallsTransform(arb, matches) {
	if (!matches.length) return arb;

	// Process each prototype method assignment
	for (let i = 0; i < matches.length; i++) {
		const match = matches[i];
		
		try {
			// Build execution context including the prototype assignment
			const context = getDeclarationWithContext(match.assignmentNode);
			const contextSb = new Sandbox();
			contextSb.run(createOrderedSrc(context));

			// Find and resolve calls to this injected method
			const callNodes = arb.ast[0].typeMap.CallExpression;
			for (let j = 0; j < callNodes.length; j++) {
				const callNode = callNodes[j];
				
				// Check if this call uses the injected prototype method
				if (callNode.callee?.type === 'MemberExpression' &&
					(callNode.callee.property?.name === match.methodName ||
					 callNode.callee.property?.value === match.methodName)) {
					
					// Evaluate the method call in the prepared context
					const replacementNode = evalInVm(`\n${createOrderedSrc([callNode])}`, contextSb);
					if (replacementNode !== BAD_VALUE) {
						arb.markNode(callNode, replacementNode);
					}
				}
			}
		} catch (e) {
			logger.debug(`[-] Error resolving injected prototype method '${match.methodName}': ${e.message}`);
		}
	}
	return arb;
}

/**
 * Resolves call expressions that use injected prototype methods.
 * Finds prototype method assignments like `String.prototype.secret = function() {...}`
 * and resolves corresponding calls like `'hello'.secret()` to their literal results.
 * @param {Arborist} arb - The Arborist instance
 * @param {Function} candidateFilter - Optional filter for candidates
 * @return {Arborist} The updated Arborist instance
 */
export default function resolveInjectedPrototypeMethodCalls(arb, candidateFilter = () => true) {
	const matches = resolveInjectedPrototypeMethodCallsMatch(arb, candidateFilter);
	return resolveInjectedPrototypeMethodCallsTransform(arb, matches);
}