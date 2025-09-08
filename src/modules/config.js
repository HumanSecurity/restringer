// Internal value used to indicate eval failed
export const BAD_VALUE = '--BAD-VAL--';

// Do not repeate more than this many iterations.
// Behaves like a number, but decrements each time it's used.
// Use DEFAULT_MAX_ITERATIONS.value = 300 to set a new value.
export const DEFAULT_MAX_ITERATIONS = {
	value: 500,
	valueOf() {return this.value--;},
};

export const PROPERTIES_THAT_MODIFY_CONTENT = [
	'push', 'forEach', 'pop', 'insert', 'add', 'set', 'delete', 'shift', 'unshift', 'splice',
	'sort', 'reverse', 'fill', 'copyWithin'
];

// Identifiers that shouldn't be touched since they're either session-based or resolve inconsisstently.
export const SKIP_IDENTIFIERS = [
	'window', 'this', 'self', 'document', 'module', '$', 'jQuery', 'navigator', 'typeof', 'new', 'Date', 'Math',
	'Promise', 'Error', 'fetch', 'XMLHttpRequest', 'performance', 'globalThis',
];

// Properties that shouldn't be resolved since they're either based on context which can't be determined or resolve inconsistently.
export const SKIP_PROPERTIES = [
	'test', 'exec', 'match', 'length', 'freeze', 'call', 'apply', 'create', 'getTime', 'now',
	'getMilliseconds', ...PROPERTIES_THAT_MODIFY_CONTENT,
];