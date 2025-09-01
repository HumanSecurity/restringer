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

describe('SAFE: removeRedundantBlockStatements', async () => {
	const targetModule = (await import('../src/modules/safe/removeRedundantBlockStatements.js')).default;
	it('TP-1', () => {
		const code = `if (a) {{do_a();}}`;
		const expected = `if (a) {\n  do_a();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2', () => {
		const code = `if (a) {{do_a();}{do_b();}}`;
		const expected = `if (a) {\n  do_a();\n  do_b();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3', () => {
		const code = `if (a) {{do_a();}{do_b(); do_c();}{do_d();}}`;
		const expected = `if (a) {\n  do_a();\n  do_b();\n  do_c();\n  do_d();\n}`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TP-4', () => {
		const code = `if (a) {{{{{do_a();}}}} do_b();}`;
		const expected = `if (a) {\n  do_a();\n  do_b();\n}`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: normalizeComputed', async () => {
	const targetModule = (await import('../src/modules/safe/normalizeComputed.js')).default;
	it('TP-1: Convert valid string identifiers to dot notation', () => {
		const code = `hello['world'][0]['%32']['valid']`;
		const expected = `hello.world[0]['%32'].valid;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Convert object properties with valid identifiers', () => {
		const code = `const obj = {['validProp']: 1, ['invalid-prop']: 2, ['$valid']: 3};`;
		const expected = `const obj = {\n  validProp: 1,\n  ['invalid-prop']: 2,\n  $valid: 3\n};`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Convert class method definitions with valid identifiers', () => {
		const code = `class Test { ['method']() {} ['123invalid']() {} ['_valid']() {} }`;
		const expected = `class Test {\n  method() {\n  }\n  ['123invalid']() {\n  }\n  _valid() {\n  }\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not convert invalid identifiers', () => {
		const code = `obj['123']['-invalid']['spa ce']['@special'];`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, code);
	});
	it('TN-2: Do not convert numeric indices but convert valid string', () => {
		const code = `arr[0][42]['string'];`;
		const expected = `arr[0][42].string;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: normalizeEmptyStatements', async () => {
	const targetModule = (await import('../src/modules/safe/normalizeEmptyStatements.js')).default;
	it('TP-1: Remove standalone empty statements', () => {
		const code = `;;var a = 3;;`;
		const expected = `var a = 3;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Remove empty statements in blocks', () => {
		const code = `if (true) {;; var x = 1; ;;;};`;
		const expected = `if (true) {\n  var x = 1;\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Preserve empty statements in for-loops', () => {
		const code = `;for (;;);;`;
		const expected = `for (;;);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Preserve empty statements in while-loops', () => {
		const code = `;while (true);;`;
		const expected = `while (true);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Preserve empty statements in if-statements', () => {
		const code = `;if (condition); else;;`;
		const expected = `if (condition);\nelse ;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Preserve empty statements in do-while loops', () => {
		const code = `;do; while(true);;`;
		const expected = `do ;\nwhile (true);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Preserve empty statements in for-in loops', () => {
		const code = `;for (;;);;`;
		const expected = `for (;;);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: parseTemplateLiteralsIntoStringLiterals', async () => {
	const targetModule = (await import('../src/modules/safe/parseTemplateLiteralsIntoStringLiterals.js')).default;
	it('TP-1: Convert template literal with string expression', () => {
		const code = '`hello ${"world"}!`;';
		const expected = `'hello world!';`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Convert template literal with multiple expressions', () => {
		const code = '`start ${42} middle ${"end"} finish`;';
		const expected = `'start 42 middle end finish';`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Convert template literal with no expressions', () => {
		const code = '`just plain text`;';
		const expected = `'just plain text';`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Convert template literal with boolean and number expressions', () => {
		const code = '`flag: ${true}, count: ${123.456}`;';
		const expected = `'flag: true, count: 123.456';`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Convert empty template literal', () => {
		const code = '``;';
		const expected = `'';`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not convert template literal with variable expression', () => {
		const code = '`hello ${name}!`;';
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not convert template literal with function call expression', () => {
		const code = '`result: ${getValue()}`;';
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not convert template literal with mixed literal and non-literal expressions', () => {
		const code = '`hello ${"world"} and ${name}!`;';
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: rearrangeSequences', async () => {
	const targetModule = (await import('../src/modules/safe/rearrangeSequences.js')).default;
	it('TP-1: Split sequenced calls to standalone expressions', () => {
		const code = `function f() { return a(), b(), c(); }`;
		const expected = `function f() {\n  a();\n  b();\n  return c();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Split sequenced calls to standalone expressions in if-statements', () => {
		const code = `function f() { if (x) return a(), b(), c(); else d(); }`;
		const expected = `function f() {\n  if (x) {\n    a();\n    b();\n    return c();\n  } else\n    d();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Split sequenced calls in if-statements to cascading if-statements', () => {
		const code = `function f() { if (a(), b()) c(); }`;
		const expected = `function f() {\n  a();\n  if (b())\n    c();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Split sequenced calls in nested if-statements to cascading if-statements', () => {
		const code = `function f() { if (x) if (a(), b()) c(); }`;
		const expected = `function f() {\n  if (x) {\n    a();\n    if (b())\n      c();\n  }\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Split sequences with more than three expressions', () => {
		const code = `function f() { return a(), b(), c(), d(), e(); }`;
		const expected = `function f() {\n  a();\n  b();\n  c();\n  d();\n  return e();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Split sequences in if condition with else clause', () => {
		const code = `if (setup(), check(), validate()) action(); else fallback();`;
		const expected = `{\n  setup();\n  check();\n  if (validate())\n    action();\n  else\n    fallback();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not transform single expression returns', () => {
		const code = `function f() { return a(); }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not transform single expression if conditions', () => {
		const code = `if (condition()) action();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not transform non-sequence expressions', () => {
		const code = `function f() { return func(a, b, c); if (obj.prop) x(); }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: rearrangeSwitches', async () => {
	const targetModule = (await import('../src/modules/safe/rearrangeSwitches.js')).default;
	it('TP-1: Complex switch with multiple cases and return statement', () => {
		const code = `(() => {let a = 1;\twhile (true) {switch (a) {case 3: return console.log(3); case 2: console.log(2); a = 3; break;
case 1: console.log(1); a = 2; break;}}})();`;
		const expected = `((() => {
  let a = 1;
  while (true) {
    {
      console.log(1);
      a = 2;
      console.log(2);
      a = 3;
      return console.log(3);
    }
  }
})());`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Simple switch with sequential cases', () => {
		const code = `var state = 0; switch (state) { case 0: first(); state = 1; break; case 1: second(); break; }`;
		const expected = `var state = 0;
{
  first();
  state = 1;
  second();
}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Switch with default case', () => {
		const code = `var x = 1; switch (x) { case 1: action1(); x = 2; break; default: defaultAction(); break; case 2: action2(); break; }`;
		const expected = `var x = 1;
{
  action1();
  x = 2;
  defaultAction();
}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Switch starting with non-initial case via default', () => {
		const code = `var val = 99; switch (val) { case 1: step1(); val = 2; break; case 2: step2(); break; default: val = 1; break; }`;
		const expected = `var val = 99;
{
  val = 1;
  step1();
  val = 2;
  step2();
}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not transform switch without literal discriminant initialization', () => {
		const code = `var a; switch (a) { case 1: doSomething(); break; }`;
		const expected = `var a; switch (a) { case 1: doSomething(); break; }`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Transform switch but stop at multiple assignments to discriminant', () => {
		const code = `var state = 0; switch (state) { case 0: state = 1; state = 2; break; case 1: action(); break; }`;
		const expected = `var state = 0;
{
  state = 1;
  state = 2;
}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not transform switch with non-literal case value', () => {
		const code = `var x = 0; switch (x) { case variable: doSomething(); break; }`;
		const expected = `var x = 0; switch (x) { case variable: doSomething(); break; }`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: removeDeadNodes', async () => {
	const targetModule = (await import('../src/modules/safe/removeDeadNodes.js')).default;
	it('TP-1', () => {
		const code = `var a = 3, b = 12; console.log(b);`;
		const expected = `var b = 12;\nconsole.log(b);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: replaceCallExpressionsWithUnwrappedIdentifier', async () => {
	const targetModule = (await import('../src/modules/safe/replaceCallExpressionsWithUnwrappedIdentifier.js')).default;
	it('TP-1: Replace call expression with identifier behind an arrow function', () => {
		const code = `const a = () => btoa; a()('yo');`;
		const expected = `const a = () => btoa;\nbtoa('yo');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Replace call expression with identifier behind a function declaration', () => {
		const code = `function a() {return btoa;} a()('yo');`;
		const expected = `function a() {\n  return btoa;\n}\nbtoa('yo');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace call expression with function expression assigned to variable', () => {
		const code = `const a = function() {return btoa;}; a()('data');`;
		const expected = `const a = function () {\n  return btoa;\n};\nbtoa('data');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace call expression with arrow function using block statement', () => {
		const code = `const a = () => {return btoa;}; a()('test');`;
		const expected = `const a = () => {\n  return btoa;\n};\nbtoa('test');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Replace call expression returning parameterless call', () => {
		const code = `function a() {return someFunc();} a()('arg');`;
		const expected = `function a() {\n  return someFunc();\n}\nsomeFunc()('arg');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not replace function returning call expression with arguments', () => {
		const code = `function a() {return someFunc('param');} a()('arg');`;
		const expected = `function a() {return someFunc('param');} a()('arg');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not replace function with multiple statements', () => {
		const code = `function a() {console.log('test'); return btoa;} a()('data');`;
		const expected = `function a() {console.log('test'); return btoa;} a()('data');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not replace function with no return statement', () => {
		const code = `function a() {console.log('test');} a()('data');`;
		const expected = `function a() {console.log('test');} a()('data');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not replace non-function callee', () => {
		const code = `const a = 'notAFunction'; a()('data');`;
		const expected = `const a = 'notAFunction'; a()('data');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: replaceEvalCallsWithLiteralContent', async () => {
	const targetModule = (await import('../src/modules/safe/replaceEvalCallsWithLiteralContent.js')).default;
	it('TP-1: Replace eval call with the code parsed from the argument string', () => {
		const code = `eval('console.log("hello world")');`;
		const expected = `console.log('hello world');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Replace eval call with a block statement with multiple expression statements', () => {
		const code = `eval('a; b;');`;
		const expected = `{\n  a;\n  b;\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace eval call with the code in a return statement', () => {
		const code = `function q() {return (eval('a, b;'));}`;
		const expected = `function q() {\n  return a, b;\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace eval call wrapped in a call expression', () => {
		const code = `eval('()=>1')();`;
		const expected = `((() => 1)());`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Replace eval call wrapped in a binary expression', () => {
		const code = `eval('3 * 5') + 1;`;
		const expected = `3 * 5 + 1;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Unwrap expression statement from replacement where needed', () => {
		const code = `console.log(eval('1;'));`;
		const expected = `console.log(1);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-7: Replace eval with single expression in conditional', () => {
		const code = `if (eval('true')) console.log('test');`;
		const expected = `if (true)\n  console.log('test');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-8: Replace eval with function declaration', () => {
		const code = `eval('function test() { return 42; }');`;
		const expected = `(function test() {\n  return 42;\n});`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not replace eval with non-literal argument', () => {
		const code = `const x = 'alert(1)'; eval(x);`;
		const expected = `const x = 'alert(1)'; eval(x);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not replace non-eval function calls', () => {
		const code = `myEval('console.log("test")');`;
		const expected = `myEval('console.log("test")');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not replace eval with invalid syntax', () => {
		const code = `eval('invalid syntax {{{');`;
		const expected = `eval('invalid syntax {{{');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not replace eval with no arguments', () => {
		const code = `eval();`;
		const expected = `eval();`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: replaceFunctionShellsWithWrappedValue', async () => {
	const targetModule = (await import('../src/modules/safe/replaceFunctionShellsWithWrappedValue.js')).default;
	it('TP-1: Replace references with identifier', () => {
		const code = `function a() {return String}\na()(val);`;
		const expected = `function a() {\n  return String;\n}\nString(val);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Replace function returning literal number', () => {
		const code = `function getValue() { return 42; }\nconsole.log(getValue());`;
		const expected = `function getValue() {\n  return 42;\n}\nconsole.log(42);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace function returning literal string', () => {
		const code = `function getName() { return "test"; }\nalert(getName());`;
		const expected = `function getName() {\n  return 'test';\n}\nalert('test');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace function returning boolean literal', () => {
		const code = `function isTrue() { return true; }\nif (isTrue()) console.log("yes");`;
		const expected = `function isTrue() {\n  return true;\n}\nif (true)\n  console.log('yes');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Replace multiple calls to same function', () => {
		const code = `function getX() { return x; }\ngetX() + getX();`;
		const expected = `function getX() {\n  return x;\n}\nx + x;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Should not replace literals 1', () => {
		const code = `function a() {\n  return 0;\n}\nconst o = { key: a }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Should not replace literals 2', () => {
		const code = `function a() {\n  return 0;\n}\nconsole.log(a);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not replace function with multiple statements', () => {
		const code = `function complex() { console.log("side effect"); return 42; }\ncomplex();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not replace function with no return statement', () => {
		const code = `function noReturn() { console.log("void"); }\nnoReturn();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Do not replace function returning complex expression', () => {
		const code = `function calc() { return a + b; }\ncalc();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-6: Do not replace function used as callback', () => {
		const code = `function getValue() { return 42; }\n[1,2,3].map(getValue);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: replaceFunctionShellsWithWrappedValueIIFE', async () => {
	const targetModule = (await import('../src/modules/safe/replaceFunctionShellsWithWrappedValueIIFE.js')).default;
	it('TP-1: Replace with wrapped value in-place', () => {
		const code = `(function a() {return String}\n)()(val);`;
		const expected = `String(val);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Replace IIFE returning literal number', () => {
		const code = `(function() { return 42; })() + 1;`;
		const expected = `42 + 1;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace IIFE returning literal string', () => {
		const code = `console.log((function() { return "hello"; })());`;
		const expected = `console.log('hello');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace IIFE returning boolean literal', () => {
		const code = `if ((function() { return true; })()) console.log("yes");`;
		const expected = `if (true)\n  console.log('yes');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Replace IIFE returning identifier', () => {
		const code = `var result = (function() { return someValue; })();`;
		const expected = `var result = someValue;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Replace multiple IIFEs in expression', () => {
		const code = `(function() { return 5; })() + (function() { return 3; })();`;
		const expected = `5 + 3;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not replace IIFE with arguments', () => {
		const code = `(function() { return 42; })(arg);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not replace IIFE with multiple statements', () => {
		const code = `(function() { console.log("side effect"); return 42; })();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not replace IIFE with no return statement', () => {
		const code = `(function() { console.log("void"); })();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not replace IIFE returning complex expression', () => {
		const code = `(function() { return a + b; })();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Do not replace function expression not used as IIFE', () => {
		const code = `var fn = function() { return 42; }; fn();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});	
	it('TN-6: Do not replace function expression without a return value', () => {
		const code = `var fn = function() { return; };`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: replaceIdentifierWithFixedAssignedValue', async () => {
	const targetModule = (await import('../src/modules/safe/replaceIdentifierWithFixedAssignedValue.js')).default;
	it('TP-1: Replace references with number literal', () => {
		const code = `const a = 3; const b = a * 2; console.log(b + a);`;
		const expected = `const a = 3;\nconst b = 3 * 2;\nconsole.log(b + 3);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Replace references with string literal', () => {
		const code = `const msg = "hello"; console.log(msg + " world");`;
		const expected = `const msg = 'hello';\nconsole.log('hello' + ' world');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace references with boolean literal', () => {
		const code = `const flag = true; if (flag) console.log("yes");`;
		const expected = `const flag = true;\nif (true)\n  console.log('yes');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace multiple different variables', () => {
		const code = `const x = 5; const y = "test"; console.log(x, y);`;
		const expected = `const x = 5;\nconst y = 'test';\nconsole.log(5, 'test');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Replace with null literal', () => {
		const code = `const val = null; if (val === null) console.log("null");`;
		const expected = `const val = null;\nif (null === null)\n  console.log('null');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Replace with let declaration', () => {
		const code = `let count = 0; console.log(count + 1);`;
		const expected = `let count = 0;\nconsole.log(0 + 1);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-7: Replace with var declaration', () => {
		const code = `var total = 100; console.log(total / 2);`;
		const expected = `var total = 100;\nconsole.log(100 / 2);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do no replace a value used in a for-in-loop', () => {
		const code = `var a = 3; for (a in [1, 2]) console.log(a);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do no replace a value used in a for-of-loop', () => {
		const code = `var a = 3; for (a of [1, 2]) console.log(a);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not replace variable with non-literal initializer', () => {
		const code = `const result = getValue(); console.log(result);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not replace object property names', () => {
		const code = `const key = "name"; const obj = { key: "value" };`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Do not replace modified variables', () => {
		const code = `let counter = 0; counter++; console.log(counter);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-6: Do not replace reassigned variables', () => {
		const code = `let status = true; status = false; console.log(status);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-7: Do not replace variable without declaration', () => {
		const code = `console.log(undeclaredVar);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: replaceIdentifierWithFixedValueNotAssignedAtDeclaration', async () => {
	const targetModule = (await import('../src/modules/safe/replaceIdentifierWithFixedValueNotAssignedAtDeclaration.js')).default;
	it('TP-1: Replace identifier with number literal', () => {
		const code = `let a; a = 3; const b = a * 2; console.log(b + a);`;
		const expected = `let a;\na = 3;\nconst b = 3 * 2;\nconsole.log(b + 3);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Replace identifier with string literal', () => {
		const code = `let name; name = 'test'; alert(name);`;
		const expected = `let name;\nname = 'test';\nalert('test');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace identifier with boolean literal', () => {
		const code = `let flag; flag = true; if (flag) console.log('yes');`;
		const expected = `let flag;\nflag = true;\nif (true)\n  console.log('yes');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace identifier with null literal', () => {
		const code = `let value; value = null; console.log(value);`;
		const expected = `let value;\nvalue = null;\nconsole.log(null);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Replace var declaration', () => {
		const code = `var x; x = 42; console.log(x);`;
		const expected = `var x;\nx = 42;\nconsole.log(42);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Replace with multiple references', () => {
		const code = `let count; count = 5; alert(count); console.log(count);`;
		const expected = `let count;\ncount = 5;\nalert(5);\nconsole.log(5);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not replace variable used in for-in loop', () => {
		const code = `let a; a = 'prop'; for (a in obj) console.log(a);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not replace variable used in for-of loop', () => {
		const code = `let item; item = 1; for (item of arr) console.log(item);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not replace variable in conditional expression context', () => {
		const code = `let a; b === c ? (a = 1) : (a = 2); console.log(a);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not replace variable with multiple assignments', () => {
		const code = `let a; a = 1; a = 2; console.log(a);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Do not replace variable assigned non-literal value', () => {
		const code = `let a; a = someFunction(); console.log(a);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-6: Do not replace function callee', () => {
		const code = `let func; func = alert; func('hello');`;
		const expected = `let func; func = alert; func('hello');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-7: Do not replace variable with initial value', () => {
		const code = `let a = 1; a = 2; console.log(a);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-8: Do not replace when references are modified', () => {
		const code = `let a; a = 1; a++; console.log(a);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: replaceNewFuncCallsWithLiteralContent', async () => {
	const targetModule = (await import('../src/modules/safe/replaceNewFuncCallsWithLiteralContent.js')).default;
	it('TP-1: Replace Function constructor with IIFE', () => {
		const code = `new Function("!function() {console.log('hello world')}()")();`;
		const expected = `!(function () {\n  console.log('hello world');\n}());`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Replace Function constructor with single expression', () => {
		const code = `new Function("console.log('test')")();`;
		const expected = `console.log('test');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace Function constructor with multiple statements', () => {
		const code = `new Function("var x = 1; var y = 2; console.log(x + y);")();`;
		const expected = `{\n  var x = 1;\n  var y = 2;\n  console.log(x + y);\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace Function constructor with empty string', () => {
		const code = `new Function("")();`;
		const expected = `'';`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Replace Function constructor with variable declaration', () => {
		const code = `new Function("let x = 'hello'; console.log(x);")();`;
		const expected = `{\n  let x = 'hello';\n  console.log(x);\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not replace Function constructor with arguments', () => {
		const code = `new Function("return a + b")(1, 2);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not replace Function constructor with multiple parameters', () => {
		const code = `new Function("a", "b", "return a + b")();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not replace Function constructor with non-literal argument', () => {
		const code = `new Function(someVariable)();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not replace non-Function constructor', () => {
		const code = `new Array("1,2,3")();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Do not replace Function constructor not used as callee', () => {
		const code = `var func = new Function("console.log('test')");`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-6: Do not replace Function constructor with invalid syntax', () => {
		const code = `new Function("invalid syntax {{{")();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: replaceBooleanExpressionsWithIf', async () => {
	const targetModule = (await import('../src/modules/safe/replaceBooleanExpressionsWithIf.js')).default;
	it('TP-1: Simple logical AND', () => {
		const code = `x && y();`;
		const expected = `if (x) {\n  y();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Simple logical OR', () => {
		const code = `x || y();`;
		const expected = `if (!x) {\n  y();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Chained logical AND', () => {
		const code = `x && y && z();`;
		const expected = `if (x && y) {\n  z();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Chained logical OR', () => {
		const code = `x || y || z();`;
		const expected = `if (!(x || y)) {\n  z();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Function call in condition', () => {
		const code = `isValid() && doAction();`;
		const expected = `if (isValid()) {\n  doAction();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Member expression in condition', () => {
		const code = `obj.prop && execute();`;
		const expected = `if (obj.prop) {\n  execute();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not transform non-logical expressions', () => {
		const code = `x + y;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, code);
	});
	it('TN-2: Do not transform logical expressions not in expression statements', () => {
		const code = `var result = x && y;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, code);
	});
	it('TN-3: Do not transform bitwise operators', () => {
		const code = `x & y();`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, code);
	});
});
describe('SAFE: replaceSequencesWithExpressions', async () => {
	const targetModule = (await import('../src/modules/safe/replaceSequencesWithExpressions.js')).default;
	it('TP-1: Replace sequence with 2 expressions in if statement', () => {
		const code = `if (a) (b(), c());`;
		const expected = `if (a) {\n  b();\n  c();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Replace sequence with 3 expressions within existing block', () => {
		const code = `if (a) { (b(), c()); d() }`;
		const expected = `if (a) {\n  b();\n  c();\n  d();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace sequence in while loop', () => {
		const code = `while (x) (y++, z());`;
		const expected = `while (x) {\n  y++;\n  z();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace sequence with 4 expressions', () => {
		const code = `if (condition) (a(), b(), c(), d());`;
		const expected = `if (condition) {\n  a();\n  b();\n  c();\n  d();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Replace sequence in for loop body', () => {
		const code = `for (let i = 0; i < 10; i++) (foo(i), bar(i));`;
		const expected = `for (let i = 0; i < 10; i++) {\n  foo(i);\n  bar(i);\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Replace sequence with mixed expression types', () => {
		const code = `if (test) (x = 5, func(), obj.method());`;
		const expected = `if (test) {\n  x = 5;\n  func();\n  obj.method();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-7: Replace sequence in else clause', () => {
		const code = `if (a) doSomething(); else (first(), second());`;
		const expected = `if (a)\n  doSomething();\nelse {\n  first();\n  second();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not replace single expression (not a sequence)', () => {
		const code = `if (a) b();`;
		const expected = `if (a) b();`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not replace sequence with only one expression', () => {
		const code = `if (a) b;`;
		const expected = `if (a) b;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not replace sequence in non-ExpressionStatement context', () => {
		const code = `const result = (a(), b());`;
		const expected = `const result = (a(), b());`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not replace sequence in return statement', () => {
		const code = `function test() { return (x(), y()); }`;
		const expected = `function test() { return (x(), y()); }`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Do not replace sequence in assignment', () => {
		const code = `let value = (init(), compute());`;
		const expected = `let value = (init(), compute());`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveDeterministicIfStatements', async () => {
	const targetModule = (await import('../src/modules/safe/resolveDeterministicIfStatements.js')).default;
	it('TP-1: Resolve true and false literals', () => {
		const code = `if (true) do_a(); else do_b(); if (false) do_c(); else do_d();`;
		const expected = `do_a();\ndo_d();`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Resolve truthy number literal', () => {
		const code = `if (1) console.log('truthy'); else console.log('falsy');`;
		const expected = `console.log('truthy');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Resolve falsy number literal (0)', () => {
		const code = `if (0) console.log('truthy'); else console.log('falsy');`;
		const expected = `console.log('falsy');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Resolve truthy string literal', () => {
		const code = `if ('hello') console.log('truthy'); else console.log('falsy');`;
		const expected = `console.log('truthy');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Resolve falsy string literal (empty)', () => {
		const code = `if ('') console.log('truthy'); else console.log('falsy');`;
		const expected = `console.log('falsy');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Resolve null literal', () => {
		const code = `if (null) console.log('truthy'); else console.log('falsy');`;
		const expected = `console.log('falsy');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-7: Resolve if statement with no else clause (truthy)', () => {
		const code = `if (true) console.log('executed');`;
		const expected = `console.log('executed');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-8: Remove if statement with no else clause (falsy)', () => {
		const code = `before(); if (false) console.log('never'); after();`;
		const expected = `before();\nafter();`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-9: Resolve negative number literal', () => {
		const code = `if (-1) console.log('truthy'); else console.log('falsy');`;
		const expected = `console.log('truthy');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-10: Resolve nested if statements', () => {
		const code = `if (true) { if (false) inner(); else other(); }`;
		const expected = `{\n  other();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not resolve if with variable condition', () => {
		const code = `if (someVar) console.log('maybe');`;
		const expected = `if (someVar) console.log('maybe');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not resolve if with function call condition', () => {
		const code = `if (getValue()) console.log('maybe');`;
		const expected = `if (getValue()) console.log('maybe');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not resolve if with expression condition', () => {
		const code = `if (x + y) console.log('maybe');`;
		const expected = `if (x + y) console.log('maybe');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not resolve if with member expression condition', () => {
		const code = `if (obj.prop) console.log('maybe');`;
		const expected = `if (obj.prop) console.log('maybe');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveFunctionConstructorCalls', async () => {
	const targetModule = (await import('../src/modules/safe/resolveFunctionConstructorCalls.js')).default;
	it('TP-1: Replace Function.constructor with no parameters', () => {
		const code = `const func = Function.constructor('', "console.log('hello world!');");`;
		const expected = `const func = function () {\n  console.log('hello world!');\n};`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Part of a member expression', () => {
		const code = `a = Function.constructor('return /" + this + "/')().constructor('^([^ ]+( +[^ ]+)+)+[^ ]}');`;
		const expected = `a = function () {\n  return /" + this + "/;\n}().constructor('^([^ ]+( +[^ ]+)+)+[^ ]}');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace Function.constructor with single parameter', () => {
		const code = `const func = Function.constructor('x', 'return x * 2;');`;
		const expected = `const func = function (x) {\n  return x * 2;\n};`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace Function.constructor with multiple parameters', () => {
		const code = `const func = Function.constructor('a', 'b', 'return a + b;');`;
		const expected = `const func = function (a, b) {\n  return a + b;\n};`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Replace Function.constructor with complex body', () => {
		const code = `const func = Function.constructor('if (true) { return 42; } else { return 0; }');`;
		const expected = `const func = function () {\n  if (true) {\n    return 42;\n  } else {\n    return 0;\n  }\n};`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Replace Function.constructor with empty body', () => {
		const code = `const func = Function.constructor('');`;
		const expected = `const func = function () {\n};`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-7: Replace Function.constructor in variable assignment', () => {
		const code = `var myFunc = Function.constructor('n', 'return n > 0;');`;
		const expected = `var myFunc = function (n) {\n  return n > 0;\n};`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-8: Replace Function.constructor in call expression', () => {
		const code = `console.log(Function.constructor('return "test"')());`;
		const expected = `console.log((function () {\n  return 'test';\n}()));`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not replace Function.constructor with non-literal arguments', () => {
		const code = `const func = Function.constructor(param, 'return value;');`;
		const expected = `const func = Function.constructor(param, 'return value;');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not replace Function.constructor with no arguments', () => {
		const code = `const func = Function.constructor();`;
		const expected = `const func = Function.constructor();`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not replace non-constructor calls', () => {
		const code = `const func = Function.prototype('test');`;
		const expected = `const func = Function.prototype('test');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not replace Function.constructor with invalid syntax body', () => {
		const code = `const func = Function.constructor('invalid syntax {{{');`;
		const expected = `const func = Function.constructor('invalid syntax {{{');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-9: Replace any constructor call with literal arguments', () => {
		const code = `const result = obj.constructor('test');`;
		const expected = `const result = function () {\n  test;\n};`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveMemberExpressionReferencesToArrayIndex', async () => {
	const targetModule = (await import('../src/modules/safe/resolveMemberExpressionReferencesToArrayIndex.js')).default;
	it('TP-1', () => {
		const code = `const a = [1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,3];  b = a[0]; c = a[20];`;
		const expected = `const a = [\n  1,\n  1,\n  1,\n  1,\n  1,\n  1,\n  1,\n  1,\n  1,\n  1,
  2,\n  2,\n  2,\n  2,\n  2,\n  2,\n  2,\n  2,\n  2,\n  2,\n  3\n];\nb = 1;\nc = 3;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Replace multiple array accesses on same array', () => {
		const code = `const arr = [5,5,5,5,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,7]; const x = arr[0], y = arr[10], z = arr[20];`;
		const expected = `const arr = [\n  5,\n  5,\n  5,\n  5,\n  5,\n  5,\n  5,\n  5,\n  5,\n  5,\n  6,\n  6,\n  6,\n  6,\n  6,\n  6,\n  6,\n  6,\n  6,\n  6,\n  7\n];\nconst x = 5, y = 6, z = 7;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace array access with string literal elements', () => {
		const code = `const words = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u']; const first = words[0]; const last = words[20];`;
		const expected = `const words = [\n  'a',\n  'b',\n  'c',\n  'd',\n  'e',\n  'f',\n  'g',\n  'h',\n  'i',\n  'j',\n  'k',\n  'l',\n  'm',\n  'n',\n  'o',\n  'p',\n  'q',\n  'r',\n  's',\n  't',\n  'u'\n];\nconst first = 'a';\nconst last = 'u';`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace array access in function call arguments', () => {
		const code = `const nums = [9,9,9,9,9,9,9,9,9,9,8,8,8,8,8,8,8,8,8,8,7]; console.log(nums[0], nums[10], nums[20]);`;
		const expected = `const nums = [\n  9,\n  9,\n  9,\n  9,\n  9,\n  9,\n  9,\n  9,\n  9,\n  9,\n  8,\n  8,\n  8,\n  8,\n  8,\n  8,\n  8,\n  8,\n  8,\n  8,\n  7\n];\nconsole.log(9, 8, 7);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it(`TN-1: Don't resolve references to array methods`, () => {
		const code = `const a = [1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,3];  b = a['indexOf']; c = a['length'];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not resolve arrays smaller than minimum length', () => {
		const code = `const small = [1,2,3,4,5]; const x = small[0]; const y = small[2];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not resolve assignment to array elements', () => {
		const code = `const items = [1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,3]; items[0] = 99; items[10] = 88;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not resolve computed property access with variables', () => {
		const code = `const data = [1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,3]; const i = 5; const val = data[i];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Do not resolve out-of-bounds array access', () => {
		const code = `const bounds = [1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,3]; const invalid = bounds[100];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-6: Do not resolve negative array indices', () => {
		const code = `const negTest = [1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,3]; const neg = negTest[-1];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-7: Do not resolve floating point indices', () => {
		const code = `const floatTest = [1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,3]; const flt = floatTest[1.5];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveMemberExpressionsWithDirectAssignment', async () => {
	const targetModule = (await import('../src/modules/safe/resolveMemberExpressionsWithDirectAssignment.js')).default;
	it('TP-1: Replace direct property assignments with literal values', () => {
		const code = `function a() {} a.b = 3; a.c = '5'; console.log(a.b + a.c);`;
		const expected = `function a() {\n}\na.b = 3;\na.c = '5';\nconsole.log(3 + '5');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Replace object property assignments', () => {
		const code = `const obj = {}; obj.name = 'test'; obj.value = 42; const result = obj.name + obj.value;`;
		const expected = `const obj = {};\nobj.name = 'test';\nobj.value = 42;\nconst result = 'test' + 42;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace computed property assignments', () => {
		const code = `const data = {}; data['key'] = 'value'; console.log(data['key']);`;
		const expected = `const data = {};\ndata['key'] = 'value';\nconsole.log('value');`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace boolean and null assignments', () => {
		const code = `const state = {}; state.flag = true; state.data = null; if (state.flag) console.log(state.data);`;
		const expected = `const state = {};\nstate.flag = true;\nstate.data = null;\nif (true)\n  console.log(null);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Replace multiple references to same property', () => {
		const code = `let config = {}; config.timeout = 5000; const a = config.timeout; const b = config.timeout + 1000;`;
		const expected = `let config = {};\nconfig.timeout = 5000;\nconst a = 5000;\nconst b = 5000 + 1000;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it(`TN-1: Don't resolve with multiple assignments`, () => {
		const code = `const a = {}; a.b = ''; a.b = 3;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it(`TN-2: Don't resolve with update expressions`, () => {
		const code = `const a = {}; a.b = 0; ++a.b + 2;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not resolve when assigned non-literal value', () => {
		const code = `const obj = {}; obj.prop = getValue(); console.log(obj.prop);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not resolve when object has no declaration', () => {
		const code = `unknown.prop = 'value'; console.log(unknown.prop);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Do not resolve when property is reassigned', () => {
		const code = `const obj = {}; obj.data = 'first'; obj.data = 'second'; console.log(obj.data);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-6: Do not resolve when used in assignment expression', () => {
		const code = `const obj = {}; obj.counter = 0; obj.counter += 5; console.log(obj.counter);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-7: Do not resolve when property is computed with variable', () => {
		const code = `const obj = {}; const key = 'prop'; obj[key] = 'value'; console.log(obj[key]);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-8: Do not resolve when no references exist', () => {
		const code = `const obj = {}; obj.unused = 'value';`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveProxyCalls', async () => {
	const targetModule = (await import('../src/modules/safe/resolveProxyCalls.js')).default;
	it('TP-1: Replace chained proxy calls with direct function calls', () => {
		const code = `function call1(a, b) {return a + b;} function call2(c, d) {return call1(c, d);} function call3(e, f) {return call2(e, f);}`;
		const expected = `function call1(a, b) {\n  return a + b;\n}\nfunction call2(c, d) {\n  return call1(c, d);\n}\nfunction call3(e, f) {\n  return call1(e, f);\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Replace proxy with no parameters', () => {
		const code = `function target() { return 42; } function proxy() { return target(); } const result = proxy();`;
		const expected = `function target() {\n  return 42;\n}\nfunction proxy() {\n  return target();\n}\nconst result = target();`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace proxy with multiple parameters', () => {
		const code = `function add(a, b, c) { return a + b + c; } function addProxy(x, y, z) { return add(x, y, z); } const sum = addProxy(1, 2, 3);`;
		const expected = `function add(a, b, c) {\n  return a + b + c;\n}\nfunction addProxy(x, y, z) {\n  return add(x, y, z);\n}\nconst sum = add(1, 2, 3);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace proxy that calls another proxy (single-step resolution)', () => {
		const code = `function base() { return 'test'; } function proxy1() { return base(); } function proxy2() { return proxy1(); } console.log(proxy2());`;
		const expected = `function base() {\n  return 'test';\n}\nfunction proxy1() {\n  return base();\n}\nfunction proxy2() {\n  return base();\n}\nconsole.log(proxy1());`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not replace function with multiple statements', () => {
		const code = `function target() { return 42; } function notProxy() { console.log('side effect'); return target(); }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not replace function with no return statement', () => {
		const code = `function target() { return 42; } function notProxy() { target(); }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not replace function that returns non-call expression', () => {
		const code = `function notProxy() { return 42; }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not replace function that calls member expression', () => {
		const code = `const obj = { method: () => 42 }; function notProxy() { return obj.method(); }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Do not replace function with parameter count mismatch', () => {
		const code = `function target(a, b) { return a + b; } function notProxy(x) { return target(x, 0); }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-6: Do not replace function with reordered parameters', () => {
		const code = `function target(a, b) { return a - b; } function notProxy(x, y) { return target(y, x); }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-7: Do not replace function with modified parameters', () => {
		const code = `function target(a) { return a * 2; } function notProxy(x) { return target(x + 1); }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-8: Do not replace function with no references', () => {
		const code = `function target() { return 42; } function unreferencedProxy() { return target(); }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveProxyReferences', async () => {
	const targetModule = (await import('../src/modules/safe/resolveProxyReferences.js')).default;
	it('TP-1: Replace proxy reference with direct reference', () => {
		const code = `const a = ['']; const b = a; const c = b[0];`;
		const expected = `const a = [''];\nconst b = a;\nconst c = a[0];`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Replace multiple proxy references to same target', () => {
		const code = `const arr = [1, 2, 3]; const proxy = arr; const x = proxy[0]; const y = proxy[1];`;
		const expected = `const arr = [\n  1,\n  2,\n  3\n];\nconst proxy = arr;\nconst x = arr[0];\nconst y = arr[1];`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace member expression proxy references', () => {
		const code = `const obj = {prop: 42}; const alias = obj.prop; const result = alias;`;
		const expected = `const obj = { prop: 42 };\nconst alias = obj.prop;\nconst result = obj.prop;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Replace chained proxy references', () => {
		const code = `const original = 'test'; const proxy1 = original; const proxy2 = proxy1; const final = proxy2;`;
		const expected = `const original = 'test';\nconst proxy1 = original;\nconst proxy2 = original;\nconst final = proxy1;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Replace variable with let declaration', () => {
		const code = `let source = 'value'; let reference = source; console.log(reference);`;
		const expected = `let source = 'value';\nlet reference = source;\nconsole.log(source);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Replace variable with var declaration', () => {
		const code = `var base = [1, 2]; var link = base; var item = link[0];`;
		const expected = `var base = [\n  1,\n  2\n];\nvar link = base;\nvar item = base[0];`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not replace proxy in for-in statement', () => {
		const code = `const obj = {a: 1}; for (const key in obj) { const proxy = key; }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not replace proxy in for-of statement', () => {
		const code = `const arr = [1, 2]; for (const item of arr) { const proxy = item; }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not replace proxy in for statement', () => {
		const code = `const arr = [1, 2]; for (let i = 0; i < arr.length; i++) { const proxy = arr[i]; }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not replace circular references', () => {
		const code = `let a; let b; a = b; b = a;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Do not replace self-referencing variables', () => {
		const code = `const a = someFunction(a);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-6: Do not replace when proxy is modified', () => {
		const code = `const original = [1]; const proxy = original; proxy.push(2);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-7: Do not replace when target is modified', () => {
		const code = `let original = [1]; const proxy = original; original = [2];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-8: Do not replace when proxy has no references', () => {
		const code = `const original = 'test'; const unused = original;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-9: Do not replace non-identifier/non-member expression variables', () => {
		const code = `const a = func(); const b = a;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-7: Replace when target comes from function call (still safe)', () => {
		const code = `const a = getValue(); const b = a; console.log(b);`;
		const expected = `const a = getValue();\nconst b = a;\nconsole.log(a);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveProxyVariables', async () => {
	const targetModule = (await import('../src/modules/safe/resolveProxyVariables.js')).default;
	it('TP-1: Replace proxy variable references with target identifier', () => {
		const code = `const a2b = atob; console.log(a2b('NDI='));`;
		const expected = `console.log(atob('NDI='));`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Remove unused proxy variable declaration', () => {
		const code = `const a2b = atob, a = 3; console.log(a2b('NDI='));`;
		const expected = `const a = 3;\nconsole.log(atob('NDI='));`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Replace multiple references to same proxy', () => {
		const code = `const alias = original; console.log(alias); console.log(alias);`;
		const expected = `console.log(original);\nconsole.log(original);`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Remove proxy variable with no references', () => {
		const code = `const unused = target; console.log('other');`;
		const expected = `console.log('other');`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Replace with let declaration', () => {
		const code = `let proxy = original; console.log(proxy);`;
		const expected = `console.log(original);`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Replace with var declaration', () => {
		const code = `var proxy = original; console.log(proxy);`;
		const expected = `console.log(original);`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not replace when proxy is assigned non-identifier', () => {
		const code = `const proxy = getValue(); console.log(proxy);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not replace when proxy is modified', () => {
		const code = `const proxy = original; proxy = 'modified'; console.log(proxy);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not replace when proxy is updated', () => {
		const code = `const proxy = original; proxy++; console.log(proxy);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not replace when reference is used in assignment', () => {
		const code = `const proxy = original; const x = proxy = 'new';`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Do not replace non-identifier initialization', () => {
		const code = `const proxy = obj.prop; console.log(proxy);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveRedundantLogicalExpressions', async () => {
	const targetModule = (await import('../src/modules/safe/resolveRedundantLogicalExpressions.js')).default;
	it('TP-1: Simplify basic true and false literals with && and ||', () => {
		const code = `if (false && true) {} if (false || true) {} if (true && false) {} if (true || false) {}`;
		const expected = `if (false) {\n}\nif (true) {\n}\nif (false) {\n}\nif (true) {\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Simplify AND expressions with truthy left operand', () => {
		const code = `if (true && someVar) {} if (1 && someFunc()) {} if ("str" && obj.prop) {}`;
		const expected = `if (someVar) {\n}\nif (someFunc()) {\n}\nif (obj.prop) {\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Simplify AND expressions with falsy left operand', () => {
		const code = `if (false && someVar) {} if (0 && someFunc()) {} if ("" && obj.prop) {} if (null && x) {}`;
		const expected = `if (false) {\n}\nif (0) {\n}\nif ('') {\n}\nif (null) {\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Simplify AND expressions with truthy right operand', () => {
		const code = `if (someVar && true) {} if (someFunc() && 1) {} if (obj.prop && "str") {}`;
		const expected = `if (someVar) {\n}\nif (someFunc()) {\n}\nif (obj.prop) {\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Simplify AND expressions with falsy right operand', () => {
		const code = `if (someVar && false) {} if (someFunc() && 0) {} if (obj.prop && "") {} if (x && null) {}`;
		const expected = `if (false) {\n}\nif (0) {\n}\nif ('') {\n}\nif (null) {\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Simplify OR expressions with truthy left operand', () => {
		const code = `if (true || someVar) {} if (1 || someFunc()) {} if ("str" || obj.prop) {}`;
		const expected = `if (true) {\n}\nif (1) {\n}\nif ('str') {\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-7: Simplify OR expressions with falsy left operand', () => {
		const code = `if (false || someVar) {} if (0 || someFunc()) {} if ("" || obj.prop) {} if (null || x) {}`;
		const expected = `if (someVar) {\n}\nif (someFunc()) {\n}\nif (obj.prop) {\n}\nif (x) {\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-8: Simplify OR expressions with truthy right operand', () => {
		const code = `if (someVar || true) {} if (someFunc() || 1) {} if (obj.prop || "str") {}`;
		const expected = `if (true) {\n}\nif (1) {\n}\nif ('str') {\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-9: Simplify OR expressions with falsy right operand', () => {
		const code = `if (someVar || false) {} if (someFunc() || 0) {} if (obj.prop || "") {} if (x || null) {}`;
		const expected = `if (someVar) {\n}\nif (someFunc()) {\n}\nif (obj.prop) {\n}\nif (x) {\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-10: Handle complex expressions with nested logical operators', () => {
		const code = `if (true && (someVar && false)) {} if (false || (x || true)) {}`;
		const expected = `if (someVar && false) {\n}\nif (x || true) {\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Do not simplify when both operands are non-literals', () => {
		const code = `if (someVar && otherVar) {} if (func1() || func2()) {} if (obj.a && obj.b) {}`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not simplify non-logical expressions', () => {
		const code = `if (a + b) {} if (a === b) {} if (a > b) {} if (!a) {}`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not simplify logical expressions outside if statements', () => {
		const code = `if (someVar) { const x = true && someVar; const y = false || someFunc(); }`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not simplify unsupported logical operators (if any)', () => {
		const code = `if (a & b) {} if (a | b) {} if (a ^ b) {}`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: unwrapFunctionShells', async () => {
	const targetModule = (await import('../src/modules/safe/unwrapFunctionShells.js')).default;
	it('TP-1: Unwrap and rename', () => {
		const code = `function a(x) {return function b() {return x + 3}.apply(this, arguments);}`;
		const expected = `function b(x) {\n  return x + 3;\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Unwrap anonymous without renaming', () => {
		const code = `function a(x) {return function() {return x + 3}.apply(this, arguments);}`;
		const expected = `function a(x) {\n  return x + 3;\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: unwrapIIFEs', async () => {
	const targetModule = (await import('../src/modules/safe/unwrapIIFEs.js')).default;
	it('TP-1: Arrow functions', () => {
		const code = `var a = (() => {
      return b => {
        return c(b - 40);
      };
    })();`;
		const expected = `var a = b => {\n  return c(b - 40);\n};`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Function expressions', () => {
		const code = `var a = (function () {
  return b => c(b - 40);
})();`;
		const expected = `var a = b => c(b - 40);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: In-place unwrapping', () => {
		const code = `!function() {
	var a = 'message';
	console.log(a);
}();`;
		const expected = `var a = 'message';\nconsole.log(a);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Unary declarator init', () => {
		const code = `var b = !function() {
	var a = 'message';
	console.log(a);
}();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Unary assignment right', () => {
		const code = `b = !function() {
	var a = 'message';
	console.log(a);
}();`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: unwrapSimpleOperations', async () => {
	const targetModule = (await import('../src/modules/safe/unwrapSimpleOperations.js')).default;
	it('TP-1: Binary operations', () => {
		const code = `function add(b,c){return b + c;}
function minus(b,c){return b - c;}
function mul(b,c){return b * c;}
function div(b,c){return b / c;}
function mod(b,c){return b % c;}
function band(b,c){return b & c;}
function bor(b,c){return b | c;}
function and(b,c){return b && c;}
function or(b,c){return b || c;}
function power(b,c){return b ** c;}
function xor(b,c){return b ^ c;}
function lte(b,c){return b <= c;}
function gte(b,c){return b >= c;}
function lt(b,c){return b < c;}
function gt(b,c){return b > c;}
function equal(b,c){return b == c;}
function strictEqual(b,c){return b === c;}
function notEqual(b,c){return b != c;}
function strictNotEqual(b,c){return b !== c;}
function leftShift(b,c){return b << c;}
function rightShift(b,c){return b >> c;}
function unsignedRightShift(b,c){return b >>> c;}
function inOp(b,c){return b in c;}
function instanceofOp(b,c){return b instanceof c;}
function typeofOp(b){return typeof b;}
function nullishCoalescingOp(b,c){return b ?? c;}
add(1, 2);
minus(1, 2);
mul(1, 2);
div(1, 2);
mod(1, 2);
band(1, 2);
bor(1, 2);
and(1, 2);
or(1, 2);
power(1, 2);
xor(1, 2);
lte(1, 2);
gte(1, 2);
lt(1, 2);
gt(1, 2);
equal(1, 2);
strictEqual(1, 2);
notEqual(1, 2);
strictNotEqual(1, 2);
leftShift(1, 2);
rightShift(1, 2);
unsignedRightShift(1, 2);
inOp(1, 2);
instanceofOp(1, 2);
typeofOp(1);
nullishCoalescingOp(1, 2);
`;
		const expected = `function add(b, c) {
  return b + c;
}
function minus(b, c) {
  return b - c;
}
function mul(b, c) {
  return b * c;
}
function div(b, c) {
  return b / c;
}
function mod(b, c) {
  return b % c;
}
function band(b, c) {
  return b & c;
}
function bor(b, c) {
  return b | c;
}
function and(b, c) {
  return b && c;
}
function or(b, c) {
  return b || c;
}
function power(b, c) {
  return b ** c;
}
function xor(b, c) {
  return b ^ c;
}
function lte(b, c) {
  return b <= c;
}
function gte(b, c) {
  return b >= c;
}
function lt(b, c) {
  return b < c;
}
function gt(b, c) {
  return b > c;
}
function equal(b, c) {
  return b == c;
}
function strictEqual(b, c) {
  return b === c;
}
function notEqual(b, c) {
  return b != c;
}
function strictNotEqual(b, c) {
  return b !== c;
}
function leftShift(b, c) {
  return b << c;
}
function rightShift(b, c) {
  return b >> c;
}
function unsignedRightShift(b, c) {
  return b >>> c;
}
function inOp(b, c) {
  return b in c;
}
function instanceofOp(b, c) {
  return b instanceof c;
}
function typeofOp(b) {
  return typeof b;
}
function nullishCoalescingOp(b, c) {
  return b ?? c;
}
1 + 2;
1 - 2;
1 * 2;
1 / 2;
1 % 2;
1 & 2;
1 | 2;
1 && 2;
1 || 2;
1 ** 2;
1 ^ 2;
1 <= 2;
1 >= 2;
1 < 2;
1 > 2;
1 == 2;
1 === 2;
1 != 2;
1 !== 2;
1 << 2;
1 >> 2;
1 >>> 2;
1 in 2;
1 instanceof 2;
typeof 1;
1 ?? 2;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2 Unary operations', () => {
		const code = `function unaryNegation(v) {return -v;}
		function unaryPlus(v) {return +v;}
		function logicalNot(v) {return !v;}
		function bitwiseNot(v) {return ~v;}
		function typeofOp(v) {return typeof v;}
		function deleteOp(v) {return delete v;}
		function voidOp(v) {return void v;}
		(unaryNegation(1), unaryPlus(2), logicalNot(3), bitwiseNot(4), typeofOp(5), deleteOp(6), voidOp(7));
		`;
		const expected = `function unaryNegation(v) {\n  return -v;\n}\nfunction unaryPlus(v) {\n  return +v;\n}\nfunction logicalNot(v) {\n  return !v;\n}\nfunction bitwiseNot(v) {\n  return ~v;\n}\nfunction typeofOp(v) {\n  return typeof v;\n}\nfunction deleteOp(v) {\n  return delete v;\n}\nfunction voidOp(v) {\n  return void v;\n}\n-1, +2, !3, ~4, typeof 5, delete 6, void 7;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3 Update operations', () => {
		const code = `function incrementPre(v) {return ++v;}
		function decrementPost(v) {return v--;}
		(incrementPre(a), decrementPost(b));
		`;
		const expected = `function incrementPre(v) {\n  return ++v;\n}\nfunction decrementPost(v) {\n  return v--;\n}\n++a, b--;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: separateChainedDeclarators', async () => {
	const targetModule = (await import('../src/modules/safe/separateChainedDeclarators.js')).default;
	it('TP-1: A single const', () => {
		const code = `const foo = 5, bar = 7;`;
		const expected = `const foo = 5;\nconst bar = 7;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: A single let', () => {
		const code = `const a = 1; let foo = 5, bar = 7;`;
		const expected = `const a = 1;\nlet foo = 5;\nlet bar = 7;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: A var and a let', () => {
		const code = `!function() {var a, b = 2; let c, d = 3;}();`;
		const expected = `!(function () {\n  var a;\n  var b = 2;\n  let c;\n  let d = 3;\n}());`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Wrap in a block statement for a one-liner', () => {
		const code = `if (a) var b, c; while (true) var e = 3, d = 3;`;
		const expected = `if (a) {\n  var b;\n  var c;\n}\nwhile (true) {\n  var e = 3;\n  var d = 3;\n}`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Mixed initialization patterns', () => {
		const code = `var a, b = 2, c;`;
		const expected = `var a;\nvar b = 2;\nvar c;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Mixed declaration types with complex expressions', () => {
		const code = `const x = func(), y = [1, 2, 3], z = {prop: 'value'};`;
		const expected = `const x = func();\nconst y = [\n  1,\n  2,\n  3\n];\nconst z = { prop: 'value' };`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-7: Three or more declarations', () => {
		const code = `let a = 1, b = 2, c = 3, d = 4, e = 5;`;
		const expected = `let a = 1;\nlet b = 2;\nlet c = 3;\nlet d = 4;\nlet e = 5;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-8: Declarations in function scope', () => {
		const code = `function test() { const x = 1, y = 2; return x + y; }`;
		const expected = `function test() {\n  const x = 1;\n  const y = 2;\n  return x + y;\n}`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Variable declarators are not chained in for statement', () => {
		const code = `for (let i, b = 2, c = 3;;);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Variable declarators are not chained in for-in statement', () => {
		const code = `for (let a, b in obj);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Variable declarators are not chained in for-of statement', () => {
		const code = `for (let a, b of arr);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Single declarator should not be transformed', () => {
		const code = `const singleVar = 42;`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: ForAwaitStatement declarations should be preserved', () => {
		const code = `for await (let a, b of asyncIterable);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TN-6: Destructuring patterns should not be separated', () => {
		const code = `const {a, b} = obj, c = 3;`;
		const expected = `const {a, b} = obj;\nconst c = 3;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: simplifyCalls', async () => {
	const targetModule = (await import('../src/modules/safe/simplifyCalls.js')).default;
	it('TP-1: With args', () => {
		const code = `func1.apply(this, [arg1, arg2]); func2.call(this, arg1, arg2);`;
		const expected = `func1(arg1, arg2);\nfunc2(arg1, arg2);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Without args', () => {
		const code = `func1.apply(this); func2.call(this);`;
		const expected = `func1();\nfunc2();`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Mixed calls with complex arguments', () => {
		const code = `func.call(this, a + b, getValue()); obj.method.apply(this, [x, y, z]);`;
		const expected = `func(a + b, getValue());\nobj.method(x, y, z);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Calls on member expressions', () => {
		const code = `obj.method.call(this, arg1); nested.obj.func.apply(this, [arg2]);`;
		const expected = `obj.method(arg1);\nnested.obj.func(arg2);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Apply with empty array', () => {
		const code = `func.apply(this, []);`;
		const expected = `func();`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Call and apply in same expression', () => {
		const code = `func1.call(this, arg) + func2.apply(this, [arg]);`;
		const expected = `func1(arg) + func2(arg);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Ignore calls without ThisExpression', () => {
		const code = `func1.apply({}); func2.call(null); func3.apply(obj);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-2: Do not transform Function constructor calls', () => {
		const code = `Function.call(this, 'return 42'); Function.apply(this, ['return 42']);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-3: Do not transform calls on function expressions', () => {
		const code = `(function() {}).call(this); (function() {}).apply(this, []);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-4: Do not transform other method names', () => {
		const code = `func.bind(this, arg); func.toString(this); func.valueOf(this);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-5: Do not transform computed property access', () => {
		const code = `func['call'](this, arg); obj['apply'](this, [arg]);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-6: Do not transform calls with this in wrong position', () => {
		const code = `func.call(arg, this); func.apply(arg1, this, arg2);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: simplifyIfStatements', async () => {
	const targetModule = (await import('../src/modules/safe/simplifyIfStatements.js')).default;
	it('TP-1: Empty blocks', () => {
		const code = `if (J) {} else {}`;
		const expected = `J;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Empty blocks with an empty alternate statement', () => {
		const code = `if (J) {} else;`;
		const expected = `J;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-3: Empty blocks with a populated alternate statement', () => {
		const code = `if (J) {} else J();`;
		const expected = `if (!J)\n  J();`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-4: Empty blocks with a populated alternate block', () => {
		const code = `if (J) {} else {J()}`;
		const expected = `if (!J) {\n  J();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-5: Empty statements', () => {
		const code = `if (J); else;`;
		const expected = `J;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-6: Empty statements with no alternate', () => {
		const code = `if (J);`;
		const expected = `J;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-7: Empty statements with an empty alternate', () => {
		const code = `if (J) {}`;
		const expected = `J;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});