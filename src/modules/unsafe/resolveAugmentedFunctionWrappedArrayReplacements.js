import {Sandbox} from '../utils/sandbox.js';
import {evalInVm} from '../utils/evalInVm.js';
import {getDescendants} from '../utils/getDescendants.js';
import {doesDescendantMatchCondition} from '../utils/doesDescendantMatchCondition.js';



/**
 * Resolves array reference from array candidate node by finding the assignment expression
 * where an array is assigned to a variable.
 * 
 * This function returns the actual assignment/declaration node (e.g., `var arr = [1,2,3]` 
 * or `arr = someFunction()`). Having this assignment is crucial because it provides:
 * - The variable name that holds the array
 * - The ability to find all references to that array variable throughout the code
 * - The assignment expression needed for the sandbox evaluation context
 * 
 * Handles both:
 * - Global scope array declarations: `var arr = [1,2,3]`
 * - Call expression array initializations: `var arr = someArrayFunction()`
 *
 * @param {ASTNode} ac - Array candidate node (Identifier) to resolve reference for
 * @return {ASTNode|null} The assignment/declaration node containing the array, or null if not found
 */
function resolveArrayReference(ac) {
	if (!ac.declNode) return null;
	
	if (ac.declNode.scope.type === 'global') {
		if (ac.declNode.parentNode?.init?.type === 'ArrayExpression') {
			return ac.declNode.parentNode?.parentNode || ac.declNode.parentNode;
		}
	} else if (ac.declNode.parentNode?.init?.type === 'CallExpression') {
		return ac.declNode.parentNode.init.callee?.declNode?.parentNode;
	}
	
	return null;
}

/**
 * Finds matching expression statement that calls a function with the array candidate.
 *
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {ASTNode} ac - Array candidate node to match
 * @return {ASTNode|null} The matching expression statement or null if not found
 */
function findMatchingExpressionStatement(arb, ac) {
	const expressionStatements = arb.ast[0].typeMap.ExpressionStatement;
	for (let i = 0; i < expressionStatements.length; i++) {
		const exp = expressionStatements[i];
		if (exp.expression.type === 'CallExpression' &&
			exp.expression.callee.type === 'FunctionExpression' &&
			exp.expression.arguments.length &&
			exp.expression.arguments[0].type === 'Identifier' &&
			exp.expression.arguments[0].declNode === ac.declNode) {
			return exp;
		}
	}
	return null;
}

/**
 * Finds call expressions that reference the decryptor function and are candidates for replacement.
 *
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {ASTNode} arrDecryptor - The function that decrypts array values
 * @param {ASTNode[]} skipScopes - Array of scopes to skip when searching
 * @return {ASTNode[]} Array of call expression nodes that are replacement candidates
 */
function findReplacementCandidates(arb, arrDecryptor, skipScopes) {
	const callExpressions = arb.ast[0].typeMap.CallExpression;
	const replacementCandidates = [];
	
	for (let i = 0; i < callExpressions.length; i++) {
		const c = callExpressions[i];
		if (c.callee?.name === arrDecryptor.id.name && 
			!skipScopes.includes(c.scope)) {
			replacementCandidates.push(c);
		}
	}
	
	return replacementCandidates;
}

/**
 * Finds FunctionDeclaration nodes that are potentially augmented functions.
 * 
 * Performs initial filtering for functions that:
 * - Are named (have an identifier)
 * - Contains assignment expressions that modify the function itself
 * 
 * Additional validation (checking if the function is used as an array decryptor)
 * is performed in the transform function since it's computationally expensive
 * and the results are needed for the actual transformation logic.
 *
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Filter function to apply to candidates
 * @return {ASTNode[]} Array of FunctionDeclaration nodes that are potentially augmented
 */
export function resolveAugmentedFunctionWrappedArrayReplacementsMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.FunctionDeclaration;
	const matches = [];

	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		if (n.id?.name && candidateFilter(n) &&
			doesDescendantMatchCondition(n, d =>
				d.type === 'AssignmentExpression' &&
				d.left?.name === n.id.name)) {
			matches.push(n);
		}
	}

	return matches;
}

/**
 * Transforms augmented function declarations by resolving array-wrapped function calls.
 * 
 * This handles a complex obfuscation pattern where:
 * 1. Array data is stored in variables (global or function-scoped)
 * 2. A decryptor function processes array indices to return string values
 * 3. The decryptor function is modified/augmented through assignment expressions
 * 4. Function expressions are used to set up the array-decryptor relationship
 * 5. Call expressions to the decryptor function are replaced with literal values
 *
 * The transformation creates a sandbox environment containing the array definition,
 * decryptor function, and setup expression, then evaluates calls to replace them
 * with their computed literal values.
 *
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {ASTNode} n - The FunctionDeclaration node to transform
 * @return {Arborist} The Arborist instance for chaining
 */
export function resolveAugmentedFunctionWrappedArrayReplacementsTransform(arb, n) {
	const descendants = getDescendants(n);
	const arrDecryptor = n;

	// Find and process MemberExpression nodes with Identifier objects as array candidates
	for (let i = 0; i < descendants.length; i++) {
		const d = descendants[i];
		if (d.type === 'MemberExpression' && d.object.type === 'Identifier') {
			const ac = d.object;
			const arrRef = resolveArrayReference(ac);
			
			if (arrRef) {
				const exp = findMatchingExpressionStatement(arb, ac);
				
				if (exp) {
					const context = [arrRef.src, arrDecryptor.src, exp.src].join('\n;');
					const skipScopes = [arrRef.scope, arrDecryptor.scope, exp.expression.callee.scope];
					const replacementCandidates = findReplacementCandidates(arb, arrDecryptor, skipScopes);
					
					if (!replacementCandidates.length) continue;
					
					const sb = new Sandbox();
					sb.run(context);
					
					for (let j = 0; j < replacementCandidates.length; j++) {
						const rc = replacementCandidates[j];
						const replacementNode = evalInVm(`\n${rc.src}`, sb);
						if (replacementNode !== evalInVm.BAD_VALUE) {
							arb.markNode(rc, replacementNode);
						}
					}
					break;
				}
			}
		}
	}

	return arb;
}

/**
 * Resolves augmented function-wrapped array replacements in obfuscated code.
 * 
 * This transformation handles a sophisticated obfuscation pattern where array
 * access is disguised through function calls that decrypt array indices. The
 * pattern typically involves:
 * 
 * 1. An array of encoded strings stored in a variable
 * 2. A decryptor function that takes indices and returns decoded strings
 * 3. Assignment expressions that modify the decryptor function (augmentation)
 * 4. Function expressions that establish the array-decryptor relationship
 * 5. Call expressions throughout the code that use the decryptor
 * 
 * This module identifies such patterns and replaces the function calls with
 * their actual string literals, effectively deobfuscating the code.
 * 
 * Example transformation:
 * ```javascript
 * // Before:
 * var arr = ['encoded1', 'encoded2'];
 * function decrypt(i) { return arr[i]; }
 * decrypt = augmentFunction(decrypt, arr);
 * console.log(decrypt(0)); // obfuscated call
 * 
 * // After:
 * var arr = ['encoded1', 'encoded2'];
 * function decrypt(i) { return arr[i]; }
 * decrypt = augmentFunction(decrypt, arr);
 * console.log('decoded1'); // literal replacement
 * ```
 *
 * @param {Arborist} arb - The Arborist instance containing the AST
 * @param {Function} candidateFilter - Optional filter to apply to candidates
 * @return {Arborist} The Arborist instance for chaining
 */
export default function resolveAugmentedFunctionWrappedArrayReplacements(arb, candidateFilter = () => true) {
	const matches = resolveAugmentedFunctionWrappedArrayReplacementsMatch(arb, candidateFilter);

	for (let i = 0; i < matches.length; i++) {
		arb = resolveAugmentedFunctionWrappedArrayReplacementsTransform(arb, matches[i]);
	}

	return arb;
}