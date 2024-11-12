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
	it('TP-1: Only valid identifiers are normalized to non-computed properties', () => {
		const code = `hello['world'][0]['%32']['valid']`;
		const expected = `hello.world[0]['%32'].valid;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: normalizeEmptyStatements', async () => {
	const targetModule = (await import('../src/modules/safe/normalizeEmptyStatements.js')).default;
	it('TP-1: All relevant empty statement are removed', () => {
		const code = `;;var a = 3;;`;
		const expected = `var a = 3;`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TN-1: Empty statements are not removed from for-loops', () => {
		const code = `;for (;;);;`;
		const expected = `for (;;);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: parseTemplateLiteralsIntoStringLiterals', async () => {
	const targetModule = (await import('../src/modules/safe/parseTemplateLiteralsIntoStringLiterals.js')).default;
	it('TP-1: Only valid identifiers are normalized to non-computed properties', () => {
		const code = '`hello ${"world"}!`;';
		const expected = `'hello world!';`;
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
});
describe('SAFE: rearrangeSwitches', async () => {
	const targetModule = (await import('../src/modules/safe/rearrangeSwitches.js')).default;
	it('TP-1', () => {
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
});
describe('SAFE: replaceFunctionShellsWithWrappedValue', async () => {
	const targetModule = (await import('../src/modules/safe/replaceFunctionShellsWithWrappedValue.js')).default;
	it('TP-1: Replace references with identifier', () => {
		const code = `function a() {return String}\na()(val);`;
		const expected = `function a() {\n  return String;\n}\nString(val);`;
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
});
describe('SAFE: replaceFunctionShellsWithWrappedValueIIFE', async () => {
	const targetModule = (await import('../src/modules/safe/replaceFunctionShellsWithWrappedValueIIFE.js')).default;
	it('TP-1: Replace with wrapped value in-place', () => {
		const code = `(function a() {return String}\n)()(val);`;
		const expected = `String(val);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: replaceIdentifierWithFixedAssignedValue', async () => {
	const targetModule = (await import('../src/modules/safe/replaceIdentifierWithFixedAssignedValue.js')).default;
	it('TP-1', () => {
		const code = `const a = 3; const b = a * 2; console.log(b + a);`;
		const expected = `const a = 3;\nconst b = 3 * 2;\nconsole.log(b + 3);`;
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
});
describe('SAFE: replaceIdentifierWithFixedValueNotAssignedAtDeclaration', async () => {
	const targetModule = (await import('../src/modules/safe/replaceIdentifierWithFixedValueNotAssignedAtDeclaration.js')).default;
	it('TP-1', () => {
		const code = `let a; a = 3; const b = a * 2; console.log(b + a);`;
		const expected = `let a;\na = 3;\nconst b = 3 * 2;\nconsole.log(b + 3);`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: replaceNewFuncCallsWithLiteralContent', async () => {
	const targetModule = (await import('../src/modules/safe/replaceNewFuncCallsWithLiteralContent.js')).default;
	it('TP-1', () => {
		const code = `new Function("!function() {console.log('hello world')}()")();`;
		const expected = `!(function () {\n  console.log('hello world');\n}());`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: replaceBooleanExpressionsWithIf', async () => {
	const targetModule = (await import('../src/modules/safe/replaceBooleanExpressionsWithIf.js')).default;
	it('TP-1: Logical AND', () => {
		const code = `x && y && z();`;
		const expected = `if (x && y) {\n  z();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: Logical OR', () => {
		const code = `x || y || z();`;
		const expected = `if (!(x || y)) {\n  z();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: replaceSequencesWithExpressions', async () => {
	const targetModule = (await import('../src/modules/safe/replaceSequencesWithExpressions.js')).default;
	it('TP-1: 2 expressions', () => {
		const code = `if (a) (b(), c());`;
		const expected = `if (a) {\n  b();\n  c();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
	it('TP-2: 3 expressions', () => {
		const code = `if (a) { (b(), c()); d() }`;
		const expected = `if (a) {\n  b();\n  c();\n  d();\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveDeterministicIfStatements', async () => {
	const targetModule = (await import('../src/modules/safe/resolveDeterministicIfStatements.js')).default;
	it('TP-1', () => {
		const code = `if (true) do_a(); else do_b(); if (false) do_c(); else do_d();`;
		const expected = `do_a();\ndo_d();`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveFunctionConstructorCalls', async () => {
	const targetModule = (await import('../src/modules/safe/resolveFunctionConstructorCalls.js')).default;
	it('TP-1', () => {
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
	it(`TN-1: Don't resolve references to array methods`, () => {
		const code = `const a = [1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,3];  b = a['indexOf']; c = a['length'];`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveMemberExpressionsWithDirectAssignment', async () => {
	const targetModule = (await import('../src/modules/safe/resolveMemberExpressionsWithDirectAssignment.js')).default;
	it('TP-1', () => {
		const code = `function a() {} a.b = 3; a.c = '5'; console.log(a.b + a.c);`;
		const expected = `function a() {\n}\na.b = 3;\na.c = '5';\nconsole.log(3 + '5');`;
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
});
describe('SAFE: resolveProxyCalls', async () => {
	const targetModule = (await import('../src/modules/safe/resolveProxyCalls.js')).default;
	it('TP-1', () => {
		const code = `function call1(a, b) {return a + b;} function call2(c, d) {return call1(c, d);} function call3(e, f) {return call2(e, f);}`;
		const expected = `function call1(a, b) {\n  return a + b;\n}\nfunction call2(c, d) {\n  return call1(c, d);\n}\nfunction call3(e, f) {\n  return call1(e, f);\n}`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveProxyReferences', async () => {
	const targetModule = (await import('../src/modules/safe/resolveProxyReferences.js')).default;
	it('TP-1', () => {
		const code = `const a = ['']; const b = a; const c = b[0];`;
		const expected = `const a = [''];\nconst b = a;\nconst c = a[0];`;
		const result = applyModuleToCode(code, targetModule);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveProxyVariables', async () => {
	const targetModule = (await import('../src/modules/safe/resolveProxyVariables.js')).default;
	it('TP-1', () => {
		const code = `const a2b = atob; console.log(a2b('NDI='));`;
		const expected = `console.log(atob('NDI='));`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
	it('TP-2', () => {
		const code = `const a2b = atob, a = 3; console.log(a2b('NDI='));`;
		const expected = `const a = 3;\nconsole.log(atob('NDI='));`;
		const result = applyModuleToCode(code, targetModule, true);
		assert.strictEqual(result, expected);
	});
});
describe('SAFE: resolveRedundantLogicalExpressions', async () => {
	const targetModule = (await import('../src/modules/safe/resolveRedundantLogicalExpressions.js')).default;
	it('TP-1', () => {
		const code = `if (false && true) {} if (false || true) {} if (true && false) {} if (true || false) {}`;
		const expected = `if (false) {\n}\nif (true) {\n}\nif (false) {\n}\nif (true) {\n}`;
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
	it('TN-1L Variable declarators are not chained', () => {
		const code = `for (let i, b = 2, c = 3;;);`;
		const expected = code;
		const result = applyModuleToCode(code, targetModule, true);
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
	it('TN-1: Ignore calls without ThisExpression', () => {
		const code = `func1.apply({}); func2.call(null);`;
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