// Arguments that shouldn't be touched since the context may not be inferred during deobfuscation.
const BAD_ARGUMENT_TYPES = ['ThisExpression'];

// A string that tests true for this regex cannot be used as a variable name.
const BAD_IDENTIFIER_CHARS_REGEX = /([:!@#%^&*(){}[\]\\|/`'"]|[^\da-zA-Z_$])/;

// Internal value used to indicate eval failed
const BAD_VALUE = '--BAD-VAL--';

// Do not repeate more than this many iterations.
// Behaves like a number, but decrements each time it's used.
// Use DEFAULT_MAX_ITERATIONS.value = 300 to set a new value.
const DEFAULT_MAX_ITERATIONS = {
	value: 500,
	valueOf() {return this.value--;},
};

const PROPERTIES_THAT_MODIFY_CONTENT = [
	'push', 'forEach', 'pop', 'insert', 'add', 'set', 'delete', 'shift', 'unshift', 'splice',
	'sort', 'reverse', 'fill', 'copyWithin'
];

// Builtin functions that shouldn't be resolved in the deobfuscation context.
const SKIP_BUILTIN_FUNCTIONS = [
	'Function', 'eval', 'Array', 'Object', 'fetch', 'XMLHttpRequest', 'Promise', 'console', 'performance', '$',
];

// Identifiers that shouldn't be touched since they're either session-based or resolve inconsisstently.
const SKIP_IDENTIFIERS = [
	'window', 'this', 'self', 'document', 'module', '$', 'jQuery', 'navigator', 'typeof', 'new', 'Date', 'Math',
	'Promise', 'Error', 'fetch', 'XMLHttpRequest', 'performance', 'globalThis',
];

// Properties that shouldn't be resolved since they're either based on context which can't be determined or resolve inconsistently.
const SKIP_PROPERTIES = [
	'test', 'exec', 'match', 'length', 'freeze', 'call', 'apply', 'create', 'getTime', 'now',
	'getMilliseconds', ...PROPERTIES_THAT_MODIFY_CONTENT,
];

// A regex for a valid identifier name.
const VALID_IDENTIFIER_BEGINNING = /^[A-Za-z$_]/;

export {
	BAD_ARGUMENT_TYPES,
	BAD_IDENTIFIER_CHARS_REGEX,
	BAD_VALUE,
	DEFAULT_MAX_ITERATIONS,
	PROPERTIES_THAT_MODIFY_CONTENT,
	SKIP_BUILTIN_FUNCTIONS,
	SKIP_IDENTIFIERS,
	SKIP_PROPERTIES,
	VALID_IDENTIFIER_BEGINNING,
};