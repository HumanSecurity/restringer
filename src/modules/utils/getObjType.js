/**
 * Determines the precise type of any JavaScript value using Object.prototype.toString.
 * This function provides more accurate type detection than typeof, distinguishing between
 * different object types like Array, Date, RegExp, etc.
 *
 * Uses the standard JavaScript pattern of calling Object.prototype.toString on the value
 * and extracting the type name from the result string "[object TypeName]".
 *
 * @param {*} unknownObject - Any JavaScript value to analyze
 * @return {string} The precise type name (e.g., 'Array', 'Date', 'RegExp', 'Null', 'Undefined')
 *
 * @example
 * // getObjType([1, 2, 3]) => 'Array'
 * // getObjType(new Date()) => 'Date'
 * // getObjType(/regex/) => 'RegExp'
 * // getObjType(null) => 'Null'
 * // getObjType(undefined) => 'Undefined'
 * // getObjType('string') => 'String'
 * // getObjType(42) => 'Number'
 * // getObjType({}) => 'Object'
 * // getObjType(function() {}) => 'Function'
 */
export function getObjType(unknownObject) {
	return ({}).toString.call(unknownObject).slice(8, -1);
}