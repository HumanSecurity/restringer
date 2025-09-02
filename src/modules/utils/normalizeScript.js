import {applyIteratively} from 'flast';
import * as normalizeComputed from '../safe/normalizeComputed.js';
import * as normalizeEmptyStatements from '../safe/normalizeEmptyStatements.js';
import * as normalizeRedundantNotOperator from '../unsafe/normalizeRedundantNotOperator.js';

/**
 * Normalizes JavaScript code to improve readability without affecting functionality.
 * This function applies a series of safe transformations that make code more readable
 * while preserving the original behavior. It's designed for preprocessing scripts
 * before deobfuscation or analysis.
 *
 * Applied transformations (in order):
 * 1. normalizeComputed - Converts bracket notation to dot notation where safe (obj['prop'] → obj.prop)
 * 2. normalizeRedundantNotOperator - Simplifies double negations and NOT operations on literals
 * 3. normalizeEmptyStatements - Removes unnecessary empty statements and semicolons
 *
 * Uses flast's applyIteratively to ensure all transformations are applied until no more
 * changes occur, handling cases where one transformation enables another.
 *
 * @param {string} script - JavaScript source code to normalize
 * @return {string} The normalized script with improved readability
 *
 * @example
 * // Input: obj['method'](); !!true; ;;;
 * // Output: obj.method(); true;
 */
export function normalizeScript(script) {
	return applyIteratively(script, [
		normalizeComputed.default,
		normalizeRedundantNotOperator.default,
		normalizeEmptyStatements.default,
	]);
}