import {getCache} from './getCache.js';
import {generateHash} from './generateHash.js';
import {isNodeInRanges} from './isNodeInRanges.js';
import {PROPERTIES_THAT_MODIFY_CONTENT} from '../config.js';
import {doesDescendantMatchCondition} from './doesDescendantMatchCondition.js';

// Node types that provide no meaningful context and should be filtered from final results
const IRRELEVANT_FILTER_TYPES = [
	'Literal',
	'Identifier', 
	'MemberExpression',
];

// Node types that provide meaningful context for code evaluation
const TYPES_TO_COLLECT = [
	'CallExpression',
	'ArrowFunctionExpression', 
	'AssignmentExpression',
	'FunctionDeclaration',
	'FunctionExpression',
	'VariableDeclarator',
];

// Child node types that can be skipped during traversal as they provide no useful context
const SKIP_TRAVERSAL_TYPES = [
	'Literal',
	'ThisExpression',
];

// IfStatement child keys for detecting conditional execution contexts
const IF_STATEMENT_KEYS = ['consequent', 'alternate'];

// Node types that can properly wrap anonymous function expressions
const STANDALONE_WRAPPER_TYPES = ['ExpressionStatement', 'AssignmentExpression', 'VariableDeclarator'];

/**
 * Determines if a node is positioned as the consequent or alternate branch of an IfStatement.
 * This is used to identify nodes that are conditionally executed and may need special handling.
 *
 * @param {ASTNode} targetNode - The AST node to check
 * @return {boolean} True if the node is in an if statement branch, false otherwise
 */
function isConsequentOrAlternate(targetNode) {
	if (!targetNode?.parentNode) return false;
	
	return targetNode.parentNode.type === 'IfStatement' ||
		IF_STATEMENT_KEYS.includes(targetNode.parentKey) ||
		IF_STATEMENT_KEYS.includes(targetNode.parentNode.parentKey) ||
		(targetNode.parentNode.parentNode?.type === 'BlockStatement' && 
		 IF_STATEMENT_KEYS.includes(targetNode.parentNode.parentNode.parentKey));
}

/**
 * Determines if a node is the object of a member expression that is being assigned to or modified.
 * This identifies cases where the node's content may be altered through property assignment
 * or method calls that modify the object (e.g., array mutating methods).
 *
 * @param {ASTNode} n - The AST node to check
 * @return {boolean} True if the node is subject to property assignment/modification, false otherwise
 * 
 * Examples of detected patterns:
 * - obj.prop = value (assignment to property)
 * - obj.push(item) (mutating method call)
 * - obj[key] = value (computed property assignment)
 */
function isNodeAnAssignmentToProperty(n) {
	if (!n?.parentNode || n.parentNode.type !== 'MemberExpression') {
		return false;
	}
	
	if (isConsequentOrAlternate(n.parentNode)) {
		return false;
	}
	
	// Check for assignment to property: obj.prop = value
	if (n.parentNode.parentNode?.type === 'AssignmentExpression' && 
		n.parentNode.parentKey === 'left') {
		return true;
	}
	
	// Check for mutating method calls: obj.push(value)
	if (n.parentKey === 'object') {
		const property = n.parentNode.property;
		if (property?.isMarked) {
			return true; // Marked references won't be collected
		}
		
		const propertyName = property?.value || property?.name;
		if (propertyName && PROPERTIES_THAT_MODIFY_CONTENT.includes(propertyName)) {
			return true;
		}
	}
	
	return false;
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
 * Collects all declarations and call expressions that provide context for evaluating a given AST node.
 * This function gathers relevant nodes needed for safe code evaluation,
 * such as function declarations, variable assignments, and call expressions that may affect the behavior.
 *
 * The algorithm uses caching to avoid expensive re-computation for nodes with identical content,
 * and includes logic to handle:
 * - Variable references and their declarations
 * - Function scope and closure variables  
 * - Anonymous function expressions and their contexts
 * - Anti-debugging function overwrites (ignoring reassigned function declarations)
 * - Marked nodes (scheduled for replacement/deletion) - aborts collection if found
 *
 * @param {ASTNode} originNode - The starting AST node to collect context for
 * @param {boolean} [excludeOriginNode=false] - Whether to exclude the origin node from results
 * @return {ASTNode[]} Array of context nodes (declarations, assignments, calls) relevant for evaluation
 */
export function getDeclarationWithContext(originNode, excludeOriginNode = false) {
	// Input validation to prevent crashes
	if (!originNode) {
		return [];
	}
	/** @type {ASTNode[]} */
	const stack = [originNode];   // The working stack for nodes to be reviewed
	/** @type {ASTNode[]} */
	const collected = [];         // These will be our context
	/** @type {Set<ASTNode>} */
	const visitedNodes = new Set();  // Track visited nodes to prevent infinite loops
	/** @type {number[][]} */
	const collectedRanges = [];   // Prevent collecting overlapping nodes
	
	/**
	 * Adds a node to the traversal stack if it hasn't been visited and is worth traversing.
	 * @param {ASTNode} node - Node to potentially add to stack
	 */
	function addToStack(node) {
		if (!node || 
			visitedNodes.has(node) ||
			stack.includes(node) ||
			SKIP_TRAVERSAL_TYPES.includes(node.type)) {
			return;
		}
		stack.push(node);
	}
	const cache = getCache(originNode.scriptHash);
	const srcHash = generateHash(originNode.src);
	const cacheNameId = `context-${originNode.nodeId}-${srcHash}`;
	const cacheNameSrc = `context-${srcHash}`;
	let cached = cache[cacheNameId] || cache[cacheNameSrc];
	if (!cached) {
		while (stack.length) {
			const node = stack.shift();
			if (visitedNodes.has(node)) continue;
			visitedNodes.add(node);
			// Do not collect any context if one of the relevant nodes is marked to be replaced or deleted
			if (node.isMarked || doesDescendantMatchCondition(node, n => n.isMarked)) {
				collected.length = 0;
				break;
			}
			if (TYPES_TO_COLLECT.includes(node.type) && !isNodeInRanges(node, collectedRanges)) {
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
					// Review the parent node of anonymous functions to understand their context
					if (!node.id) {
						let targetParent = node;
						while (targetParent.parentNode && !STANDALONE_WRAPPER_TYPES.includes(targetParent.type)) {
							targetParent = targetParent.parentNode;
						}
						if (STANDALONE_WRAPPER_TYPES.includes(targetParent.type)) {
							targetNodes.push(targetParent);
						}
					}
					break;
			}

			for (let i = 0; i < targetNodes.length; i++) {
				const targetNode = targetNodes[i];
				if (!visitedNodes.has(targetNode)) stack.push(targetNode);
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
		// Filter and deduplicate collected nodes
		/** @type {Set<ASTNode>} */
		const filteredNodes = new Set();
		
		for (let i = 0; i < collected.length; i++) {
			const n = collected[i];
			
			// Skip if already added, irrelevant type, or should be excluded
			if (filteredNodes.has(n) || 
				IRRELEVANT_FILTER_TYPES.includes(n.type) ||
				(excludeOriginNode && isNodeInRanges(n, [originNode.range]))) {
				continue;
			}
			
			// Handle anti-debugging function overwrites by ignoring reassigned functions
			if (n.type === 'FunctionDeclaration' && n.id?.references?.length) {
				let hasNonAssignmentReference = false;
				const references = n.id.references;
				
				for (let j = 0; j < references.length; j++) {
					const ref = references[j];
					if (!(ref.parentKey === 'left' && ref.parentNode?.type === 'AssignmentExpression')) {
						hasNonAssignmentReference = true;
						break;
					}
				}
				
				if (hasNonAssignmentReference) {
					filteredNodes.add(n);
				}
			} else {
				filteredNodes.add(n);
			}
		}
		// Convert to array and remove redundant nodes
		cached = removeRedundantNodes([...filteredNodes]);
		cache[cacheNameId] = cached;        // Caching context for the same node
		cache[cacheNameSrc] = cached;       // Caching context for a different node with similar content
	}
	return cached;
}