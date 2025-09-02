/* eslint-disable no-unused-vars */
import assert from 'node:assert';
import {generateFlatAST} from 'flast';
import {describe, it, beforeEach} from 'node:test';
import {BAD_VALUE} from '../src/modules/config.js';

describe('UTILS: evalInVm', async () => {
	const targetModule = (await import('../src/modules/utils/evalInVm.js')).evalInVm;
	it('TP-1', () => {
		const code = `'hello ' + 'there';`;
		const expected = {type: 'Literal', value: 'hello there', raw: 'hello there'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1', () => {
		const code = `Math.random();`;
		const expected = BAD_VALUE;
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2', () => {
		const code = `function a() {return console;} a();`;
		const expected = BAD_VALUE;
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UTILS: areReferencesModified', async () => {
	const targetModule = (await import('../src/modules/utils/areReferencesModified.js')).areReferencesModified;
	it('TP-1: Update expression', () => {
		const code = `let a = 1; let b = 2 + a, c = a + 3; a++;`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = 1').id.references);
		assert.ok(result);
	});
	it('TP-2: Direct assignment', () => {
		const code = `let a = 1; let b = 2 + a, c = (a += 2) + 3;`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = 1').id.references);
		assert.ok(result);
	});
	it('TP-3: Assignment to property', () => {
		const code = `const a = {b: 2}; a.b = 1;`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = {b: 2}').id.references);
		assert.ok(result);
	});
	it('TP-4: Re-assignment to property', () => {
		const code = `const a = {b: 2}; a.b = 1; a.c = a.b; a.b = 3;`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, [ast.find(n => n.src === `a.c = a.b`)?.right]);
		assert.ok(result);
	});
	it('TP-5: Delete operation on object property', () => {
		const code = `const a = {b: 1, c: 2}; delete a.b;`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = {b: 1, c: 2}').id.references);
		assert.ok(result);
	});
	it('TP-6: Delete operation on array element', () => {
		const code = `const a = [1, 2, 3]; delete a[1];`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = [1, 2, 3]').id.references);
		assert.ok(result);
	});
	it('TP-7: For-in loop variable modification', () => {
		const code = `const a = {x: 1}; for (a.prop in {y: 2}) {}`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = {x: 1}').id.references);
		assert.ok(result);
	});
	it('TP-8: For-of loop variable modification', () => {
		const code = `let a = []; for (a.item of [1, 2, 3]) {}`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = []').id.references);
		assert.ok(result);
	});
	it('TP-9: Array mutating method call', () => {
		const code = `const a = [1, 2]; a.push(3);`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = [1, 2]').id.references);
		assert.ok(result);
	});
	it('TP-10: Array sort method call', () => {
		const code = `const a = [3, 1, 2]; a.sort();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = [3, 1, 2]').id.references);
		assert.ok(result);
	});
	it('TP-11: Object destructuring assignment', () => {
		const code = `let a = {x: 1}; ({x: a.y} = {x: 2});`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = {x: 1}').id.references);
		assert.ok(result);
	});
	it('TP-12: Array destructuring assignment', () => {
		const code = `let a = [1]; [a.item] = [2];`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = [1]').id.references);
		assert.ok(result);
	});
	it('TP-13: Update expression on member expression', () => {
		const code = `const a = {count: 0}; a.count++;`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = {count: 0}').id.references);
		assert.ok(result);
	});
	it('TN-1: No assignment', () => {
		const code = `const a = 1; let b = 2 + a, c = a + 3;`;
		const expected = false;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = 1').id.references);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2: Read-only property access', () => {
		const code = `const a = {b: 1}; const c = a.b;`;
		const expected = false;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = {b: 1}').id.references);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: Read-only array access', () => {
		const code = `const a = [1, 2, 3]; const b = a[1];`;
		const expected = false;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = [1, 2, 3]').id.references);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: Non-mutating method calls', () => {
		const code = `const a = [1, 2, 3]; const b = a.slice(1);`;
		const expected = false;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = [1, 2, 3]').id.references);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: For-in loop with different variable', () => {
		const code = `const a = {x: 1}; for (let key in a) {}`;
		const expected = false;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = {x: 1}').id.references);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-6: Safe destructuring (different variable)', () => {
		const code = `const a = {x: 1}; const {x} = a;`;
		const expected = false;
		const ast = generateFlatAST(code);
		const result = targetModule(ast, ast.find(n => n.src === 'a = {x: 1}').id.references);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UTILS: createNewNode', async () => {
	const targetModule = (await import('../src/modules/utils/createNewNode.js')).createNewNode;
	it('Literan: String', () => {
		const code = 'Baryo';
		const expected = {type: 'Literal', value: 'Baryo', raw: 'Baryo'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Literan: String that starts with !', () => {
		const code = '!Baryo';
		const expected = {type: 'Literal', value: '!Baryo', raw: '!Baryo'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Literal: Number - positive number', () => {
		const code = 3;
		const expected = {type: 'Literal', value: 3, raw: '3'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Literal: Number - negative number', () => {
		const code = -3;
		const expected =  {type: 'UnaryExpression', operator: '-', argument: {type: 'Literal', value: '3', raw: '3'}};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Literal: Number - negative infinity', () => {
		const code = -Infinity;
		const expected =  {type: 'UnaryExpression', operator: '-', argument: {type: 'Identifier', name: 'Infinity'}};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Literal: Number - negative zero', () => {
		const code = -0;
		const expected =  {type: 'UnaryExpression', operator: '-', argument: {type: 'Literal', value: 0, raw: '0'}};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Literal: Number - NOT operator', () => {
		const code = '!3';
		const expected =  {type: 'UnaryExpression', operator: '!', argument: {type: 'Literal', value: '3', raw: '3'}};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Literal: Number - Identifier', () => {
		const code1 = Infinity;
		const expected1 =  {type: 'Identifier', name: 'Infinity'};
		const result1 = targetModule(code1);
		assert.deepStrictEqual(result1, expected1);
		const code2 = NaN;
		const expected2 =  {type: 'Identifier', name: 'NaN'};
		const result2 = targetModule(code2);
		assert.deepStrictEqual(result2, expected2);
	});
	it('Literal: Boolean', () => {
		const code = true;
		const expected = {type: 'Literal', value: true, 'raw': 'true'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Array: empty', () => {
		const code = [];
		const expected = {type: 'ArrayExpression', elements: []};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Array: populated', () => {
		const code = [1, 'a'];
		const expected = {type: 'ArrayExpression', elements: [
			{type: 'Literal', value: 1, raw: '1'},
			{type: 'Literal', value: 'a', raw: 'a'}
		]};
		const result = targetModule(code);
		assert.deepEqual(result, expected);
	});
	it('Object: empty', () => {
		const code = {};
		const expected = {type: 'ObjectExpression', properties: []};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Object: populated', () => {
		const code = {a: 1};
		const expected = {type: 'ObjectExpression', properties: [{
			type: 'Property',
			key: {type: 'Literal', value: 'a', raw: 'a'},
			value: {type: 'Literal', value: 1, raw: '1'}
		}]};
		const result = targetModule(code);
		assert.deepEqual(result, expected);
	});
	it('Object: populated with BadValue', () => {
		const code = {a() {}};
		const expected = BAD_VALUE;
		const result = targetModule(code);
		assert.deepEqual(result, expected);
	});
	it('Undefined', () => {
		const code = undefined;
		const expected = {type: 'Identifier', name: 'undefined'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Null', () => {
		const code = null;
		const expected = {type: 'Literal', raw: 'null'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it.todo('TODO: Implement Function', () => {
	});
	it('RegExp', () => {
		const code = /regexp/gi;
		const expected = {type: 'Literal', regex: {flags: 'gi', pattern: 'regexp'}};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('BigInt', () => {
		const code = 123n;
		const expected = {type: 'Literal', value: 123n, raw: '123n', bigint: '123'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Symbol with description', () => {
		const code = Symbol('test');
		const expected = {
			type: 'CallExpression',
			callee: {type: 'Identifier', name: 'Symbol'},
			arguments: [{type: 'Literal', value: 'test', raw: 'test'}]
		};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('Symbol without description', () => {
		const code = Symbol();
		const expected = {
			type: 'CallExpression',
			callee: {type: 'Identifier', name: 'Symbol'},
			arguments: []
		};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});

});
describe('UTILS: createOrderedSrc', async () => {
	const targetModule = (await import('../src/modules/utils/createOrderedSrc.js')).createOrderedSrc;
	it('TP-1: Re-order nodes', () => {
		const code = 'a; b;';
		const expected = `a\nb\n`;
		const ast = generateFlatAST(code);
		const targetNodes = [
			4, // b()
			2, // a()
		];
		const result = targetModule(targetNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Wrap calls in expressions', () => {
		const code = 'a();';
		const expected = `a();\n`;
		const ast = generateFlatAST(code);const targetNodes = [
			2, // a()
		];
		const result = targetModule(targetNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: Push IIFEs to the end in order', () => {
		const code = '(function(a){})(); a(); (function(b){})(); b();';
		const expected = `a();\nb();\n(function(a){})();\n(function(b){})();\n`;
		const ast = generateFlatAST(code);
		const targetNodes = [
			10, // (function(b){})()
			15, // b()
			7, // a()
			2, // (function(a){})()
		];
		const result = targetModule(targetNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
	it('TP-4: Add dynamic name to IIFEs', () => {
		const code = '!function(a){}(); a();';
		const expected = `a();\n(function func3(a){}());\n`;
		const ast = generateFlatAST(code);const targetNodes = [
			3, // function(a){}()
			8, // a()
		];
		const result = targetModule(targetNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
	it('TP-5: Add variable name to IIFEs', () => {
		const code = 'const b = function(a){}(); a();';
		const expected = `a();\n(function b(a){}());\n`;
		const ast = generateFlatAST(code);const targetNodes = [
			4, // function(a){}()
			9, // a()
		];
		const result = targetModule(targetNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
	it(`TP-6: Preserve node order`, () => {
		const code = '(function(a){})(); a(); (function(b){})(); b();';
		const expected = `(function(a){})();\na();\n(function(b){})();\nb();\n`;
		const ast = generateFlatAST(code);
		const targetNodes = [
			10, // (function(b){})()
			7, // a()
			15, // b()
			2, // (function(a){})()
		];
		const result = targetModule(targetNodes.map(n => ast[n]), true);
		assert.deepStrictEqual(result, expected);
	});
	it(`TP-7: Standalone FEs`, () => {
		const code = '~function(iife1){}();~function(iife2){}();';
		const expected = `(function func4(iife1){});\n(function func10(iife2){});\n`;
		const ast = generateFlatAST(code);
		const targetNodes = [
			10, // function(iife2){}
			4, // function(iife1){}
		];
		const result = targetModule(targetNodes.map(n => ast[n]), true);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UTILS: doesBinaryExpressionContainOnlyLiterals', async () => {
	const targetModule = (await import('../src/modules/utils/doesBinaryExpressionContainOnlyLiterals.js')).doesBinaryExpressionContainOnlyLiterals;
	it('TP-1: Literal', () => {
		const code = `'a';`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'Literal'));
		assert.ok(result);
	});
	it('TP-2: Unary literal', () => {
		const code = `-'a';`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'UnaryExpression'));
		assert.ok(result);
	});
	it('TP-3: Binary expression', () => {
		const code = `1 + 2`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'BinaryExpression'));
		assert.ok(result);
	});
	it('TP-4: Nesting binary expressions', () => {
		const code = `1 + 2 + 3 + 4`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'BinaryExpression'));
		assert.ok(result);
	});
	it('TN-1: Identifier', () => {
		const code = `a`;
		const expected = false;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'Identifier'));
		assert.strictEqual(result, expected);
	});
	it('TN-2: Unary Identifier', () => {
		const code = `!a`;
		const expected = false;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'UnaryExpression'));
		assert.strictEqual(result, expected);
	});
	it('TN-3: Binary expression', () => {
		const code = `1 + b`;
		const expected = false;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'BinaryExpression'));
		assert.strictEqual(result, expected);
	});
	it('TN-3: Nesting binary expression', () => {
		const code = `1 + b + 3 + 4`;
		const expected = false;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'BinaryExpression'));
		assert.strictEqual(result, expected);
	});
});
describe('UTILS: getCache', async () => {
	const getCache = (await import('../src/modules/utils/getCache.js')).getCache;
	it('TP-1: Retain values', () => {
		const key1 = 'hash1';
		const key2 = 'hash2';
		const cache = getCache(key1);
		assert.deepStrictEqual(cache, {});
		cache['key1'] = 'value1';
		const expectedC1 = {key1: 'value1'};
		assert.deepStrictEqual(cache, expectedC1);
		const cache2 = getCache(key1);
		assert.deepStrictEqual(cache2, expectedC1);
		const cache3 = getCache(key2);
		assert.deepStrictEqual(cache3, {});
	});
	it('TP-2: Flush cache', () => {
		const key = 'flush1';
		let cache = getCache(key);
		assert.deepStrictEqual(cache, {});
		cache['k'] = 'v';
		const expectedC1 = {k: 'v'};
		assert.deepStrictEqual(cache, expectedC1);
		getCache.flush();
		cache = getCache(key);
		assert.deepStrictEqual(cache, {});
	});
});
describe('UTILS: getCalleeName', async () => {
	const targetModule = (await import('../src/modules/utils/getCalleeName.js')).getCalleeName;
	it('TP-1: Simple call expression', () => {
		const code = `a();`;
		const expected = 'a';
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Member expression callee', () => {
		const code = `a.b();`;
		const expected = 'a';
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: Nested member expression callee', () => {
		const code = `a.b.c();`;
		const expected = 'a';
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.deepStrictEqual(result, expected);
	});
	it('TP-4: Literal callee (string)', () => {
		const code = `'a'.split('');`;
		const expected = 'a';
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.deepStrictEqual(result, expected);
	});
	it('TP-5: Literal callee (number)', () => {
		const code = `1..toString();`;
		const expected = 1;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.deepStrictEqual(result, expected);
	});
});
describe('UTILS: getDeclarationWithContext', async () => {
	const targetModule = (await import('../src/modules/utils/getDeclarationWithContext.js')).getDeclarationWithContext;
	const getCache = (await import('../src/modules/utils/getCache.js')).getCache;
	beforeEach(() => {
		getCache.flush();
	});
	it(`TP-1: Call expression with function declaration`, () => {
		const code = `function a() {return 1;}\na();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		const expected = [ast[7], ast[1]];
		assert.deepStrictEqual(result, expected);
	});
	it(`TP-2: Call expression with function expression`, () => {
		const code = `const a = () => 2;\na();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		const expected = [ast[7], ast[2]];
		assert.deepStrictEqual(result, expected);
	});
	it(`TP-3: Nested call with FE`, () => {
		const code = `const b = 3;\nconst a = () => b;\na();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		const expected = [ast[11], ast[6], ast[2]];
		assert.deepStrictEqual(result, expected);
	});
	it(`TP-4: Anti-debugging function overwrite`, () => {
		const code = `function a() {}\na = {};\na.b = 2;\na = {};\na(a.b);`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'FunctionDeclaration'));
		const expected = [ast[1], ast[9]];
		assert.deepStrictEqual(result, expected);
	});
	it(`TP-5: Collect assignments on references`, () => {
		const code = `let a = 1; function b(arg) {arg = 3;} b(a);`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'Identifier' && n.name === 'a'));
		const expected = [ast[2], ast[14], ast[5]];
		assert.deepStrictEqual(result, expected);
	});
	it(`TP-6: Collect relevant parents for anonymous FE`, () => {
		const code = `(function() {})()`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'FunctionExpression'));
		const expected = [ast[2]];
		assert.deepStrictEqual(result, expected);
	});
	it(`TN-1: Prevent collection before changes are applied` , () => {
		const code = `function a() {}\na = {};\na.b = 2;\na = a.b;\na(a.b);`;
		const ast = generateFlatAST(code);
		ast[9].isMarked = true;
		const result = targetModule(ast.find(n => n.src === 'a = a.b'), true);
		const expected = [];
		assert.deepStrictEqual(result, expected);
	});
});
describe('UTILS: getDescendants', async () => {
	const targetModule = (await import('../src/modules/utils/getDescendants.js')).getDescendants;
	it('TP-1', () => {
		const code = `a + b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'BinaryExpression');
		const expected = ast.slice(targetNode.nodeId + 1);
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Limited scope', () => {
		const code = `a + -b; c + d;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'BinaryExpression');
		const expected = ast.slice(targetNode.nodeId + 1, targetNode.nodeId + 4);
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: No descendants', () => {
		const code = `a; b; c;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'Identifier');
		const expected = [];
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UTILS: getMainDeclaredObjectOfMemberExpression', async () => {
	const targetModule = (await import('../src/modules/utils/getMainDeclaredObjectOfMemberExpression.js')).getMainDeclaredObjectOfMemberExpression;
	it('TP-1', () => {
		const code = `a.b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'MemberExpression');
		const expected = targetNode.object;
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Nested member expression', () => {
		const code = `a.b.c.d;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'MemberExpression');
		const expected = ast.find(n => n.type === 'Identifier' && n.src === 'a');
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UTILS: isNodeInRanges', async () => {
	const targetModule = (await import('../src/modules/utils/isNodeInRanges.js')).isNodeInRanges;
	it('TP-1: In range', () => {
		const code = `a.b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.src === 'b');
		const result = targetModule(targetNode, [[2, 3]]);
		assert.ok(result);
	});
	it('TN-1: Not in range', () => {
		const code = `a.b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.src === 'b');
		const result = targetModule(targetNode, [[1, 2]]);
		const expected = false;
		assert.strictEqual(result, expected);
	});
});