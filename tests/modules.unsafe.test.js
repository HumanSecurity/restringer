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
	it('TP-1', () => {
		const code = `(true ? 1 : 2); (false ? 3 : 4);`;
		const expected = `1;\n4;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1', () => {
		const code = `({} ? 1 : 2); ([].length ? 3 : 4);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveEvalCallsOnNonLiterals', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveEvalCallsOnNonLiterals.js')).default;
	it('TP-1', () => {
		const code = `eval(function(a) {return a}('atob'));`;
		const expected = `atob;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TP-2', () => {
		const code = `eval([''][0]);`;
		const expected = `''`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveFunctionToArray', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveFunctionToArray.js')).default;
	it('TP-1', () => {
		const code = `function a() {return [1];}\nconst b = a();`;
		const expected = `function a() {\n  return [1];\n}\nconst b = [1];`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveInjectedPrototypeMethodCalls', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveInjectedPrototypeMethodCalls.js')).default;
	it('TP-1', () => {
		const code = `String.prototype.secret = function () {return 'secret ' + this;}; 'hello'.secret();`;
		const expected = `String.prototype.secret = function () {\n  return 'secret ' + this;\n};\n'secret hello';`;
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
	it('TN-2: No replacement with undefined', () => {
		const code = `function a() {} a();`;
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