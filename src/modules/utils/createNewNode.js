import {BAD_VALUE} from '../config.js';
import {getObjType} from './getObjType.js';
import {generateCode, parseCode, logger} from 'flast';

/**
 * Creates an AST node from a JavaScript value by analyzing its type and structure.
 * Handles primitive types, arrays, objects, and special cases like negative zero,
 * unary expressions, and AST nodes. Returns BAD_VALUE for unsupported types.
 * @param {*} value - The JavaScript value to convert into an AST node
 * @return {ASTNode|BAD_VALUE} The newly created AST node if successful; BAD_VALUE otherwise
 */
export function createNewNode(value) {
	let newNode = BAD_VALUE;
	try {
		const valueType = getObjType(value);
		switch (valueType) {
		case 'Node':
			newNode = value;
			break;
		case 'String':
		case 'Number':
		case 'Boolean': {
			const valueStr = String(value);
			const firstChar = valueStr[0];
			
			// Handle unary expressions like -3, +5, !true (from string representations)  
			if (['-', '+', '!'].includes(firstChar) && valueStr.length > 1) {
				const absVal = valueStr.substring(1);
				// Check if the remaining part is numeric (integers only to maintain original behavior)
				if (isNaN(parseInt(absVal)) && !['Infinity', 'NaN'].includes(absVal)) {
					// Non-numeric string like "!hello" - treat as literal
					newNode = {
						type: 'Literal',
						value,
						raw: valueStr,
					};
				} else {
					// Create unary expression maintaining string representation for consistency
					newNode = {
						type: 'UnaryExpression',
						operator: firstChar,
						argument: createNewNode(absVal),
					};
				}
			} else if (['Infinity', 'NaN'].includes(valueStr)) {
				// Special numeric identifiers
				newNode = {
					type: 'Identifier',
					name: valueStr,
				};
			} else if (Object.is(value, -0)) {
				// Special case: negative zero requires unary expression
				newNode = {
					type: 'UnaryExpression',
					operator: '-',
					argument: createNewNode(0),
				};
			} else {
				// Regular literal values
				newNode = {
					type: 'Literal',
					value: value,
					raw: valueStr,
				};
			}
			break;
		}
		case 'Array': {
			const elements = [];
			// Direct iteration over array (value is already an array)
			for (let i = 0; i < value.length; i++) {
				const elementNode = createNewNode(value[i]);
				if (elementNode === BAD_VALUE) {
					// If any element fails to convert, fail the entire array
					throw new Error('Array contains unconvertible element');
				}
				elements.push(elementNode);
			}
			newNode = {
				type: 'ArrayExpression',
				elements,
			};
			break;
		}
		case 'Object': {
			const properties = [];
			const entries = Object.entries(value);
			
			for (let i = 0; i < entries.length; i++) {
				const [k, v] = entries[i];
				const key = createNewNode(k);
				const val = createNewNode(v);
				
				// If any property key or value fails to convert, fail the entire object
				if (key === BAD_VALUE || val === BAD_VALUE) {
					throw new Error('Object contains unconvertible property');
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
		case 'BigInt':
			newNode = {
				type: 'Literal',
				value: value,
				raw: value.toString() + 'n',
				bigint: value.toString(),
			};
			break;
		case 'Symbol':
			// Symbols cannot be represented as literals in AST
			// They must be created via Symbol() calls
			const symbolDesc = value.description;
			if (symbolDesc) {
				newNode = {
					type: 'CallExpression',
					callee: {type: 'Identifier', name: 'Symbol'},
					arguments: [createNewNode(symbolDesc)],
				};
			} else {
				newNode = {
					type: 'CallExpression',
					callee: {type: 'Identifier', name: 'Symbol'},
					arguments: [],
				};
			}
			break;
		case 'Function': // Covers functions and classes
			try {
				// Attempt to parse function source code into AST
				const parsed = parseCode(value.toString());
				if (parsed?.body?.[0]) {
					newNode = parsed.body[0];
				}
			} catch {
				// Native functions or unparseable functions return BAD_VALUE
				// This is expected behavior for built-in functions like Math.max
			}
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