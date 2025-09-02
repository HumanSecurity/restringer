// Arguments that shouldn't be touched since the context may not be inferred during deobfuscation.
const badArgumentTypes = ['ThisExpression'];

// A string that tests true for this regex cannot be used as a variable name.
const badIdentifierCharsRegex = /([:!@#%^&*(){}[\]\\|/`'"]|[^\da-zA-Z_$])/;

// Internal value used to indicate eval failed
const badValue = '--BAD-VAL--';

// Do not repeate more than this many iterations.
// Behaves like a number, but decrements each time it's used.
// Use defaultMaxIterations.value = 300 to set a new value.
const defaultMaxIterations = {
	value: 500,
	valueOf() {return this.value--;},
};

const propertiesThatModifyContent = [
	'push', 'forEach', 'pop', 'insert', 'add', 'set', 'delete', 'shift', 'unshift', 'splice'
];

// Builtin functions that shouldn't be resolved in the deobfuscation context.
const skipBuiltinFunctions = [
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
	'getMilliseconds', ...propertiesThatModifyContent,
];

// A regex for a valid identifier name.
const validIdentifierBeginning = /^[A-Za-z$_]/;

export {
	badArgumentTypes,
	badIdentifierCharsRegex,
	badValue,
	defaultMaxIterations,
	propertiesThatModifyContent,
	skipBuiltinFunctions,
	SKIP_IDENTIFIERS,
	SKIP_PROPERTIES,
	validIdentifierBeginning,
};