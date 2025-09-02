import {getCache} from './getCache.js';
import {generateHash} from './generateHash.js';
import {isNodeInRanges} from './isNodeInRanges.js';
import {PROPERTIES_THAT_MODIFY_CONTENT} from '../config.js';
import {doesDescendantMatchCondition} from './doesDescendantMatchCondition.js';

// Types that give no context by themselves
const irrelevantTypesToBeFilteredOut = [
	'Literal',
	'Identifier',
	'MemberExpression',
];

// Relevant types for giving context
const typesToCollect = [
	'CallExpression',
	'ArrowFunctionExpression',
	'AssignmentExpression',
	'FunctionDeclaration',
	'FunctionExpression',
	'VariableDeclarator',
];

// Child nodes that can be skipped as they give no context
const irrelevantTypesToAvoidIteratingOver = [
	'Literal',
	'ThisExpression',
];

// Direct child nodes of an if statement
const ifKeys = ['consequent', 'alternate'];

// Node types which are acceptable when wrapping an anonymous function
const standaloneNodeTypes = ['ExpressionStatement', 'AssignmentExpression', 'VariableDeclarator'];

/**
 * @param {ASTNode} targetNode
 * @return {boolean} True if the target node is directly under an if statement; false otherwise
 */
function isConsequentOrAlternate(targetNode) {
	return targetNode.parentNode.type === 'IfStatement' ||
		ifKeys.includes(targetNode.parentKey) ||
		ifKeys.includes(targetNode.parentNode.parentKey) ||
		(targetNode.parentNode.parentNode.type === 'BlockStatement' && ifKeys.includes(targetNode.parentNode.parentNode.parentKey));
}

/**
 * @param {ASTNode} n
 * @return {boolean} True if the target node is the object of a member expression
 *                   and its property is being assigned to; false otherwise.
 */
function isNodeAnAssignmentToProperty(n) {
	return n.parentNode.type === 'MemberExpression' &&
	!isConsequentOrAlternate(n.parentNode) &&
	((n.parentNode.parentNode.type === 'AssignmentExpression' &&  // e.g. targetNode.prop = value
			n.parentNode.parentKey === 'left') ||
		(n.parentKey === 'object' &&
			(n.parentNode.property.isMarked ||  // Marked references won't be collected
				// PROPERTIES_THAT_MODIFY_CONTENT - e.g. targetNode.push(value) - changes the value of targetNode
				PROPERTIES_THAT_MODIFY_CONTENT.includes(n.parentNode.property?.value || n.parentNode.property.name))));
}

/**
 * @param {ASTNode[]} nodes
 * @return {ASTNode[]} Nodes which aren't contained in other nodes from the array
 */
function removeRedundantNodes(nodes) {
	/** @type {ASTNode[]} */
	const keep = [];
	for (let i = 0; i < nodes.length; i++) {
		const targetNode = nodes[i],
			targetStart = targetNode.start,
			targetEnd = targetNode.end;
		if (!nodes.some(n => n !== targetNode && n.start <= targetStart && n.end >= targetEnd)) {
			keep.push(targetNode);
		}
	}
	return keep;
}

/**
 * @param {ASTNode} originNode
 * @param {boolean} [excludeOriginNode] (optional) Do not return the originNode. Defaults to false.
 * @return {ASTNode[]} A flat array of all available declarations and call expressions relevant to
 * the context of the origin node.
 */
export function getDeclarationWithContext(originNode, excludeOriginNode = false) {
	/** @type {ASTNode[]} */
	const stack = [originNode];   // The working stack for nodes to be reviewed
	/** @type {ASTNode[]} */
	const collected = [];         // These will be our context
	/** @type {ASTNode[]} */
	const seenNodes = [];         // Collected to avoid re-iterating over the same nodes
	/** @type {number[][]} */
	const collectedRanges = [];   // Collected to prevent collecting nodes from within collected nodes.
	/**
	 * @param {ASTNode} node
	 */
	function addToStack(node) {
		if (seenNodes.includes(node) ||
			stack.includes(node) ||
			irrelevantTypesToAvoidIteratingOver.includes(node.type)) {} else stack.push(node);
	}
	const cache = getCache(originNode.scriptHash);
	const srcHash = generateHash(originNode.src);
	const cacheNameId = `context-${originNode.nodeId}-${srcHash}`;
	const cacheNameSrc = `context-${srcHash}`;
	let cached = cache[cacheNameId] || cache[cacheNameSrc];
	if (!cached) {
		while (stack.length) {
			const node = stack.shift();
			if (seenNodes.includes(node)) continue;
			seenNodes.push(node);
			// Do not collect any context if one of the relevant nodes is marked to be replaced or deleted
			if (node.isMarked || doesDescendantMatchCondition(node, n => n.isMarked)) {
				collected.length = 0;
				break;
			}
			if (typesToCollect.includes(node.type) && !isNodeInRanges(node, collectedRanges)) {
				collected.push(node);
				collectedRanges.push(node.range);
			}

			// For each node, whether collected or not, target relevant relative nodes for further review.
			/** @type {ASTNode[]} */
			const targetNodes = [node];
			switch (node.type) {
				case 'Identifier': {
					const refs = node.references;
					// Review the declaration of an identifier
					if (node.declNode && node.declNode.parentNode) {
						targetNodes.push(node.declNode.parentNode);
					}
					else if (refs?.length && node.parentNode) targetNodes.push(node.parentNode);
					for (let i = 0; i < refs?.length; i++) {
						const ref = refs[i];
						// Review call expression that receive the identifier as an argument for possible augmenting functions
						if ((ref.parentKey === 'arguments' && ref.parentNode.type === 'CallExpression') ||
							// Review direct assignments to the identifier
							(ref.parentKey === 'left' &&
								ref.parentNode.type === 'AssignmentExpression' &&
								node.parentNode.type !== 'FunctionDeclaration' &&   // Skip function reassignments
								!isConsequentOrAlternate(ref))) {
							targetNodes.push(ref.parentNode);
							// Review assignments to property
						} else if (isNodeAnAssignmentToProperty(ref)) {
							targetNodes.push(ref.parentNode.parentNode);
						}
					}
					break;
				}
				case 'MemberExpression':
					if (node.property?.declNode) targetNodes.push(node.property.declNode);
					break;
				case 'FunctionExpression':
					// Review the parent node of anonymous functions
					if (!node.id) {
						let targetParent = node;
						while (targetParent.parentNode && !standaloneNodeTypes.includes(targetParent.type)) {
							targetParent = targetParent.parentNode;
						}
						if (standaloneNodeTypes.includes(targetParent.type)) targetNodes.push(targetParent);
					}
			}

			for (let i = 0; i < targetNodes.length; i++) {
				const targetNode = targetNodes[i];
				if (!seenNodes.includes(targetNode)) stack.push(targetNode);
				// noinspection JSUnresolvedVariable
				if (targetNode === targetNode.scope.block) {
					// Collect out-of-scope variables used inside the scope
					// noinspection JSUnresolvedReference
					for (let j = 0; j < targetNode.scope.through.length; j++) {
						// noinspection JSUnresolvedReference
						addToStack(targetNode.scope.through[j].identifier);
					}
				}
				for (let j = 0; j < targetNode?.childNodes.length; j++) {
					addToStack(targetNode.childNodes[j]);
				}
			}
		}
		cached = new Set();
		for (let i = 0; i < collected.length; i++) {
			const n = collected[i];
			if (!(
				cached.has(n) ||
				irrelevantTypesToBeFilteredOut.includes(n.type)) &&
				!(excludeOriginNode && isNodeInRanges(n, [originNode.range]))) {
				// A fix to ignore reassignments in cases where functions are overwritten as part of an anti-debugging mechanism
				if (n.type === 'FunctionDeclaration' && n.id && n.id.references?.length) {
					for (let j = 0; j < n.id.references.length; j++) {
						const ref = n.id.references[j];
						if (!(ref.parentKey === 'left' && ref.parentNode.type === 'AssignmentExpression')) {
							cached.add(n);
						}
					}
				} else cached.add(n);
			}
		}
		cached = removeRedundantNodes([...cached]);
		cache[cacheNameId] = cached;        // Caching context for the same node
		cache[cacheNameSrc] = cached;       // Caching context for a different node with similar content
	}
	return cached;
}