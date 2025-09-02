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
describe('UTILS: doesDescendantMatchCondition', async () => {
	const targetModule = (await import('../src/modules/utils/doesDescendantMatchCondition.js')).doesDescendantMatchCondition;
	
	it('TP-1: Find descendant by type (boolean return)', () => {
		const code = `function test() { return this.prop; }`;
		const ast = generateFlatAST(code);
		const functionNode = ast.find(n => n.type === 'FunctionDeclaration');
		const result = targetModule(functionNode, n => n.type === 'ThisExpression');
		assert.ok(result);
	});
	it('TP-2: Find descendant by type (node return)', () => {
		const code = `function test() { return this.prop; }`;
		const ast = generateFlatAST(code);
		const functionNode = ast.find(n => n.type === 'FunctionDeclaration');
		const result = targetModule(functionNode, n => n.type === 'ThisExpression', true);
		assert.strictEqual(result.type, 'ThisExpression');
	});
	it('TP-3: Find marked descendant (simulating isMarked property)', () => {
		const code = `const a = 1 + 2;`;
		const ast = generateFlatAST(code);
		const varDecl = ast.find(n => n.type === 'VariableDeclaration');
		// Simulate marking a descendant node
		const binaryExpr = ast.find(n => n.type === 'BinaryExpression');
		binaryExpr.isMarked = true;
		const result = targetModule(varDecl, n => n.isMarked);
		assert.ok(result);
	});
	it('TP-4: Multiple nested descendants', () => {
		const code = `function outer() { function inner() { return this.value; } }`;
		const ast = generateFlatAST(code);
		const outerFunc = ast.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'outer');
		const result = targetModule(outerFunc, n => n.type === 'ThisExpression');
		assert.ok(result);
	});
	it('TP-5: Find specific assignment pattern', () => {
		const code = `const obj = {prop: value}; obj.prop = newValue;`;
		const ast = generateFlatAST(code);
		const program = ast[0];
		const result = targetModule(program, n => 
			n.type === 'AssignmentExpression' && 
			n.left?.property?.name === 'prop'
		);
		assert.ok(result);
	});
	it('TN-1: No matching descendants', () => {
		const code = `const a = 1 + 2;`;
		const ast = generateFlatAST(code);
		const varDecl = ast.find(n => n.type === 'VariableDeclaration');
		const result = targetModule(varDecl, n => n.type === 'ThisExpression');
		assert.strictEqual(result, false);
	});
	it('TN-2: Node itself matches condition', () => {
		const code = `const a = 1;`;
		const ast = generateFlatAST(code);
		const literal = ast.find(n => n.type === 'Literal');
		const result = targetModule(literal, n => n.type === 'Literal');
		assert.ok(result); // Should find the node itself
	});
	it('TN-3: Null/undefined input handling', () => {
		const result1 = targetModule(null, n => n.type === 'Literal');
		const result2 = targetModule(undefined, n => n.type === 'Literal');
		const result3 = targetModule({}, null);
		const result4 = targetModule({}, undefined);
		assert.strictEqual(result1, false);
		assert.strictEqual(result2, false);
		assert.strictEqual(result3, false);
		assert.strictEqual(result4, false);
	});
	it('TN-4: Node with no children', () => {
		const code = `const name = 'test';`;
		const ast = generateFlatAST(code);
		const literal = ast.find(n => n.type === 'Literal');
		const result = targetModule(literal, n => n.type === 'ThisExpression');
		assert.strictEqual(result, false);
	});
	it('TN-5: Empty childNodes array', () => {
		const mockNode = { type: 'MockNode', childNodes: [] };
		const result = targetModule(mockNode, n => n.type === 'ThisExpression');
		assert.strictEqual(result, false);
	});
});

describe('UTILS: generateHash', async () => {
	const targetModule = (await import('../src/modules/utils/generateHash.js')).generateHash;
	
	it('TP-1: Generate hash for normal string', () => {
		const input = 'const a = 1;';
		const result = targetModule(input);
		assert.strictEqual(typeof result, 'string');
		assert.strictEqual(result.length, 32); // MD5 produces 32-char hex
		assert.match(result, /^[a-f0-9]{32}$/); // Valid hex string
	});
	it('TP-2: Generate hash for AST node with .src property', () => {
		const mockNode = { src: 'const b = 2;', type: 'VariableDeclaration' };
		const result = targetModule(mockNode);
		assert.strictEqual(typeof result, 'string');
		assert.strictEqual(result.length, 32);
		assert.match(result, /^[a-f0-9]{32}$/);
	});
	it('TP-3: Generate hash for number input', () => {
		const result = targetModule(42);
		assert.strictEqual(typeof result, 'string');
		assert.strictEqual(result.length, 32);
		assert.match(result, /^[a-f0-9]{32}$/);
	});
	it('TP-4: Generate hash for boolean input', () => {
		const result = targetModule(true);
		assert.strictEqual(typeof result, 'string');
		assert.strictEqual(result.length, 32);
		assert.match(result, /^[a-f0-9]{32}$/);
	});
	it('TP-5: Generate hash for empty string', () => {
		const result = targetModule('');
		assert.strictEqual(typeof result, 'string');
		assert.strictEqual(result.length, 32);
		assert.match(result, /^[a-f0-9]{32}$/);
	});
	it('TP-6: Consistent hashes for identical inputs', () => {
		const input = 'function test() {}';
		const hash1 = targetModule(input);
		const hash2 = targetModule(input);
		assert.strictEqual(hash1, hash2);
	});
	it('TP-7: Different hashes for different inputs', () => {
		const hash1 = targetModule('const a = 1;');
		const hash2 = targetModule('const a = 2;');
		assert.notStrictEqual(hash1, hash2);
	});
	it('TN-1: Handle null input gracefully', () => {
		const result = targetModule(null);
		assert.strictEqual(result, 'null-undefined-hash');
	});
	it('TN-2: Handle undefined input gracefully', () => {
		const result = targetModule(undefined);
		assert.strictEqual(result, 'null-undefined-hash');
	});
	it('TN-3: Handle object without .src property', () => {
		const mockObj = { type: 'SomeNode', value: 42 };
		const result = targetModule(mockObj);
		assert.strictEqual(typeof result, 'string');
		// Should convert object to string representation
		assert.match(result, /^[a-f0-9]{32}$/);
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
	it('TP-8: Variable declarations with semicolons', () => {
		const code = 'const a = 1; let b = 2;';
		const expected = `const a = 1;\nlet b = 2;\n`;
		const ast = generateFlatAST(code);
		const targetNodes = [
			2, // a = 1
			5, // b = 2
		];
		const result = targetModule(targetNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
	it('TP-9: Assignment expressions with semicolons', () => {
		const code = 'let a; a = 1; a = 2;';
		const expected = `a = 1;\na = 2;\n`;
		const ast = generateFlatAST(code);
		const targetNodes = [
			8, // a = 2 (ExpressionStatement)
			4, // a = 1 (ExpressionStatement)
		];
		const result = targetModule(targetNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
	it('TP-10: Duplicate node elimination', () => {
		const code = 'a(); b();';
		const expected = `a();\nb();\n`;
		const ast = generateFlatAST(code);
		const duplicatedNodes = [
			2, // a()
			5, // b()
			2, // a() again (duplicate)
		];
		const result = targetModule(duplicatedNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
	it('TP-11: IIFE dependency ordering with arguments', () => {
		const code = 'const x = 1; (function(a){return a;})(x);';
		const expected = `const x = 1;\n(function(a){return a;})(x);\n`;
		const ast = generateFlatAST(code);
		const targetNodes = [
			5, // (function(a){return a;})(x)
			2, // x = 1
		];
		const result = targetModule(targetNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: Empty node array', () => {
		const expected = '';
		const result = targetModule([]);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2: Single node without reordering', () => {
		const code = 'a();';
		const expected = `a();\n`;
		const ast = generateFlatAST(code);
		const targetNodes = [2]; // a()
		const result = targetModule(targetNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: Non-CallExpression and non-FunctionExpression nodes', () => {
		const code = 'const a = 1; const b = "hello";';
		const expected = `const a = 1;\nconst b = "hello";\n`;
		const ast = generateFlatAST(code);
		const targetNodes = [
			5, // b = "hello"
			2, // a = 1
		];
		const result = targetModule(targetNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: CallExpression without ExpressionStatement parent', () => {
		const code = 'const result = a();';
		const expected = `const result = a();\n`;
		const ast = generateFlatAST(code);
		const targetNodes = [2]; // result = a()
		const result = targetModule(targetNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: Named function expressions (no renaming needed)', () => {
		const code = 'const f = function named() {};';
		const expected = `const f = function named() {};\n`;
		const ast = generateFlatAST(code);
		const targetNodes = [2]; // f = function named() {}
		const result = targetModule(targetNodes.map(n => ast[n]));
		assert.deepStrictEqual(result, expected);
	});
});

describe('UTILS: getCache', async () => {
	const getCache = (await import('../src/modules/utils/getCache.js')).getCache;
	
	// Reset cache before each test to ensure isolation
	beforeEach(() => {
		getCache.flush();
	});
	
	it('TP-1: Retain values for same script hash', () => {
		const hash1 = 'script-hash-1';
		const cache = getCache(hash1);
		assert.deepStrictEqual(cache, {});
		
		cache['eval-result'] = 'cached-value';
		const cache2 = getCache(hash1); // Same hash should return same cache
		assert.deepStrictEqual(cache2, {['eval-result']: 'cached-value'});
		assert.strictEqual(cache, cache2); // Should be same object reference
	});
	it('TP-2: Cache invalidation on script hash change', () => {
		const hash1 = 'script-hash-1';
		const hash2 = 'script-hash-2';
		
		const cache1 = getCache(hash1);
		cache1['data'] = 'first-script';
		
		// Different hash should get fresh cache
		const cache2 = getCache(hash2);
		assert.deepStrictEqual(cache2, {});
		assert.notStrictEqual(cache1, cache2); // Different object references
		
		// Original cache data should be lost
		const cache1Again = getCache(hash1);
		assert.deepStrictEqual(cache1Again, {}); // Fresh cache for hash1
	});
	it('TP-3: Manual flush preserves script hash', () => {
		const hash = 'preserve-hash';
		const cache = getCache(hash);
		cache['before-flush'] = 'data';
		
		getCache.flush();
		
		// Should get empty cache but same hash should not trigger invalidation
		const cacheAfterFlush = getCache(hash);
		assert.deepStrictEqual(cacheAfterFlush, {});
	});
	it('TP-4: Multiple script hash switches', () => {
		const hashes = ['hash-a', 'hash-b', 'hash-c'];
		
		// Fill cache for each hash
		for (let i = 0; i < hashes.length; i++) {
			const cache = getCache(hashes[i]);
			cache[`data-${i}`] = `value-${i}`;
		}
		
		// Only the last hash should have preserved cache
		const finalCache = getCache('hash-c');
		assert.deepStrictEqual(finalCache, {'data-2': 'value-2'});
		
		// Previous hashes should get fresh caches
		for (const hash of ['hash-a', 'hash-b']) {
			const cache = getCache(hash);
			assert.deepStrictEqual(cache, {});
		}
	});
	it('TP-5: Cache object mutation persistence', () => {
		const hash = 'mutation-test';
		const cache1 = getCache(hash);
		const cache2 = getCache(hash);
		
		// Both should reference the same object
		cache1['shared'] = 'value';
		assert.strictEqual(cache2['shared'], 'value');
		
		cache2['another'] = 'different';
		assert.strictEqual(cache1['another'], 'different');
	});
	it('TN-1: Handle null script hash gracefully', () => {
		const cache = getCache(null);
		assert.deepStrictEqual(cache, {});
		cache['null-test'] = 'handled';
		
		// Should maintain cache for 'no-hash' key
		const cache2 = getCache(null);
		assert.deepStrictEqual(cache2, {'null-test': 'handled'});
	});
	it('TN-2: Handle undefined script hash gracefully', () => {
		const cache = getCache(undefined);
		assert.deepStrictEqual(cache, {});
		cache['undefined-test'] = 'handled';
		
		// Should maintain cache for 'no-hash' key
		const cache2 = getCache(undefined);
		assert.deepStrictEqual(cache2, {'undefined-test': 'handled'});
	});
	it('TN-3: Null and undefined should share same fallback cache', () => {
		const cache1 = getCache(null);
		const cache2 = getCache(undefined);
		
		cache1['shared-fallback'] = 'test';
		assert.strictEqual(cache2['shared-fallback'], 'test');
		assert.strictEqual(cache1, cache2); // Same object reference
	});
	it('TN-4: Empty string script hash', () => {
		const cache = getCache('');
		assert.deepStrictEqual(cache, {});
		cache['empty-string'] = 'value';
		
		const cache2 = getCache('');
		assert.deepStrictEqual(cache2, {'empty-string': 'value'});
	});
	it('TN-5: Flush after multiple hash changes', () => {
		const hash1 = 'multi-1';
		const hash2 = 'multi-2';
		
		getCache(hash1)['data1'] = 'value1';
		getCache(hash2)['data2'] = 'value2'; // This invalidates hash1's cache
		
		getCache.flush(); // Should clear current (hash2) cache
		
		// Both should now be empty
		assert.deepStrictEqual(getCache(hash1), {});
		assert.deepStrictEqual(getCache(hash2), {});
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