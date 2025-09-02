/**
 * Safe implementation of btoa (Binary to ASCII) for Node.js environments.
 * Encodes an ASCII string to its Base64 representation.
 * This provides browser-compatible btoa functionality using Node.js Buffer API.
 *
 * Used during deobfuscation to safely resolve string-to-Base64 operations without
 * relying on browser-specific global functions that may not be available in Node.js.
 *
 * @param {string} val - ASCII string to encode
 * @return {string} The Base64-encoded string
 *
 * @example
 * // btoa('Hello World') => 'SGVsbG8gV29ybGQ='
 * // btoa('abc123') => 'YWJjMTIz'
 */
export function btoa(val) {
	return Buffer.from(val).toString('base64');
}