import crypto from 'node:crypto';

/**
 * Generates a fast MD5 hash of the input string for cache key generation and deduplication.
 * MD5 is chosen over SHA algorithms for performance in non-security contexts like caching.
 * Used across the codebase to create unique identifiers for parsed code strings and AST node source.
 *
 * @param {string|ASTNode} input - The string to hash, or AST node with .src property
 * @return {string} A 32-character hexadecimal MD5 hash, or fallback hash for invalid inputs
 *
 * // Usage examples:
 * // Cache key: `eval-${generateHash(codeString)}`
 * // Deduplication: `context-${generateHash(node.src)}`
 */
export function generateHash(input) {
	try {
		// Input validation and normalization
		let stringToHash;
		
		if (input === null || input === undefined) {
			return 'null-undefined-hash';
		}
		
		// Handle AST nodes with .src property
		if (typeof input === 'object' && input.src !== undefined) {
			stringToHash = String(input.src);
		} else {
			// Convert to string (handles numbers, booleans, etc.)
			stringToHash = String(input);
		}
		
		// Generate MD5 hash for fast cache key generation
		return crypto.createHash('md5').update(stringToHash).digest('hex');
		
	} catch (error) {
		// Fallback hash generation if crypto operations fail
		// Simple string-based hash as last resort
		const str = String(input?.src ?? input ?? 'error');
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
		}
		return `fallback-${Math.abs(hash).toString(16)}`;
	}
}