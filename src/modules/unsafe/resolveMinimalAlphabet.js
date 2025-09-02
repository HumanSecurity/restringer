import {BAD_VALUE} from '../config.js';
import {evalInVm} from '../utils/evalInVm.js';
import {doesDescendantMatchCondition} from '../utils/doesDescendantMatchCondition.js';



/**
 * Identifies unary and binary expressions that can be resolved to simplified values.
 * Targets JSFuck-style obfuscation patterns using non-numeric operands and excludes 
 * expressions containing ThisExpression for safe evaluation.
 * @param {Arborist} arb - Arborist instance
 * @param {Function} candidateFilter - Optional filter function for additional candidate filtering
 * @return {ASTNode[]} Array of expression nodes that can be resolved
 */
export function resolveMinimalAlphabetMatch(arb, candidateFilter = () => true) {
	const matches = [];
	const unaryNodes = arb.ast[0].typeMap.UnaryExpression;
	const binaryNodes = arb.ast[0].typeMap.BinaryExpression;

	// Process unary expressions: +true, +[], -false, ~[], etc.
	for (let i = 0; i < unaryNodes.length; i++) {
		const n = unaryNodes[i];
		if (((n.argument.type === 'Literal' && /^\D/.test(n.argument.raw[0])) ||
			n.argument.type === 'ArrayExpression') &&
		candidateFilter(n)) {
			// Skip expressions containing ThisExpression for safe evaluation
			if (doesDescendantMatchCondition(n, descendant => descendant.type === 'ThisExpression')) continue;
			matches.push(n);
		}
	}

	// Process binary expressions: [] + [], [+[]], etc.
	for (let i = 0; i < binaryNodes.length; i++) {
		const n = binaryNodes[i];
		if (n.operator === '+' &&
		(n.left.type !== 'MemberExpression' && Number.isNaN(parseFloat(n.left?.value))) &&
		n.left?.type !== 'ThisExpression' &&
		n.right?.type !== 'ThisExpression' &&
		candidateFilter(n)) {
			// Skip expressions containing ThisExpression for safe evaluation
			if (doesDescendantMatchCondition(n, descendant => descendant.type === 'ThisExpression')) continue;
			matches.push(n);
		}
	}

	return matches;
}

/**
 * Transforms unary and binary expressions by evaluating them to their simplified values.
 * Uses sandbox evaluation to safely convert JSFuck-style obfuscated expressions.
 * @param {Arborist} arb - Arborist instance
 * @param {ASTNode[]} matches - Array of expression nodes to transform
 * @return {Arborist} The modified Arborist instance
 */
export function resolveMinimalAlphabetTransform(arb, matches) {
	if (!matches.length) return arb;

	for (let i = 0; i < matches.length; i++) {
		const n = matches[i];
		const replacementNode = evalInVm(n.src);
		if (replacementNode !== BAD_VALUE) {
			arb.markNode(n, replacementNode);
		}
	}

	return arb;
}

/**
 * Resolve unary expressions on values which aren't numbers such as +true, +[], +[...], etc,
 * as well as binary expressions around the + operator. These usually resolve to string values,
 * which can be used to obfuscate code in schemes such as JSFuck.
 * @param {Arborist} arb - Arborist instance
 * @param {Function} candidateFilter - Optional filter function for additional candidate filtering
 * @return {Arborist} The modified Arborist instance
 */
export default function resolveMinimalAlphabet(arb, candidateFilter = () => true) {
	const matches = resolveMinimalAlphabetMatch(arb, candidateFilter);
	return resolveMinimalAlphabetTransform(arb, matches);
}