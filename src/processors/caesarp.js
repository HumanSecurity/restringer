import {Arborist} from 'flast';
import {safe} from '../modules/index.js';
const {removeDeadNodes} = safe;

const LINE_WITH_FINAL_ASSIGNMENT_REGEX = /(\w{3})\[.*]\s*=.*\((\w{3})\).*=\s*\1\s*\+\s*['"]/ms;
const VARIABLE_CONTAINING_THE_INNER_LAYER_REGEX = /\(((\w{3}\()+(\w{3})\)*)\)/gms;

/**
 * Caesar+ Deobfuscator
 * The Caesar+ obfuscation comprises two layers:
 * 1. The outer layer builds the inner layer by using HTMLElements to manipulate strings,
 *    creating elements, concatenating strings to their innerHTML properties, base64 decoding and concatenating again,
 *    it assigns the resulting string to a variable's toString method and then implicitly invokes it.
 *    E.g.
 *    (function() {
 *      const a = document.createElement('div');
 *     const b = 'Y29uc29sZS5sb2co';
 *     const c = 'IlJFc3RyaW5nZXIiKQ==';
 *     a.innerHTML = b + c;
 *     const atb = window.atob || function (val) {return Buffer.from(val, 'base64').toString()};
 *     let dbt = {};
 *     const abc = a.innerHTML;
 *     dbt['toString'] = ''.constructor.constructor(atb(abc));
 *     dbt = dbt + "this will execute dbt's toString method";
 *    })();
 *
 * 2. The inner layer contains a cnc check and other run-time limiters,
 *    but also the original target code, still obfuscated.
 *
 * @param {Arborist} arb
 * @return {Arborist}
 */
function extractInnerLayer(arb) {
	// The outer layer is a lot of code moved around and concatenated, but it all comes together in the last
	// couple of lines where an object's toString is being replaced with the inner layer code, and then
	// run when the object is being added to a string, implicitly invoking the object's toString method.
	// We can catch the variable holding the code before it's injected and output it instead.
	let script = arb.script;

	const matches = LINE_WITH_FINAL_ASSIGNMENT_REGEX.exec(script);
	if (matches?.length) {
		const lineToReplace = script.substring(matches.index);
		// Sometimes the first layer variable is wrapped in other functions which will decrypt it
		// like OdP(qv4(dAN(RKt))) instead of just RKt, so we need output the entire chain.
		const innerLayerVarMatches = VARIABLE_CONTAINING_THE_INNER_LAYER_REGEX.exec(lineToReplace);
		const variableContainingTheInnerLayer = innerLayerVarMatches ? innerLayerVarMatches[0] : matches[2];
		script = script.replace(lineToReplace, `console.log(${variableContainingTheInnerLayer}.toString());})();\n`);
		// script = evalWithDom(script);
		if (script) arb = new Arborist(script);
	}
	return arb;
}

export const preprocessors = [extractInnerLayer];
export const postprocessors = [removeDeadNodes.default];