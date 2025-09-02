/**
 * Safe implementation of atob (ASCII to Binary) for Node.js environments.
 * Decodes a Base64-encoded string back to its original ASCII representation.
 * This provides browser-compatible atob functionality using Node.js Buffer API.
 *
 * Used during deobfuscation to safely resolve Base64-encoded strings without
 * relying on browser-specific global functions that may not be available in Node.js.
 *
 * @param {string} val - Base64-encoded string to decode
 * @return {string} The decoded ASCII string
 *
 * @example
 * // atob('SGVsbG8gV29ybGQ=') => 'Hello World'
 * // atob('YWJjMTIz') => 'abc123'
 */
export function atob(val) {
	return Buffer.from(val, 'base64').toString();
}