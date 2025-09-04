/* eslint-disable no-unused-vars */
import assert from 'node:assert';
import {generateFlatAST} from 'flast';
import {describe, it, beforeEach} from 'node:test';
import {BAD_VALUE} from '../src/modules/config.js';

describe('UTILS: evalInVm', async () => {
	const targetModule = (await import('../src/modules/utils/evalInVm.js')).evalInVm;
	it('TP-1: String concatenation', () => {
		const code = `'hello ' + 'there';`;
		const expected = {type: 'Literal', value: 'hello there', raw: 'hello there'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Arithmetic operations', () => {
		const code = `5 + 3 * 2`;
		const expected = {type: 'Literal', value: 11, raw: '11'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: Array literal evaluation', () => {
		const code = `[1, 2, 3]`;
		const result = targetModule(code);
		assert.strictEqual(result.type, 'ArrayExpression');
		assert.strictEqual(result.elements.length, 3);
	});
	it('TP-4: Object literal evaluation', () => {
		const code = `({a: 1, b: 2})`;
		const result = targetModule(code);
		assert.strictEqual(result.type, 'ObjectExpression');
		assert.strictEqual(result.properties.length, 2);
	});
	it('TP-5: Boolean operations', () => {
		const code = `true && false`;
		const expected = {type: 'Literal', value: false, raw: 'false'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-6: Array length property', () => {
		const code = `[1, 2, 3].length`;
		const expected = {type: 'Literal', value: 3, raw: '3'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-7: String method calls', () => {
		const code = `'test'.toUpperCase()`;
		const expected = {type: 'Literal', value: 'TEST', raw: 'TEST'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-8: Caching behavior - identical code returns same result', () => {
		const code = `2 + 2`;
		const result1 = targetModule(code);
		const result2 = targetModule(code);
		assert.deepStrictEqual(result1, result2);
	});
	it('TP-9: Sandbox reuse', async () => {
		const {Sandbox} = await import('../src/modules/utils/sandbox.js');
		const sandbox = new Sandbox();
		const code = `5 * 5`;
		const expected = {type: 'Literal', value: 25, raw: '25'};
		const result = targetModule(code, sandbox);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-10: Multi-statement code with valid operations', () => {
		const code = `var x = 5; x * 2`;
		const expected = {type: 'Literal', value: 10, raw: '10'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-11: Trap neutralization - infinite while loop', () => {
		const code = `while(true) {}; 'safe'`;
		const expected = {type: 'Literal', value: 'safe', raw: 'safe'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-12: Complex expression evaluation', () => {
		const code = `Math.pow(2, 3) + 2`;
		const expected = {type: 'Literal', value: 10, raw: '10'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-14: Debugger statement (neutralized and evaluates successfully)', () => {
		const code = `debugger; 42`;
		const expected = {type: 'Literal', value: 42, raw: '42'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-13: Split debugger string neutralization works', () => {
		const code = `'debu' + 'gger'; 123`;
		const expected = {type: 'Literal', value: 123, raw: '123'};
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: Non-deterministic function calls', () => {
		const code = `Math.random();`;
		const expected = BAD_VALUE;
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2: Console object evaluation', () => {
		const code = `function a() {return console;} a();`;
		const expected = BAD_VALUE;
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: Promise objects (bad type)', () => {
		const code = `Promise.resolve(42)`;
		const expected = BAD_VALUE;
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: Invalid syntax', () => {
		const code = `invalid syntax {{{`;
		const expected = BAD_VALUE;
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: Function calls with side effects', () => {
		const code = `alert('test')`;
		const expected = BAD_VALUE;
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-6: Variable references (undefined)', () => {
		const code = `unknownVariable`;
		const expected = BAD_VALUE;
		const result = targetModule(code);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-7: Complex expressions with timing dependencies', () => {
		const code = `Date.now()`;
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
	it('Object: populated with BAD_VALUE', () => {
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
	it('TP-1: Simple identifier callee', () => {
		const code = `func();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.strictEqual(result, 'func');
	});
	it('TP-2: Member expression callee (single level)', () => {
		const code = `obj.method();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.strictEqual(result, 'obj');
	});
	it('TP-3: Nested member expression callee', () => {
		const code = `obj.nested.method();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.strictEqual(result, 'obj');
	});
	it('TP-4: Deeply nested member expression', () => {
		const code = `obj.a.b.c.d();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.strictEqual(result, 'obj');
	});
	it('TP-5: Avoid counting collision between function and literal calls', () => {
		// This test demonstrates the collision avoidance
		const code = `function t1() { return 1; } t1(); 't1'.toString();`;
		const ast = generateFlatAST(code);
		const calls = ast.filter(n => n.type === 'CallExpression');
		
		const functionCall = calls[0]; // t1()
		const literalMethodCall = calls[1]; // 't1'.toString()
		
		assert.strictEqual(targetModule(functionCall), 't1'); // Function call counted
		assert.strictEqual(targetModule(literalMethodCall), ''); // Literal method not counted
	});
	it('TN-1: Literal string method calls return empty', () => {
		const code = `'test'.split('');`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.strictEqual(result, ''); // Don't count literal methods
	});
	it('TN-2: Literal number method calls return empty', () => {
		const code = `1..toString();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.strictEqual(result, ''); // Don't count literal methods
	});
	it('TN-3: ThisExpression method calls return empty', () => {
		const code = `this.method();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.strictEqual(result, ''); // Don't count 'this' methods
	});
	it('TN-4: Boolean literal method calls return empty', () => {
		const code = `true.valueOf();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.strictEqual(result, ''); // Don't count literal methods
	});
	it('TN-5: Logical expression callee returns empty', () => {
		const code = `(func || fallback)();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.strictEqual(result, ''); // Don't count complex expressions
	});
	it('TN-6: CallExpression as base object returns empty', () => {
		const code = `func()[0]();`;
		const ast = generateFlatAST(code);
		const outerCall = ast.filter(n => n.type === 'CallExpression')[0]; // First = outer call func()[0]()
		const result = targetModule(outerCall);
		assert.strictEqual(result, ''); // Don't count chained calls
	});
	it('TN-7: Null/undefined input handling', () => {
		const result1 = targetModule(null);
		const result2 = targetModule(undefined);
		const result3 = targetModule({});
		const result4 = targetModule({callee: null});
		assert.strictEqual(result1, '');
		assert.strictEqual(result2, '');
		assert.strictEqual(result3, '');
		assert.strictEqual(result4, '');
	});
	it('TN-8: Computed member expression with identifier', () => {
		const code = `obj[key]();`;
		const ast = generateFlatAST(code);
		const result = targetModule(ast.find(n => n.type === 'CallExpression'));
		assert.strictEqual(result, 'obj'); // Variable method call, return base variable
	});
	it('TN-9: Complex callee without name returns empty', () => {
		// Create mock node with no name/value
		const mockCall = {
			callee: {
				type: 'SomeComplexExpression',
				// No name, value, or object properties
			}
		};
		const result = targetModule(mockCall);
		assert.strictEqual(result, ''); // Complex expressions return empty
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
	it(`TP-7: Node without scriptHash should still work` , () => {
		const code = `function test() { return 42; } test();`;
		const ast = generateFlatAST(code);
		const callNode = ast.find(n => n.type === 'CallExpression');
		delete callNode.scriptHash; // Remove scriptHash property
		const result = targetModule(callNode);
		const expected = [ast.find(n => n.type === 'CallExpression'), ast.find(n => n.type === 'FunctionDeclaration')];
		assert.deepStrictEqual(result, expected);
	});
	it(`TP-8: Node without nodeId should still work` , () => {
		const code = `const x = 1; console.log(x);`;
		const ast = generateFlatAST(code);
		const callNode = ast.find(n => n.type === 'CallExpression');
		delete callNode.nodeId; // Remove nodeId property
		const result = targetModule(callNode);
		assert.ok(Array.isArray(result));
		assert.ok(result.length > 0);
	});
	it(`TN-1: Prevent collection before changes are applied` , () => {
		const code = `function a() {}\na = {};\na.b = 2;\na = a.b;\na(a.b);`;
		const ast = generateFlatAST(code);
		ast[9].isMarked = true;
		const result = targetModule(ast.find(n => n.src === 'a = a.b'), true);
		const expected = [];
		assert.deepStrictEqual(result, expected);
	});
	it(`TN-2: Handle null input gracefully` , () => {
		const result = targetModule(null);
		const expected = [];
		assert.deepStrictEqual(result, expected);
	});
	it(`TN-3: Handle undefined input gracefully` , () => {
		const result = targetModule(undefined);
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
	it('TP-3: Nested function with complex descendants', () => {
		const code = `function test(a) { return a + (b * c); }`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'FunctionDeclaration');
		const result = targetModule(targetNode);
		// Should include all nested nodes: parameters, body, expressions, identifiers
		assert.ok(Array.isArray(result));
		assert.ok(result.length > 8); // Should have many nested descendants
		assert.ok(result.some(n => n.type === 'Identifier' && n.name === 'a'));
		assert.ok(result.some(n => n.type === 'BinaryExpression'));
	});
	it('TP-4: Object expression with properties', () => {
		const code = `const obj = { prop1: value1, prop2: value2 };`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'ObjectExpression');
		const result = targetModule(targetNode);
		assert.ok(Array.isArray(result));
		assert.ok(result.length > 4); // Properties and their values
		assert.ok(result.some(n => n.type === 'Property'));
		assert.ok(result.some(n => n.type === 'Identifier' && n.name === 'value1'));
	});
	it('TP-5: Array expression with elements', () => {
		const code = `const arr = [a, b + c, func()];`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'ArrayExpression');
		const result = targetModule(targetNode);
		assert.ok(Array.isArray(result));
		assert.ok(result.length > 5); // Elements and their nested parts
		assert.ok(result.some(n => n.type === 'Identifier' && n.name === 'a'));
		assert.ok(result.some(n => n.type === 'BinaryExpression'));
		assert.ok(result.some(n => n.type === 'CallExpression'));
	});
	it('TP-6: Caching behavior - same node returns cached result', () => {
		const code = `a + b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'BinaryExpression');
		
		const result1 = targetModule(targetNode);
		const result2 = targetModule(targetNode);
		
		// Should return same cached array reference
		assert.strictEqual(result1, result2);
		assert.ok(targetNode.descendants); // Cache property should exist
		assert.strictEqual(targetNode.descendants, result1);
	});
	it('TN-1: No descendants for leaf nodes', () => {
		const code = `a; b; c;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'Identifier');
		const expected = [];
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2: Null input returns empty array', () => {
		const result = targetModule(null);
		const expected = [];
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: Undefined input returns empty array', () => {
		const result = targetModule(undefined);
		const expected = [];
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: Node with no childNodes property', () => {
		const mockNode = { type: 'MockNode' }; // No childNodes
		const result = targetModule(mockNode);
		const expected = [];
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: Node with empty childNodes array', () => {
		const mockNode = { type: 'MockNode', childNodes: [] };
		const result = targetModule(mockNode);
		const expected = [];
		assert.deepStrictEqual(result, expected);
	});
});
describe('UTILS: getMainDeclaredObjectOfMemberExpression', async () => {
	const targetModule = (await import('../src/modules/utils/getMainDeclaredObjectOfMemberExpression.js')).getMainDeclaredObjectOfMemberExpression;
	it('TP-1: Simple member expression with declared object', () => {
		const code = `a.b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'MemberExpression');
		const expected = targetNode.object;
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Nested member expression finds root identifier', () => {
		const code = `a.b.c.d;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'MemberExpression');
		const expected = ast.find(n => n.type === 'Identifier' && n.src === 'a');
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: Computed member expression with declared base', () => {
		const code = `obj[key].prop;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'MemberExpression' && n.property?.name === 'prop');
		const expected = ast.find(n => n.type === 'Identifier' && n.name === 'obj');
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-4: Deep nesting finds correct root', () => {
		const code = `root.level1.level2.level3.level4;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'MemberExpression' && n.property?.name === 'level4');
		const expected = ast.find(n => n.type === 'Identifier' && n.name === 'root');
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: Non-MemberExpression input returns the input unchanged', () => {
		const code = `const x = 42;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'Identifier' && n.name === 'x');
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, targetNode); // Original behavior: return input unchanged
	});
	it('TN-2: Null input returns null', () => {
		const result = targetModule(null);
		assert.strictEqual(result, null);
	});
	it('TN-3: Undefined input returns null', () => {
		const result = targetModule(undefined);
		assert.strictEqual(result, null);
	});
	it('TN-4: Member expression with no declNode still returns the object', () => {
		const code = `undeclared.prop;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'MemberExpression');
		// Remove declNode from the identifier to simulate undeclared variable
		const identifier = targetNode.object;
		delete identifier.declNode;
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, identifier); // Should return the identifier even without declNode
	});
	it('TN-5: Non-MemberExpression with declNode returns itself', () => {
		const code = `const x = 42; x;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'Identifier' && n.name === 'x' && n.declNode);
		const result = targetModule(targetNode);
		assert.deepStrictEqual(result, targetNode);
	});
});
describe('UTILS: getObjType', async () => {
	const targetModule = (await import('../src/modules/utils/getObjType.js')).getObjType;
	it('TP-1: Detect Array type', () => {
		const result = targetModule([1, 2, 3]);
		assert.strictEqual(result, 'Array');
	});
	it('TP-2: Detect Object type', () => {
		const result = targetModule({key: 'value'});
		assert.strictEqual(result, 'Object');
	});
	it('TP-3: Detect String type', () => {
		const result = targetModule('hello');
		assert.strictEqual(result, 'String');
	});
	it('TP-4: Detect Number type', () => {
		const result = targetModule(42);
		assert.strictEqual(result, 'Number');
	});
	it('TP-5: Detect Boolean type', () => {
		const result = targetModule(true);
		assert.strictEqual(result, 'Boolean');
	});
	it('TP-6: Detect Null type', () => {
		const result = targetModule(null);
		assert.strictEqual(result, 'Null');
	});
	it('TP-7: Detect Undefined type', () => {
		const result = targetModule(undefined);
		assert.strictEqual(result, 'Undefined');
	});
	it('TP-8: Detect Date type', () => {
		const result = targetModule(new Date());
		assert.strictEqual(result, 'Date');
	});
	it('TP-9: Detect RegExp type', () => {
		const result = targetModule(/pattern/);
		assert.strictEqual(result, 'RegExp');
	});
	it('TP-10: Detect Function type', () => {
		const result = targetModule(function() {});
		assert.strictEqual(result, 'Function');
	});
	it('TP-11: Detect Arrow Function type', () => {
		const result = targetModule(() => {});
		assert.strictEqual(result, 'Function');
	});
	it('TP-12: Detect Error type', () => {
		const result = targetModule(new Error('test'));
		assert.strictEqual(result, 'Error');
	});
	it('TP-13: Detect empty array', () => {
		const result = targetModule([]);
		assert.strictEqual(result, 'Array');
	});
	it('TP-14: Detect empty object', () => {
		const result = targetModule({});
		assert.strictEqual(result, 'Object');
	});
	it('TP-15: Detect Symbol type', () => {
		const result = targetModule(Symbol('test'));
		assert.strictEqual(result, 'Symbol');
	});
	it('TP-16: Detect BigInt type', () => {
		const result = targetModule(BigInt(123));
		assert.strictEqual(result, 'BigInt');
	});
});
describe('UTILS: isNodeInRanges', async () => {
	const targetModule = (await import('../src/modules/utils/isNodeInRanges.js')).isNodeInRanges;
	it('TP-1: Node completely within single range', () => {
		const code = `a.b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.src === 'b');
		const result = targetModule(targetNode, [[2, 3]]);
		assert.ok(result);
	});
	it('TP-2: Node within multiple ranges (first match)', () => {
		const code = `a.b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.src === 'b');
		const result = targetModule(targetNode, [[0, 5], [10, 15]]);
		assert.ok(result);
	});
	it('TP-3: Node within multiple ranges (second match)', () => {
		const code = `a.b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.src === 'b');
		const result = targetModule(targetNode, [[0, 1], [2, 4]]);
		assert.ok(result);
	});
	it('TP-4: Node exactly matching range boundaries', () => {
		const code = `a.b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.src === 'b');
		const result = targetModule(targetNode, [[2, 3]]);
		assert.ok(result);
	});
	it('TP-5: Large range containing small node', () => {
		const code = `function test() { return x; }`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.src === 'x');
		const result = targetModule(targetNode, [[0, 100]]);
		assert.ok(result);
	});
	it('TN-1: Node extends beyond range end', () => {
		const code = `a.b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.src === 'b');
		const result = targetModule(targetNode, [[1, 2]]);
		assert.strictEqual(result, false);
	});
	it('TN-2: Node starts before range start', () => {
		const code = `a.b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.src === 'a');
		const result = targetModule(targetNode, [[1, 5]]);
		assert.strictEqual(result, false);
	});
	it('TN-3: Empty ranges array', () => {
		const code = `a.b;`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.src === 'b');
		const result = targetModule(targetNode, []);
		assert.strictEqual(result, false);
	});
	it('TN-4: Node range partially overlapping but not contained', () => {
		const code = `function test() {}`;
		const ast = generateFlatAST(code);
		const targetNode = ast.find(n => n.type === 'FunctionDeclaration');
		const result = targetModule(targetNode, [[5, 10]]);
		assert.strictEqual(result, false);
	});
});
describe('UTILS: Sandbox', async () => {
	const {Sandbox} = await import('../src/modules/utils/sandbox.js');
	it('TP-1: Basic code execution', () => {
		const sandbox = new Sandbox();
		const result = sandbox.run('2 + 3');
		assert.ok(sandbox.isReference(result));
		assert.strictEqual(result.copySync(), 5);
	});
	it('TP-2: String operations', () => {
		const sandbox = new Sandbox();
		const result = sandbox.run('"hello" + " world"');
		assert.ok(sandbox.isReference(result));
		assert.strictEqual(result.copySync(), 'hello world');
	});
	it('TP-3: Array operations', () => {
		const sandbox = new Sandbox();
		const result = sandbox.run('[1, 2, 3].length');
		assert.ok(sandbox.isReference(result));
		assert.strictEqual(result.copySync(), 3);
	});
	it('TP-4: Object operations', () => {
		const sandbox = new Sandbox();
		const result = sandbox.run('({a: 1, b: 2}).a');
		assert.ok(sandbox.isReference(result));
		assert.strictEqual(result.copySync(), 1);
	});
	it('TP-5: Multiple executions on same sandbox', () => {
		const sandbox = new Sandbox();
		const result1 = sandbox.run('var x = 10; x');
		const result2 = sandbox.run('x * 2');
		assert.strictEqual(result1.copySync(), 10);
		assert.strictEqual(result2.copySync(), 20);
	});
	it('TP-6: Deterministic behavior - Math.random is deleted', () => {
		const sandbox = new Sandbox();
		const result = sandbox.run('typeof Math.random');
		assert.strictEqual(result.copySync(), 'undefined');
	});
	it('TP-7: Deterministic behavior - Date is deleted', () => {
		const sandbox = new Sandbox();
		const result = sandbox.run('typeof Date');
		assert.strictEqual(result.copySync(), 'undefined');
	});
	it('TP-8: Blocked API - WebAssembly is undefined', () => {
		const sandbox = new Sandbox();
		const result = sandbox.run('typeof WebAssembly');
		assert.strictEqual(result.copySync(), 'undefined');
	});
	it('TP-9: Blocked API - fetch is undefined', () => {
		const sandbox = new Sandbox();
		const result = sandbox.run('typeof fetch');
		assert.strictEqual(result.copySync(), 'undefined');
	});
	it('TP-10: isReference method correctly identifies VM References', () => {
		const sandbox = new Sandbox();
		const vmRef = sandbox.run('42');
		const nativeValue = 42;
		assert.ok(sandbox.isReference(vmRef));
		assert.ok(!sandbox.isReference(nativeValue));
	});
	it('TN-1: isReference returns false for null', () => {
		const sandbox = new Sandbox();
		assert.ok(!sandbox.isReference(null));
	});
	it('TN-2: isReference returns false for undefined', () => {
		const sandbox = new Sandbox();
		assert.ok(!sandbox.isReference(undefined));
	});
	it('TN-3: isReference returns false for regular objects', () => {
		const sandbox = new Sandbox();
		assert.ok(!sandbox.isReference({}));
		assert.ok(!sandbox.isReference([]));
		assert.ok(!sandbox.isReference('string'));
	});
});