const evalInVm = require(__dirname + '/evalInVm');
const getCache = require(__dirname + '/../utils/getCache');
const getCalleeName = require(__dirname + '/../utils/getCalleeName');
const isNodeInRanges = require(__dirname + '/../utils/isNodeInRanges');
const createOrderedSrc = require(__dirname + '/../utils/createOrderedSrc');
const getDeclarationWithContext = require(__dirname + '/../utils/getDeclarationWithContext');
const {badValue, badArgumentTypes, skipIdentifiers, skipProperties} = require(__dirname + '/../config');

/**
 * Collect all available context on call expressions where the callee is defined in the script and attempt
 * to resolve their value.
 * @param {Arborist} arb
 * @return {Arborist}
 */
function resolveLocalCalls(arb) {
	const cache = getCache(arb.ast[0].scriptHash);
	const candidates = arb.ast.filter(n =>
		n.type === 'CallExpression' &&
		(n.callee?.declNode ||
			(n.callee?.object?.declNode &&
				!skipProperties.includes(n.callee.property?.value || n.callee.property?.name)) ||
			n.callee?.object?.type === 'Literal'));

	const frequency = {};
	candidates.map(c => getCalleeName(c)).forEach(name => {
		if (!frequency[name]) frequency[name] = 0;
		frequency[name]++;
	});
	const sortByFrequency = (a, b) => {
		a = getCalleeName(a);
		b = getCalleeName(b);
		return frequency[a] < frequency[b] ? 1 : frequency[b] < frequency[a] ? -1 : 0;
	};

	const modifiedRanges = [];
	for (const c of candidates.sort(sortByFrequency)) {
		if (c.arguments.find(a => badArgumentTypes.includes(a.type))) continue;
		if (isNodeInRanges(c, modifiedRanges)) continue;
		const callee = c.callee?.object || c.callee;
		const declNode = c.callee?.declNode || c.callee?.object?.declNode;
		if (declNode?.parentNode?.body?.body?.length && declNode.parentNode?.body?.body[0].type === 'ReturnStatement') {
			// Leave this replacement to a safe function
			const returnArg = declNode.parentNode.body.body[0].argument;
			if (['Literal', 'Identifier'].includes(returnArg.type) || /Function/.test(returnArg.type)) continue;   // Unwrap identifier
			else if (returnArg.type === 'CallExpression' &&
				returnArg.callee?.object?.type === 'FunctionExpression' &&
				(returnArg.callee.property?.name || returnArg.callee.property?.value) === 'apply') continue;    // Unwrap function shells
		}
		const cacheName = `rlc-${callee.name || callee.value}-${declNode?.nodeId}`;
		if (!cache[cacheName]) {
			// Skip call expressions with problematic values
			if (skipIdentifiers.includes(callee.name) ||
				(callee.type === 'ArrayExpression' && !callee.elements.length) ||
				!!(callee.arguments || []).find(a => skipIdentifiers.includes(a) || a?.type === 'ThisExpression')) continue;
			if (declNode) {
				// Verify the declNode isn't a simple wrapper for an identifier
				if (declNode.parentNode.type === 'FunctionDeclaration' &&
					declNode.parentNode?.body?.body?.length &&
					['Identifier', 'Literal'].includes(declNode.parentNode.body.body[0]?.argument?.type)) continue;
				cache[cacheName] = createOrderedSrc(getDeclarationWithContext(declNode.parentNode));
			}
		}
		const context = cache[cacheName];
		const src = context ? `${context}\n${c.src}` : c.src;
		const newNode = evalInVm(src);
		if (newNode !== badValue && newNode.type !== 'FunctionDeclaration') {
			arb.markNode(c, newNode);
			modifiedRanges.push(c.range);
		}
	}
	return arb;
}

module.exports = resolveLocalCalls;