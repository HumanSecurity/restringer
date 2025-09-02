let cache = {};
let relevantScriptHash = null;

/**
 * Gets a per-script cache object that automatically invalidates when the script hash changes.
 * This ensures that cached results from one script don't contaminate processing of another script.
 * The cache is shared across all modules processing the same script but isolated between scripts.
 *
 * Cache invalidation strategy:
 * - When scriptHash changes: cache is cleared and new hash is stored
 * - When same scriptHash: existing cache is returned
 * - Manual flush: clears cache but preserves current scriptHash for next call
 *
 * @param {string} currentScriptHash - Hash identifying the current script being processed
 * @return {Object} Shared cache object for the current script (empty object for new/changed scripts)
 *
 * // Usage patterns:
 * // const cache = getCache(arb.ast[0].scriptHash);
 * // cache[`eval-${generateHash(code)}`] = result;
 */
export function getCache(currentScriptHash) {
	// Input validation - handle null/undefined gracefully
	const scriptHash = currentScriptHash ?? 'no-hash';
	
	// Cache invalidation: clear when script changes
	if (scriptHash !== relevantScriptHash) {
		relevantScriptHash = scriptHash;
		cache = {};
	}
	
	return cache;
}

/**
 * Manually flushes the current cache while preserving the script hash.
 * Useful for clearing memory between processing phases or for testing.
 */
getCache.flush = function() {
	cache = {};
	// Note: relevantScriptHash is intentionally preserved to avoid
	// unnecessary cache misses on the next getCache call with same hash
};