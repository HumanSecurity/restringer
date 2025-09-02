import {parseCode} from 'flast';

// Large number used to push IIFE nodes to the end when preserveOrder is false
const LARGE_NUMBER = 999e8;
const FUNC_START_REGEXP = /function[^(]*/;
const TYPES_REQUIRING_SEMICOLON = ['VariableDeclarator', 'AssignmentExpression'];

/**
 * Comparison function for sorting nodes by their nodeId.
 * @param {ASTNode} a - First node to compare
 * @param {ASTNode} b - Second node to compare 
 * @return {number} -1 if a comes before b, 1 if b comes before a, 0 if equal
 */
const sortByNodeId = (a, b) => a.nodeId > b.nodeId ? 1 : b.nodeId > a.nodeId ? -1 : 0;

/**
 * Adds a name to an anonymous FunctionExpression by parsing modified source code.
 * This is necessary for creating standalone function declarations from anonymous functions.
 * @param {ASTNode} n - The FunctionExpression node to add a name to
 * @param {string} [name] - The new name. Defaults to 'func + n.nodeId'
 * @return {ASTNode|null} The new named function node, or null if parsing fails
 */
function addNameToFE(n, name) {
	name = name || 'func' + n.nodeId;
	const funcSrc = '(' + n.src.replace(FUNC_START_REGEXP, 'function ' + name) + ');';
	try {
		const newNode = parseCode(funcSrc);
		if (newNode) {
			newNode.nodeId = n.nodeId;
			newNode.src = funcSrc;
			return newNode;
		}
	} catch (e) {
		// Return null if parsing fails rather than undefined
		return null;
	}
	return null;
}

/**
 * Creates ordered source code from AST nodes, handling special cases for IIFEs and function expressions.
 * When preserveOrder is false, IIFEs are moved to the end to ensure proper execution order.
 * This is critical for deobfuscation where dependencies must be resolved before usage.
 * 
 * @param {ASTNode[]} nodes - Array of AST nodes to convert to source code
 * @param {boolean} [preserveOrder=false] - When false, IIFEs are pushed to the end of the code
 * @return {string} Combined source code of the nodes in proper execution order
 * 
 * @example
 * // Without preserveOrder: IIFEs moved to end
 * const nodes = [iifeNode, regularCallNode];
 * createOrderedSrc(nodes); // → "regularCall();\n(function(){})();\n"
 * 
 * // With preserveOrder: original order preserved  
 * createOrderedSrc(nodes, true); // → "(function(){})();\nregularCall();\n"
 */
export function createOrderedSrc(nodes, preserveOrder = false) {
	const seenNodes = new Set();
	const processedNodes = [];
	
	for (let i = 0; i < nodes.length; i++) {
		let currentNode = nodes[i];
		
		// Handle CallExpression nodes
		if (currentNode.type === 'CallExpression') {
			if (currentNode.parentNode.type === 'ExpressionStatement') {
				// Use the ExpressionStatement wrapper instead of the bare CallExpression
				currentNode = currentNode.parentNode;
				nodes[i] = currentNode;
				
				// IIFE reordering: place after argument dependencies when preserveOrder is false
				if (!preserveOrder && nodes[i].expression.callee.type === 'FunctionExpression') {
					let maxArgNodeId = 0;
					for (let j = 0; j < nodes[i].expression.arguments.length; j++) {
						const arg = nodes[i].expression.arguments[j];
						if (arg?.declNode?.nodeId > maxArgNodeId) {
							maxArgNodeId = arg.declNode.nodeId;
						}
					}
					// Place IIFE after latest argument dependency, or at end if no dependencies
					currentNode.nodeId = maxArgNodeId ? maxArgNodeId + 1 : currentNode.nodeId + LARGE_NUMBER;
				}
			} else if (nodes[i].callee.type === 'FunctionExpression') {
				// Standalone function expression calls (not in ExpressionStatement)
				if (!preserveOrder) {
					const namedFunc = addNameToFE(nodes[i], nodes[i].parentNode?.id?.name);
					if (namedFunc) {
						namedFunc.nodeId = namedFunc.nodeId + LARGE_NUMBER;
						currentNode = namedFunc;
						nodes[i] = currentNode;
					}
				}
				// When preserveOrder is true, keep the original node unchanged
			}
		} else if (currentNode.type === 'FunctionExpression' && !currentNode.id) {
			// Anonymous function expressions need names for standalone declarations
			const namedFunc = addNameToFE(currentNode, currentNode.parentNode?.id?.name);
			if (namedFunc) {
				currentNode = namedFunc;
				nodes[i] = currentNode;
			}
		}
		
		// Add to processed list if not already seen
		if (!seenNodes.has(currentNode)) {
			seenNodes.add(currentNode);
			processedNodes.push(currentNode);
		}
	}
	
	// Sort by nodeId to ensure proper execution order
	processedNodes.sort(sortByNodeId);
	
	// Generate source code with proper formatting
	let output = '';
	for (let i = 0; i < processedNodes.length; i++) {
		const n = processedNodes[i];
		const needsSemicolon = TYPES_REQUIRING_SEMICOLON.includes(n.type);
		const prefix = n.type === 'VariableDeclarator' ? `${n.parentNode.kind} ` : '';
		const suffix = needsSemicolon ? ';' : '';
		output += prefix + n.src + suffix + '\n';
	}
	
	return output;
}