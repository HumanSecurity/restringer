import {Arborist} from 'flast';
import assert from 'node:assert';
import {describe, it} from 'node:test';

/**
 * @param {Arborist} arb
 */
function applyEachProcessor(arb) {
	return proc => {
		if (typeof proc === 'function') {
			arb = proc(arb);
			arb.applyChanges();
		}
	};
}

/**
 * @param {Arborist} arb
 * @param {{preprocessors, postprocessors}} processors
 * @return {Arborist}
 */
function applyProcessors(arb, processors) {
	processors.preprocessors.forEach(applyEachProcessor(arb));
	processors.postprocessors.forEach(applyEachProcessor(arb));
	return arb;
}

describe('Processors tests: Augmented Array', async () => {
	const targetProcessors = (await import('../src/processors/augmentedArray.js'));
	it('TP-1: Complex IIFE with mixed array elements', () => {
		const code = `const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'a', 'b', 'c'];
(function (targetArray, numberOfShifts) {
  var augmentArray = function (counter) {
    while (--counter) {
        targetArray['push'](targetArray['shift']());
    }
  };
  augmentArray(++numberOfShifts);
}(arr, 3));`;
		const expected  = `const arr = [\n  4,\n  5,\n  6,\n  7,\n  8,\n  9,\n  10,\n  'a',\n  'b',\n  'c',\n  1,\n  2,\n  3\n];`;
		let arb = new Arborist(code);
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, expected);
	});
	it('TP-2: Simple array with single shift', () => {
		const code = `const data = ['first', 'second', 'third'];
(function(arr, shifts) {
  for (let i = 0; i < shifts; i++) {
    arr.push(arr.shift());
  }
})(data, 1);`;
		const expected = `const data = [\n  'second',\n  'third',\n  'first'\n];`;
		let arb = new Arborist(code);
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, expected);
	});
	it('TP-3: Array with zero shifts (no change)', () => {
		const code = `const unchanged = [1, 2, 3];
(function(arr, n) {
  for (let i = 0; i < n; i++) {
    arr.push(arr.shift());
  }
})(unchanged, 0);`;
		const expected = `const unchanged = [\n  1,\n  2,\n  3\n];`;
		let arb = new Arborist(code);
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, expected);
	});
	it('TP-4: Array with larger shift count', () => {
		const code = `const numbers = [10, 20, 30, 40, 50];
(function(arr, count) {
  for (let i = 0; i < count; i++) {
    arr.push(arr.shift());
  }
})(numbers, 3);`;
		const expected = `const numbers = [\n  40,\n  50,\n  10,\n  20,\n  30\n];`;
		let arb = new Arborist(code);
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, expected);
	});
	it('TN-1: IIFE with non-literal shift count', () => {
		const code = `const arr = [1, 2, 3];
let shifts = 2;
(function(array, n) {
  for (let i = 0; i < n; i++) {
    array.push(array.shift());
  }
})(arr, shifts);`;
		let arb = new Arborist(code);
		const originalScript = arb.script;
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, originalScript);
	});
	it('TN-2: IIFE with insufficient arguments', () => {
		const code = `const arr = [1, 2, 3];
(function(array) {
  array.push(array.shift());
})(arr);`;
		let arb = new Arborist(code);
		const originalScript = arb.script;
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, originalScript);
	});
	it('TN-3: IIFE with non-identifier array argument', () => {
		const code = `(function(array, shifts) {
  for (let i = 0; i < shifts; i++) {
    array.push(array.shift());
  }
})([1, 2, 3], 1);`;
		let arb = new Arborist(code);
		const originalScript = arb.script;
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, originalScript);
	});
	it('TN-4: Non-IIFE function call', () => {
		const code = `const arr = [1, 2, 3];
function shuffle(array, shifts) {
  for (let i = 0; i < shifts; i++) {
    array.push(array.shift());
  }
}
shuffle(arr, 2);`;
		let arb = new Arborist(code);
		const originalScript = arb.script;
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, originalScript);
	});
	it('TN-5: Invalid shift count (NaN)', () => {
		const code = `const arr = [1, 2, 3];
(function(array, shifts) {
  for (let i = 0; i < shifts; i++) {
    array.push(array.shift());
  }
})(arr, "invalid");`;
		let arb = new Arborist(code);
		const originalScript = arb.script;
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, originalScript);
	});
	it('TN-9: Function passed to IIFE (function not self-modifying)', () => {
		const code = `function getArray() {
  return ['a', 'b', 'c'];
}
(function(fn, shifts) {
  const arr = fn();
  for (let i = 0; i < shifts; i++) {
    arr.push(arr.shift());
  }
})(getArray, 2);`;
		// The IIFE modifies a local copy, but the function itself is not self-modifying
		// so no transformation should occur
		let arb = new Arborist(code);
		const originalScript = arb.script;
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, originalScript);
	});
	it('TP-5: Arrow function IIFE', () => {
		const code = `const items = ['x', 'y', 'z'];
((arr, n) => {
  for (let i = 0; i < n; i++) {
    arr.push(arr.shift());
  }
})(items, 1);`;
		const expected = `const items = [
  'y',
  'z',
  'x'
];`;
		let arb = new Arborist(code);
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, expected);
	});
	it('TP-6: Shift count larger than array length', () => {
		const code = `const small = ['a', 'b'];
(function(arr, shifts) {
  for (let i = 0; i < shifts; i++) {
    arr.push(arr.shift());
  }
})(small, 5);`;
		// 5 shifts on 2-element array: a,b -> b,a -> a,b -> b,a -> a,b -> b,a
		const expected = `const small = [
  'b',
  'a'
];`;
		let arb = new Arborist(code);
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, expected);
	});
	it('TN-10: Arrow function without parentheses around parameters', () => {
		const code = `const arr = [1, 2, 3];
(arr => {
  arr.push(arr.shift());
})(arr);`;
		let arb = new Arborist(code);
		const originalScript = arb.script;
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, originalScript);
	});
	it('TN-11: Negative shift count', () => {
		const code = `const arr = [1, 2, 3];
(function(array, shifts) {
  for (let i = 0; i < shifts; i++) {
    array.push(array.shift());
  }
})(arr, -1);`;
		let arb = new Arborist(code);
		const originalScript = arb.script;
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, originalScript);
	});
	it('TN-12: IIFE with complex array manipulation that cannot be resolved', () => {
		const code = `const arr = [1, 2, 3];
(function(array, shifts) {
  Math.random() > 0.5 ? array.push(array.shift()) : array.unshift(array.pop());
})(arr, 1);`;
		let arb = new Arborist(code);
		const originalScript = arb.script;
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, originalScript);
	});
});
describe('Processors tests: Caesar Plus', async () => {
	const targetProcessors = (await import('../src/processors/caesarp.js'));
	// TODO: Fix test
	it.skip('TP-1: FIX ME', () => {
		const code = `(function() {
	const a = document.createElement('div');
	const b = 'Y29uc29sZS5sb2co';
	const c = 'IlJFc3RyaW5nZXIiKQ==';
	a.innerHTML = b + c;
	const atb = window.atob || function (val) {return Buffer.from(val, 'base64').toString()};
	let dbt = {};
	const abc = a.innerHTML;
	dbt['toString'] = ''.constructor.constructor(atb(abc));
	dbt = dbt + "this will execute dbt's toString method";
})();`;
		const expected  = `console.log("REstringer")`;
		let arb = new Arborist(code);
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, expected);
	});
});
describe('Processors tests: Function to Array', async () => {
	const targetProcessors = (await import('../src/processors/functionToArray.js'));
	it('TP-1: Independent call', () => {
		const code = `function getArr() {return ['One', 'Two', 'Three']} const a = getArr(); console.log(a[0] + ' + ' + a[1] + ' = ' + a[2]);`;
		const expected  = `function getArr() {\n  return [\n    'One',\n    'Two',\n    'Three'\n  ];\n}\nconst a = [\n  'One',\n  'Two',\n  'Three'\n];\nconsole.log(a[0] + ' + ' + a[1] + ' = ' + a[2]);`;
		let arb = new Arborist(code);
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, expected);
	});
	it('TP-2: IIFE', () => {
		const code = `const a = (function(){return ['One', 'Two', 'Three']})(); console.log(a[0] + ' + ' + a[1] + ' = ' + a[2]);`;
		const expected  = `const a = [\n  'One',\n  'Two',\n  'Three'\n];\nconsole.log(a[0] + ' + ' + a[1] + ' = ' + a[2]);`;
		let arb = new Arborist(code);
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, expected);
	});
	it('TN-1', () => {
		const code = `function getArr() {return ['One', 'Two', 'Three']} console.log(getArr()[0] + ' + ' + getArr()[1] + ' = ' + getArr()[2]);`;
		const expected  = code;
		let arb = new Arborist(code);
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, expected);
	});
});
describe('Processors tests: Obfuscator.io', async () => {
	const targetProcessors = (await import('../src/processors/obfuscatorIo.js'));
	it('TP-1', () => {
		const code = `var a = {
  'removeCookie': function () {
    return 'dev';
  }
}`;
		const expected  = `var a = { 'removeCookie': 'function () {return "bypassed!"}' };`;
		let arb = new Arborist(code);
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, expected);
	});
	it('TP-2', () => {
		const code = `var a = function (f) {
  this['JoJo'] = function () {
    return 'newState';
  }
}`;
		const expected  = `var a = function (f) {
  this['JoJo'] = 'function () {return "bypassed!"}';
};`;
		let arb = new Arborist(code);
		arb = applyProcessors(arb, targetProcessors);
		assert.strictEqual(arb.script, expected);
	});
});
