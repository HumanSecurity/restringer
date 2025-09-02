import {BAD_VALUE} from '../config.js';
import {getObjType} from './getObjType.js';
import {generateCode, parseCode, logger} from 'flast';

/**
 * Create a node from a value by its type.
 * @param {*} value The value to be parsed into an ASTNode.
 * @returns {ASTNode|BAD_VALUE} The newly created node if successful; BAD_VALUE string otherwise.
 */
function createNewNode(value) {
	let newNode = BAD_VALUE;
	try {
		if (![undefined, null].includes(value) && value.__proto__.constructor.name === 'Node') value = generateCode(value);
		switch (getObjType(value)) {
			case 'String':
			case 'Number':
			case 'Boolean':
				if (['-', '+', '!'].includes(String(value)[0]) && String(value).length > 1) {
					const absVal = String(value).substring(1);
					if (Number.isNaN(parseInt(absVal)) && !['Infinity', 'NaN'].includes(absVal)) {
						newNode = {
							type: 'Literal',
							value,
							raw: String(value),
						};
					} else newNode = {
						type: 'UnaryExpression',
						operator: String(value)[0],
						argument: createNewNode(absVal),
					};
				} else if (['Infinity', 'NaN'].includes(String(value))) {
					newNode = {
						type: 'Identifier',
						name: String(value),
					};
				} else if (Object.is(value, -0)) {
					newNode = {
						type: 'UnaryExpression',
						operator: '-',
						argument: createNewNode(0),
					};
				} else {
					newNode = {
						type: 'Literal',
						value: value,
						raw: String(value),
					};
				}
				break;
			case 'Array': {
				const elements = [];
				for (const el of Array.from(value)) {
					elements.push(createNewNode(el));
				}
				newNode = {
					type: 'ArrayExpression',
					elements,
				};
				break;
			}
			case 'Object': {
				const properties = [];
				for (const [k, v] of Object.entries(value)) {
					const key = createNewNode(k);
					const val = createNewNode(v);
					if ([key, val].includes(BAD_VALUE)) {
						// noinspection ExceptionCaughtLocallyJS
						throw Error();
					}
					properties.push({
						type: 'Property',
						key,
						value: val,
					});
				}
				newNode = {
					type: 'ObjectExpression',
					properties,
				};
				break;
			}
			case 'Undefined':
				newNode = {
					type: 'Identifier',
					name: 'undefined',
				};
				break;
			case 'Null':
				newNode = {
					type: 'Literal',
					raw: 'null',
				};
				break;
			case 'Function': // Covers functions and classes
				try {
					newNode = parseCode(value).body[0];
				} catch {}  // Probably a native function
				break;
			case 'RegExp':
				newNode = {
					type: 'Literal',
					regex: {
						pattern: value.source,
						flags: value.flags,
					},
				};
				break;
		}
	} catch (e) {
		logger.debug(`[-] Unable to create a new node: ${e}`);
	}
	return newNode;
}

export {createNewNode};