import assert from 'node:assert';
import {describe, it} from 'node:test';
import {parseArgs} from '../src/utils/parseArgs.js';
const consolelog = console.log;

describe('parseArgs tests', () => {
	it('TP-1: Defaults', () => {
		assert.deepEqual(parseArgs(['input.js']), {
			inputFilename: 'input.js',
			help: false,
			clean: false,
			quiet: false,
			verbose: false,
			outputToFile: false,
			maxIterations: false,
			outputFilename: 'input.js-deob.js'
		});
	});
	it('TP-2: All on - short', () => {
		assert.deepEqual(parseArgs(['input.js', '-h', '-c', '-q', '-v', '-o', '-m', '1']), {
			inputFilename: 'input.js',
			help: true,
			clean: true,
			quiet: true,
			verbose: true,
			outputToFile: true,
			maxIterations: 1,
			outputFilename: 'input.js-deob.js'
		});
	});
	it('TP-3: All on - full', () => {
		assert.deepEqual(parseArgs(['input.js', '--help', '--clean', '--quiet', '--verbose', '--output', '--max-iterations=1']), {
			inputFilename: 'input.js',
			help: true,
			clean: true,
			quiet: true,
			verbose: true,
			outputToFile: true,
			maxIterations: 1,
			outputFilename: 'input.js-deob.js'
		});
	});
	it('TP-4: Custom outputFilename split', () => {
		assert.deepEqual(parseArgs(['input.js', '-o', 'customName.js']), {
			inputFilename: 'input.js',
			help: false,
			clean: false,
			quiet: false,
			verbose: false,
			outputToFile: true,
			maxIterations: false,
			outputFilename: 'customName.js'
		});
	});
	it('TP-5: Custom outputFilename equals', () => {
		assert.deepEqual(parseArgs(['input.js', '-o=customName.js']), {
			inputFilename: 'input.js',
			help: false,
			clean: false,
			quiet: false,
			verbose: false,
			outputToFile: true,
			maxIterations: false,
			outputFilename: 'customName.js'
		});
	});
	it('TP-6: Custom outputFilename full', () => {
		assert.deepEqual(parseArgs(['input.js', '--output=customName.js']), {
			inputFilename: 'input.js',
			help: false,
			clean: false,
			quiet: false,
			verbose: false,
			outputToFile: true,
			maxIterations: false,
			outputFilename: 'customName.js'
		});
	});
	it('TP-7: Max iterations short equals', () => {
		assert.deepEqual(parseArgs(['input.js', '-m=2']), {
			inputFilename: 'input.js',
			help: false,
			clean: false,
			quiet: false,
			verbose: false,
			outputToFile: false,
			maxIterations: 2,
			outputFilename: 'input.js-deob.js'
		});
	});
	it('TP-8: Max iterations short split', () => {
		assert.deepEqual(parseArgs(['input.js', '-m', '2']), {
			inputFilename: 'input.js',
			help: false,
			clean: false,
			quiet: false,
			verbose: false,
			outputToFile: false,
			maxIterations: 2,
			outputFilename: 'input.js-deob.js'
		});
	});
	it('TP-9: Max iterations long equals', () => {
		assert.deepEqual(parseArgs(['input.js', '--max-iterations=2']), {
			inputFilename: 'input.js',
			help: false,
			clean: false,
			quiet: false,
			verbose: false,
			outputToFile: false,
			maxIterations: 2,
			outputFilename: 'input.js-deob.js'
		});
	});
	it('TP-10: Max iterations long split', () => {
		assert.deepEqual(parseArgs(['input.js', '--max-iterations', '2']), {
			inputFilename: 'input.js',
			help: false,
			clean: false,
			quiet: false,
			verbose: false,
			outputToFile: false,
			maxIterations: 2,
			outputFilename: 'input.js-deob.js'
		});
	});
});