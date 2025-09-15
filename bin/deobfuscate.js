#!/usr/bin/env node
import {REstringer} from '../src/restringer.js';
import {parseArgs} from '../src/utils/parseArgs.js';

try {
	const args = parseArgs(process.argv.slice(2));
	
	// Skip processing if help was displayed
	if (args.help) process.exit(0);
	
	const fs = await import('node:fs');
	let content = fs.readFileSync(args.inputFilename, 'utf-8');
		const startTime = Date.now();

		const restringer = new REstringer(content);
		if (args.quiet) restringer.logger.setLogLevelNone();
		else if (args.verbose) restringer.logger.setLogLevelDebug();
		restringer.logger.log(`[!] REstringer v${REstringer.__version__}`);
		restringer.logger.log(`[!] Deobfuscating ${args.inputFilename}...`);
		if (args.maxIterations) {
			restringer.maxIterations.value = args.maxIterations;
			restringer.logger.log(`[!] Running at most ${args.maxIterations} iterations`);
		}
		if (restringer.deobfuscate()) {
			restringer.logger.log(`[+] Saved ${args.outputFilename}`);
			restringer.logger.log(`[!] Deobfuscation took ${(Date.now() - startTime) / 1000} seconds.`);
			if (args.outputToFile) fs.writeFileSync(args.outputFilename, restringer.script, {encoding: 'utf-8'});
			else console.log(restringer.script);
		} else restringer.logger.log(`[-] Nothing was deobfuscated  ¯\\_(ツ)_/¯`);
} catch (e) {
	console.error(`[-] Critical Error: ${e}`);
}
