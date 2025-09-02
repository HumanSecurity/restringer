/* eslint-disable no-unused-vars */
import assert from 'node:assert';
import {describe, it} from 'node:test';
import {badValue} from '../src/modules/config.js';
import {Arborist, generateFlatAST, applyIteratively} from 'flast';

/**
 * Apply a module to a given code snippet.
 * @param {string} code The code snippet to apply the module to
 * @param {function} func The function to apply
 * @param {boolean} [looped] Whether to apply the module iteratively until no longer effective
 * @return {string} The result of the operation
 */
function applyModuleToCode(code, func, looped = false) {
	let result;
	if (looped) {
		result = applyIteratively(code, [func]);
	} else {
		const arb = new Arborist(code);
		result = func(arb);
		result.applyChanges();
		result = result.script;
	}
	return result;
}

describe('UNSAFE: normalizeRedundantNotOperator', async () => {
	const targetModule = (await import('../src/modules/unsafe/normalizeRedundantNotOperator.js')).default;
	it('TP-1: Mixed literals and expressions', () => {
		const code = `!true || !false || !0 || !1 || !a || !'a' || ![] || !{} || !-1 || !!true || !!!true`;
		const expected = `false || true || true || false || !a || false || false || false || false || true || false;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: String literals', () => {
		const code = `!'' || !'hello' || !'0' || !' '`;
		const expected = `true || false || false || false;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: Number literals', () => {
		const code = `!42 || !-42 || !0.5 || !-0.5`;
		const expected = `false || false || false || false;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-4: Null literal', () => {
		const code = `!null`;
		const expected = `true;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-5: Empty array and object literals', () => {
		const code = `!{} || ![]`;
		const expected = `false || false;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-6: Simple nested NOT operations', () => {
		const code = `!!false || !!true`;
		const expected = `false || true;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: Do not normalize complex literals that cannot be safely evaluated', () => {
		const code = `!Infinity || !-Infinity || !undefined || ![1,2,3] || !{a:1}`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: Do not normalize NOT on variables', () => {
		const code = `!variable || !obj.prop || !func()`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2: Do not normalize NOT on complex expressions', () => {
		const code = `!(a + b) || !(x > y) || !(z && w)`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: Do not normalize NOT on function calls', () => {
		const code = `!getValue() || !Math.random() || !Array.isArray(arr)`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: Do not normalize NOT on computed properties', () => {
		const code = `!obj[key] || !arr[0] || !matrix[i][j]`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveAugmentedFunctionWrappedArrayReplacements', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveAugmentedFunctionWrappedArrayReplacements.js')).default;
	
	it.todo('Add Missing True Positive Test Cases');
	
	it('TN-1: Do not transform functions without augmentation', () => {
		const code = `function simpleFunc() { return 'test'; }
		simpleFunc();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	
	it('TN-2: Do not transform functions without array operations', () => {
		const code = `function myFunc() { myFunc = 'modified'; return 'value'; }
		myFunc();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	
	it('TN-3: Do not transform when no matching expression statements', () => {
		const code = `var arr = ['a', 'b'];
		function decrypt(i) { return arr[i]; }
		decrypt.modified = true;
		decrypt(0);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	
	it('TN-4: Do not transform anonymous functions', () => {
		const code = `var func = function() { func = 'modified'; return arr[0]; };
		func();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	
	it('TN-5: Do not transform when array candidate has no declNode', () => {
		const code = `function decrypt() { 
			decrypt = 'modified'; 
			return undeclaredArr[0]; 
		}
		decrypt();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	
	it('TN-6: Do not transform when expression statement pattern is wrong', () => {
		const code = `var arr = ['a', 'b'];
		function decrypt(i) { 
			decrypt = 'modified'; 
			return arr[i]; 
		}
		(function() { return arr; })(); // Wrong pattern - not matching
		decrypt(0);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	
	it('TN-7: Do not transform when no replacement candidates found', () => {
		const code = `var arr = ['a', 'b'];
		function decrypt(i) { 
			decrypt = 'modified'; 
			return arr[i]; 
		}
		(function(arr) { return arr; })(arr);
		// No calls to decrypt function to replace
		console.log('test');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});

});
describe('UNSAFE: resolveBuiltinCalls', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveBuiltinCalls.js')).default;
	it('TP-1: atob', () => {
		const code = `atob('c29sdmVkIQ==');`;
		const expected = `'solved!';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: btoa', () => {
		const code = `btoa('solved!');`;
		const expected = `'c29sdmVkIQ==';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: split', () => {
		const code = `'ok'.split('');`;
		const expected = `[\n  'o',\n  'k'\n];`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-4: Member expression with literal arguments', () => {
		const code = `String.fromCharCode(72, 101, 108, 108, 111);`;
		const expected = `'Hello';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-5: Multiple builtin calls', () => {
		const code = `btoa('test') + atob('dGVzdA==');`;
		const expected = `'dGVzdA==' + 'test';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-6: String method with multiple arguments', () => {
		const code = `'hello world'.replace('world', 'universe');`;
		const expected = `'hello universe';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: querySelector', () => {
		const code = `document.querySelector('div');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2: Unknown variable', () => {
		const code = `atob(x)`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: Overwritten builtin', () => {
		const code = `function atob() {return 1;} atob('test');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: Skip builtin function call', () => {
		const code = `Array(5);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: Skip member expression with restricted property', () => {
		const code = `'test'.length;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-6: Function call with this expression', () => {
		const code = `this.btoa('test');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-7: Constructor property access', () => {
		const code = `String.constructor('return 1');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-8: Member expression with computed property using variable', () => {
		const code = `String[methodName]('test');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveDefiniteBinaryExpressions', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveDefiniteBinaryExpressions.js')).default;
	it('TP-1: Mixed arithmetic and string operations', () => {
		const code = `5 * 3; '2' + 2; '10' - 1; 'o' + 'k'; 'o' - 'k'; 3 - -1;`;
		const expected = `15;\n'22';\n9;\n'ok';\nNaN;\n4;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Division and modulo operations', () => {
		const code = `10 / 2; 7 % 3; 15 / 3;`;
		const expected = `5;\n1;\n5;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: Bitwise operations', () => {
		const code = `5 & 3; 5 | 3; 5 ^ 3;`;
		const expected = `1;\n7;\n6;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-4: Comparison operations', () => {
		const code = `5 > 3; 2 < 1; 5 === 5; 'a' !== 'b';`;
		const expected = `true;\nfalse;\ntrue;\ntrue;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-5: Negative number edge case handling', () => {
		const code = `10 - 15; 3 - 8;`;
		const expected = `-5;\n-5;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-6: Null operations and string concatenation', () => {
		const code = `null + 5; 'test' + 'ing';`;
		const expected = `5;\n'testing';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: Do not resolve expressions with variables', () => {
		const code = `x + 5; a * b;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2: Do not resolve expressions with function calls', () => {
		const code = `foo() + 5; Math.max(1, 2) * 3;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: Do not resolve member expressions', () => {
		const code = `obj.prop + 5; arr[0] * 2;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: Do not resolve complex nested expressions', () => {
		const code = `(x + y) * z; foo(a) + bar(b);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: Do not resolve logical expressions (not BinaryExpressions)', () => {
		const code = `true && false; true || false; !true;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-6: Do not resolve expressions with undefined identifier', () => {
		const code = `undefined + 3; x + undefined;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveDefiniteMemberExpressions', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveDefiniteMemberExpressions.js')).default;
	it('TP-1: String and array indexing with properties', () => {
		const code = `'123'[0]; 'hello'.length;`;
		const expected = `'1';\n5;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Array literal indexing', () => {
		const code = `[1, 2, 3][0]; [4, 5, 6][2];`;
		const expected = `1;\n6;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: String indexing with different positions', () => {
		const code = `'test'[1]; 'world'[4];`;
		const expected = `'e';\n'd';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-4: Array length property', () => {
		const code = `[1, 2, 3, 4].length; ['a', 'b'].length;`;
		const expected = `4;\n2;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-5: Mixed literal types in arrays', () => {
		const code = `['hello', 42, true][0]; [null, undefined, 'test'][2];`;
		const expected = `'hello';\n'test';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-6: Non-computed property access with identifier', () => {
		const code = `'testing'.length; [1, 2, 3].length;`;
		const expected = `7;\n3;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: Do not transform update expressions', () => {
		const code = `++[[]][0];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2: Do not transform method calls (callee position)', () => {
		const code = `'test'.split(''); [1, 2, 3].join(',');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: Do not transform computed properties with variables', () => {
		const code = `'hello'[index]; arr[i];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: Do not transform non-literal objects', () => {
		const code = `obj.property; variable[0];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: Do not transform empty literals', () => {
		const code = `''[0]; [].length;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-6: Do not transform complex property expressions', () => {
		const code = `'test'[getValue()]; obj[prop + 'name'];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-7: Do not transform out-of-bounds access (handled by sandbox)', () => {
		const code = `'abc'[10]; [1, 2][5];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveDeterministicConditionalExpressions', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveDeterministicConditionalExpressions.js')).default;
	it('TP-1: Boolean literals (true/false)', () => {
		const code = `(true ? 1 : 2); (false ? 3 : 4);`;
		const expected = `1;\n4;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Truthy string literals', () => {
		const code = `('hello' ? 'yes' : 'no'); ('a' ? 42 : 0);`;
		const expected = `'yes';\n42;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: Falsy string literal (empty string)', () => {
		const code = `('' ? 'yes' : 'no'); ('' ? 42 : 0);`;
		const expected = `'no';\n0;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-4: Truthy number literals', () => {
		const code = `(1 ? 'one' : 'zero'); (42 ? 'yes' : 'no'); (123 ? 'positive' : 'zero');`;
		const expected = `'one';\n'yes';\n'positive';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-5: Falsy number literal (zero)', () => {
		const code = `(0 ? 'yes' : 'no'); (0 ? 42 : 'zero');`;
		const expected = `'no';\n'zero';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-6: Null literal', () => {
		const code = `(null ? 'yes' : 'no'); (null ? 'defined' : 'null');`;
		const expected = `'no';\n'null';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-7: Nested conditional expressions (single pass)', () => {
		const code = `(true ? (false ? 'inner1' : 'inner2') : 'outer');`;
		const expected = `false ? 'inner1' : 'inner2';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-8: Complex expressions as branches', () => {
		const code = `(1 ? console.log('truthy') : console.log('falsy'));`;
		const expected = `console.log('truthy');`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: Non-literal test expressions', () => {
		const code = `({} ? 1 : 2); ([].length ? 3 : 4);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2: Variable test expressions', () => {
		const code = `(x ? 'yes' : 'no'); (condition ? true : false);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: Function call test expressions', () => {
		const code = `(getValue() ? 'yes' : 'no'); (check() ? 1 : 0);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: Binary expression test expressions', () => {
		const code = `(a + b ? 'yes' : 'no'); (x > 5 ? 'big' : 'small');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: Member expression test expressions', () => {
		const code = `(obj.prop ? 'yes' : 'no'); (arr[0] ? 'first' : 'empty');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-6: Unary expressions (not literals)', () => {
		const code = `(-1 ? 'negative' : 'zero'); (!true ? 'no' : 'yes');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-7: Undefined identifier (not literal)', () => {
		const code = `(undefined ? 'defined' : 'undefined');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveEvalCallsOnNonLiterals', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveEvalCallsOnNonLiterals.js')).default;
	it('TP-1: Function call that returns string', () => {
		const code = `eval(function(a) {return a}('atob'));`;
		const expected = `atob;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Array access returning empty string', () => {
		const code = `eval([''][0]);`;
		const expected = `''`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: Variable reference resolution', () => {
		const code = `var x = 'console.log("test")'; eval(x);`;
		const expected = `var x = 'console.log("test")';\nconsole.log('test');`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-4: Function expression IIFE', () => {
		const code = `eval((function() { return 'var a = 5;'; })());`;
		const expected = `var a = 5;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-5: Member expression property access', () => {
		const code = `var obj = {code: 'var y = 10;'}; eval(obj.code);`;
		const expected = `var obj = { code: 'var y = 10;' };\nvar y = 10;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-6: Array index with complex expression', () => {
		const code = `var arr = ['if (true) { x = 1; }']; eval(arr[0]);`;
		const expected = `var arr = ['if (true) { x = 1; }'];\nif (true) {\n  x = 1;\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: Eval with literal string (already handled by another module)', () => {
		const code = `eval('console.log("literal")');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2: Non-eval function calls', () => {
		const code = `execute(function() { return 'code'; }());`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: Eval with multiple arguments', () => {
		const code = `eval('code', extra);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: Eval with no arguments', () => {
		const code = `eval();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: Computed member expression for eval', () => {
		const code = `obj['eval'](dynamicCode);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-6: Eval with non-evaluable expression', () => {
		const code = `eval(undefined);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveFunctionToArray', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveFunctionToArray.js')).default;
	it('TP-1: Simple function returning array', () => {
		const code = `function a() {return [1];}\nconst b = a();`;
		const expected = `function a() {\n  return [1];\n}\nconst b = [1];`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Function with multiple elements', () => {
		const code = `function getArr() { return ['one', 'two', 'three']; }\nlet arr = getArr();`;
		const expected = `function getArr() {\n  return [\n    'one',\n    'two',\n    'three'\n  ];\n}\nlet arr = [\n  'one',\n  'two',\n  'three'\n];`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: Arrow function returning array', () => {
		const code = `const makeArray = () => [1, 2, 3];\nconst data = makeArray();`;
		const expected = `const makeArray = () => [\n  1,\n  2,\n  3\n];\nconst data = [\n  1,\n  2,\n  3\n];`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-4: Function with parameters (ignored)', () => {
		const code = `function createArray(x) { return [x, x + 1]; }\nconst nums = createArray();`;
		const expected = `function createArray(x) {\n  return [\n    x,\n    x + 1\n  ];\n}\nconst nums = [\n  undefined,\n  NaN\n];`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-5: Multiple variables with array access only', () => {
		const code = `function getColors() { return ['red', 'blue']; }\nconst colors = getColors();\nconst first = colors[0];`;
		const expected = `function getColors() {\n  return [\n    'red',\n    'blue'\n  ];\n}\nconst colors = [\n  'red',\n  'blue'\n];\nconst first = colors[0];`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: Function call with non-array-access usage', () => {
		const code = `function getValue() { return 'test'; }\nconst val = getValue();\nconsole.log(val);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-6: Variable with empty references array (should transform)', () => {
		const code = `function getArray() { return [1, 2]; }\nconst unused = getArray();`;
		const expected = `function getArray() {\n  return [\n    1,\n    2\n  ];\n}\nconst unused = [\n  1,\n  2\n];`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: Variable not assigned function call', () => {
		const code = `const arr = [1, 2, 3];\nconsole.log(arr[0]);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: Mixed usage (array access and other)', () => {
		const code = `function getData() { return [1, 2]; }\nconst data = getData();\nconsole.log(data[0], data);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-7: Function with property access (length is MemberExpression)', () => {
		const code = `function getArray() { return [1, 2, 3]; }\nconst arr = getArray();\nconst len = arr.length;`;
		const expected = `function getArray() {\n  return [\n    1,\n    2,\n    3\n  ];\n}\nconst arr = [\n  1,\n  2,\n  3\n];\nconst len = arr.length;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: Function with method calls (not just property access)', () => {
		const code = `function getArray() { return [1, 2, 3]; }\nconst arr = getArray();\narr.push(4);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-6: Non-literal init expression', () => {
		const code = `const arr = someFunction();\nconsole.log(arr[0]);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveInjectedPrototypeMethodCalls', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveInjectedPrototypeMethodCalls.js')).default;
	it('TP-1: String prototype method injection', () => {
		const code = `String.prototype.secret = function () {return 'secret ' + this;}; 'hello'.secret();`;
		const expected = `String.prototype.secret = function () {\n  return 'secret ' + this;\n};\n'secret hello';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Number prototype method injection', () => {
		const code = `Number.prototype.double = function () {return this * 2;}; (5).double();`;
		const expected = `Number.prototype.double = function () {\n  return this * 2;\n};\n10;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: Array prototype method injection', () => {
		const code = `Array.prototype.first = function () {return this[0];}; [1, 2, 3].first();`;
		const expected = `Array.prototype.first = function () {\n  return this[0];\n};\n1;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-4: Method with parameters', () => {
		const code = `String.prototype.multiply = function (n) {return this + this;}; 'hi'.multiply(2);`;
		const expected = `String.prototype.multiply = function (n) {\n  return this + this;\n};\n'hihi';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-5: Multiple calls to same injected method', () => {
		const code = `String.prototype.shout = function () {return this.toUpperCase() + '!';}; 'hello'.shout(); 'world'.shout();`;
		const expected = `String.prototype.shout = function () {\n  return this.toUpperCase() + '!';\n};\n'HELLO!';\n'WORLD!';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-6: Identifier assignment to prototype method', () => {
		const code = `function helper() {return 'helped';} String.prototype.help = helper; 'test'.help();`;
		const expected = `function helper() {\n  return 'helped';\n}\nString.prototype.help = helper;\n'helped';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-7: Method call with missing arguments resolves to expected result', () => {
		const code = `String.prototype.test = function (a, b) {return a + b;}; 'hello'.test();`;
		const expected = `String.prototype.test = function (a, b) {\n  return a + b;\n};\nNaN;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-8: Arrow function prototype method injection', () => {
		const code = `String.prototype.reverse = () => 'reversed'; 'hello'.reverse();`;
		const expected = `String.prototype.reverse = () => 'reversed';\n'reversed';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-9: Arrow function with parameters', () => {
		const code = `String.prototype.repeat = (n) => 'repeated'; 'test'.repeat(3);`;
		const expected = `String.prototype.repeat = n => 'repeated';\n'repeated';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-10: Arrow function using closure variable', () => {
		const code = `const value = 'closure'; String.prototype.getClosure = () => value; 'hello'.getClosure();`;
		const expected = `const value = 'closure';\nString.prototype.getClosure = () => value;\n'closure';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: Non-prototype property assignment', () => {
		const code = `String.custom = function () {return 'custom';}; String.custom();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2: Non-function assignment to prototype', () => {
		const code = `String.prototype.value = 'static'; 'test'.value;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: Call to non-injected method', () => {
		const code = `String.prototype.custom = function () {return 'custom';}; 'test'.other();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: Assignment with non-assignment operator', () => {
		const code = `String.prototype.test += function () {return 'test';}; 'hello'.test();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: Complex expression assignment to prototype', () => {
		const code = `String.prototype.complex = getValue() + 'suffix'; 'test'.complex();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-6: Arrow function returning this (may not evaluate safely)', () => {
		const code = `String.prototype.getThis = () => this; 'hello'.getThis();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveLocalCalls', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveLocalCalls.js')).default;
	it('TP-1: Function declaration', () => {
		const code = `function add(a, b) {return a + b;} add(1, 2);`;
		const expected = `function add(a, b) {\n  return a + b;\n}\n3;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2: Arrow function', () => {
		const code = `const add = (a, b) => a + b; add(1, 2);`;
		const expected = `const add = (a, b) => a + b;\n3;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-3: Overwritten builtin', () => {
		const code = `const atob = (a, b) => a + b; atob('got-');`;
		const expected = `const atob = (a, b) => a + b;\n'got-undefined';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-4: Function expression', () => {
		const code = `const multiply = function(a, b) {return a * b;}; multiply(3, 4);`;
		const expected = `const multiply = function (a, b) {\n  return a * b;\n};\n12;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-5: Multiple calls to same function', () => {
		const code = `function double(x) {return x * 2;} double(5); double(10);`;
		const expected = `function double(x) {\n  return x * 2;\n}\n10;\n20;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-6: Function returning string', () => {
		const code = `function greet(name) {return 'Hello ' + name;} greet('World');`;
		const expected = `function greet(name) {\n  return 'Hello ' + name;\n}\n'Hello World';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1: Missing declaration', () => {
		const code = `add(1, 2);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-2: Skipped builtin', () => {
		const code = `btoa('a');`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-3: No replacement with undefined', () => {
		const code = `function a() {} a();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-4: Complex member expression property access', () => {
		const code = `const obj = {value: 'test'}; const fn = (o) => o.value; fn(obj);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-7: Function call argument with FunctionExpression', () => {
		const code = `function test(fn) {return fn();} test(function(){return 'call';});`;
		const expected = `function test(fn) {\n  return fn();\n}\n'call';`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-5: Function toString (anti-debugging protection)', () => {
		const code = `function test() {return 'test';} test.toString();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-6: Simple wrapper function (handled by safe modules)', () => {
		const code = `function wrapper() {return 'literal';} wrapper();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-7: Call with ThisExpression argument', () => {
		const code = `function test(ctx) {return ctx;} test(this);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-8: Member expression call on empty array', () => {
		const code = `const arr = []; const fn = a => a.length; fn(arr);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveMinimalAlphabet', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveMinimalAlphabet.js')).default;
	it('TP-1', () => {
		const code = `+true; -true; +false; -false; +[]; ~true; ~false; ~[]; +[3]; +['']; -[4]; ![]; +[[]];`;
		const expected = `1;\n-'1';\n0;\n-0;\n0;\n-'2';\n-'1';\n-'1';\n3;\n0;\n-'4';\nfalse;\n0;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2', () => {
		const code = `[] + []; [+[]]; (![]+[]); +[!+[]+!+[]];`;
		const expected = `'';\n[0];\n'false';\n2;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1', () => {
		const code = `-false; -[]; +{}; -{}; -'a'; ~{}; -['']; +[1, 2]; +this; +[this];`;
		const expected = `-0;\n-0;\n+{};\n-{};\nNaN;\n~{};\n-0;\nNaN;\n+this;\n+[this];`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});