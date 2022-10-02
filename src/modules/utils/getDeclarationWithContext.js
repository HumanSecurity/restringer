const isNodeMarked = require(__dirname + '/isNodeMarked');
const isNodeInRanges = require(__dirname + '/isNodeInRanges');
const generateScriptHash = require(__dirname + '/generateScriptHash');
const {propertiesThatModifyContent} = require(__dirname + '/../config');

const cache = {};
const skipCollectionTypes = [
	'Literal',
	'Identifier',
	'MemberExpression',
];

/**
 *
 * @param {ASTNode} originNode
 * @return {ASTNode[]} A flat array of all available declarations and call expressions relevant to
 * the context of the origin node.
 */
function getDeclarationWithContext(originNode) {
	const scriptHash = originNode.scriptHash;
	if (!cache[scriptHash]) cache[scriptHash] = {};
	const srcHash = generateScriptHash(originNode.src);
	const cacheNameId = `context-${originNode.nodeId}-${srcHash}`;
	const cacheNameSrc = `context-${srcHash}`;
	let cached = cache[scriptHash][cacheNameId] || cache[scriptHash][cacheNameSrc];
	if (!cached) {
		const collectedContext = [originNode];
		const examineStack = [originNode];
		const collectedContextIds = [];
		const collectedRanges = [];
		const examinedIds = [];
		while (examineStack.length) {
			const relevantNode = examineStack.pop();
			if (examinedIds.includes(relevantNode.nodeId)) continue;
			else examinedIds.push(relevantNode.nodeId);
			if (isNodeMarked(relevantNode)) continue;
			collectedContextIds.push(relevantNode.nodeId);
			collectedRanges.push(relevantNode.range);
			let relevantScope = relevantNode.scope;
			const assignments = [];
			const references = [];
			switch (relevantNode.type) {
				case 'VariableDeclarator':
					relevantScope = relevantNode.init?.scope || relevantNode.id.scope;
					// Collect direct assignments
					assignments.push(...relevantNode.id.references.filter(r =>
						r.parentNode.type === 'AssignmentExpression' &&
						r.parentKey === 'left')
						.map(r => r.parentNode));
					// Collect assignments to variable properties
					assignments.push(...relevantNode.id.references.filter(r =>
						r.parentNode.type === 'MemberExpression' &&
						((r.parentNode.parentNode.type === 'AssignmentExpression' &&
								r.parentNode.parentKey === 'left') ||
							(r.parentKey === 'object' &&
								propertiesThatModifyContent.includes(r.parentNode.property?.value || r.parentNode.property.name))))
						.map(r => r.parentNode.parentNode));
					// Find augmenting functions
					references.push(...relevantNode.id.references.filter(r =>
						r.parentNode.type === 'CallExpression' &&
						r.parentKey === 'arguments')
						.map(r => r.parentNode));
					break;
				case 'AssignmentExpression':
					relevantScope = relevantNode.right?.scope;
					examineStack.push(relevantNode.right);
					break;
				case 'CallExpression':
					relevantScope = relevantNode.callee.scope;
					references.push(...relevantNode.arguments.filter(a => a.type === 'Identifier'));
					break;
				case 'MemberExpression':
					relevantScope = relevantNode.object.scope;
					examineStack.push(relevantNode.property);
					break;
				case 'Identifier':
					if (relevantNode.declNode) {
						relevantScope = relevantNode.declNode.scope;
						references.push(relevantNode.declNode.parentNode);
					}
					break;
			}

			// noinspection JSUnresolvedVariable
			const contextToCollect = [...new Set(
				relevantScope.through.map(ref => ref.identifier?.declNode?.parentNode)
					.concat(assignments)
					.concat(references))
			].map(ref => ref?.declNode ? ref.declNode : ref);
			for (const rn of contextToCollect) {
				if (rn && !collectedContextIds.includes(rn.nodeId) && !isNodeInRanges(rn, collectedRanges)) {
					collectedRanges.push(rn.range);
					collectedContextIds.push(rn.nodeId);
					collectedContext.push(rn);
					examineStack.push(rn);
					for (const cn of (rn.childNodes || [])) {
						examineStack.push(cn);
					}
				}
			}
		}
		cached = collectedContext.filter(n => !skipCollectionTypes.includes(n.type));
		cache[scriptHash][cacheNameId] = cached;        // Caching context for the same node
		cache[scriptHash][cacheNameSrc] = cached;       // Caching context for a different node with similar content
	}
	return cached;
}

module.exports = getDeclarationWithContext;