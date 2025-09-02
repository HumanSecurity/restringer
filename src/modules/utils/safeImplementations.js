/**
 * Safe implementations of browser-native functions for Node.js environments.
 * These provide Node.js-compatible versions of functions that are available
 * in browsers but not in Node.js, using Buffer API for encoding operations.
 *
 * Used by resolveBuiltinCalls to safely execute encoding/decoding operations
 * during deobfuscation without relying on browser-specific globals.
 */
export const atob = (await import('./safe-atob.js')).atob;
export const btoa = (await import('./safe-btoa.js')).btoa;