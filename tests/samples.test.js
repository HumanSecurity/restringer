import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {REstringer} from '../src/restringer.js';

function getDeobfuscatedCode(code) {
	const restringer = new REstringer(code);
	restringer.logger.setLogLevel(restringer.logger.logLevels.NONE);
	restringer.deobfuscate();
	return restringer.script;
}

describe('Samples tests', () => {
	const resourcePath = './resources';
	const cwd = fileURLToPath(import.meta.url).split('/').slice(0, -1).join('/');
	it('Deobfuscate sample: JSFuck', () => {
		const sampleFilename = join(cwd, resourcePath, 'jsfuck.js');
		const expectedSolutionFilename = sampleFilename + '-deob.js';
		const code = readFileSync(sampleFilename, 'utf-8');
		const expected  = readFileSync(expectedSolutionFilename, 'utf-8');
		const result = getDeobfuscatedCode(code);
		assert.strictEqual(result, expected);
	});
	it('Deobfuscate sample: Ant & Cockroach', () => {
		const sampleFilename = join(cwd, resourcePath, 'ant.js');
		const expectedSolutionFilename = sampleFilename + '-deob.js';
		const code = readFileSync(sampleFilename, 'utf-8');
		const expected  = readFileSync(expectedSolutionFilename, 'utf-8');
		const result = getDeobfuscatedCode(code);
		assert.strictEqual(result, expected);
	});
	it('Deobfuscate sample: New Function IIFE', () => {
		const sampleFilename = join(cwd, resourcePath, 'newFunc.js');
		const expectedSolutionFilename = sampleFilename + '-deob.js';
		const code = readFileSync(sampleFilename, 'utf-8');
		const expected  = readFileSync(expectedSolutionFilename, 'utf-8');
		const result = getDeobfuscatedCode(code);
		assert.strictEqual(result, expected);
	});
	it('Deobfuscate sample: Hunter', () => {
		const sampleFilename = join(cwd, resourcePath, 'hunter.js');
		const expectedSolutionFilename = sampleFilename + '-deob.js';
		const code = readFileSync(sampleFilename, 'utf-8');
		const expected  = readFileSync(expectedSolutionFilename, 'utf-8');
		const result = getDeobfuscatedCode(code);
		assert.strictEqual(result, expected);
	});
	it('Deobfuscate sample: _$_', () => {
		const sampleFilename = join(cwd, resourcePath, 'udu.js');
		const expectedSolutionFilename = sampleFilename + '-deob.js';
		const code = readFileSync(sampleFilename, 'utf-8');
		const expected  = readFileSync(expectedSolutionFilename, 'utf-8');
		const result = getDeobfuscatedCode(code);
		assert.strictEqual(result, expected);
	});
	it('Deobfuscate sample: Prototype Calls', () => {
		const sampleFilename = join(cwd, resourcePath, 'prototypeCalls.js');
		const expectedSolutionFilename = sampleFilename + '-deob.js';
		const code = readFileSync(sampleFilename, 'utf-8');
		const expected  = readFileSync(expectedSolutionFilename, 'utf-8');
		const result = getDeobfuscatedCode(code);
		assert.strictEqual(result, expected);
	});
	it.skip('TODO: FIX Deobfuscate sample: Caesar+', () => {
		const sampleFilename = join(cwd, resourcePath, 'caesar.js');
		const expectedSolutionFilename = sampleFilename + '-deob.js';
		const code = readFileSync(sampleFilename, 'utf-8');
		const expected  = readFileSync(expectedSolutionFilename, 'utf-8');
		const result = getDeobfuscatedCode(code);
		assert.strictEqual(result, expected);
	});
	it('Deobfuscate sample: eval(Ox$', () => {
		const sampleFilename = join(cwd, resourcePath, 'evalOxd.js');
		const expectedSolutionFilename = sampleFilename + '-deob.js';
		const code = readFileSync(sampleFilename, 'utf-8');
		const expected  = readFileSync(expectedSolutionFilename, 'utf-8');
		const result = getDeobfuscatedCode(code);
		assert.strictEqual(result, expected);
	});
	it('Deobfuscate sample: Obfuscator.io', () => {
		const sampleFilename = join(cwd, resourcePath, 'obfuscator.io.js');
		const expectedSolutionFilename = sampleFilename + '-deob.js';
		const code = readFileSync(sampleFilename, 'utf-8');
		const expected  = readFileSync(expectedSolutionFilename, 'utf-8');
		const result = getDeobfuscatedCode(code);
		assert.strictEqual(result, expected);
	});
	it('Deobfuscate sample: $s', () => {
		const sampleFilename = join(cwd, resourcePath, 'ds.js');
		const expectedSolutionFilename = sampleFilename + '-deob.js';
		const code = readFileSync(sampleFilename, 'utf-8');
		const expected  = readFileSync(expectedSolutionFilename, 'utf-8');
		const result = getDeobfuscatedCode(code);
		assert.strictEqual(result, expected);
	});
	it('Deobfuscate sample: Local Proxies', () => {
		const sampleFilename = join(cwd, resourcePath, 'localProxies.js');
		const expectedSolutionFilename = sampleFilename + '-deob.js';
		const code = readFileSync(sampleFilename, 'utf-8');
		const expected  = readFileSync(expectedSolutionFilename, 'utf-8');
		const result = getDeobfuscatedCode(code);
		assert.strictEqual(result, expected);
	});
});