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
	it('TP-1', () => {
		const code = `!true || !false || !0 || !1 || !a || !'a' || ![] || !{} || !-1 || !!true || !!!true`;
		const expected = `false || true || true || false || !a || false || false || false || false || true || false;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveAugmentedFunctionWrappedArrayReplacements', async () => {
	// Load the module even though there are no tests for it - to include it in the coverage report
	// noinspection JSUnusedLocalSymbols
	const targetModule = (await import('../src/modules/unsafe/resolveAugmentedFunctionWrappedArrayReplacements.js')).evalWithDom;
	it.todo('TODO: Write tests for function', () => {});
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
});
describe('UNSAFE: resolveDefiniteBinaryExpressions', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveDefiniteBinaryExpressions.js')).default;
	it('TP-1', () => {
		const code = `5 * 3; '2' + 2; '10' - 1; 'o' + 'k'; 'o' - 'k'; 3 - -1;`;
		const expected = `15;\n'22';\n9;\n'ok';\nNaN;\n4;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
});
describe('UNSAFE: resolveDefiniteMemberExpressions', async () => {
	const targetModule = (await import('../src/modules/unsafe/resolveDefiniteMemberExpressions.js')).default;
	it('TP-1', () => {
		const code = `'123'[0]; 'hello'.length;`;
		const expected = `'1';\n5;`;
		const result = applyModuleToCode(code, targetModule);
		assert.deepStrictEqual(result, expected);
	});
	it('TN-1', () => {
		const code = `++[[]][0];`;
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