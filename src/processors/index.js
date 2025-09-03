/**
 * Mapping specific obfuscation type to their processors, which are lazily loaded.
 */
export const processors = {
	'caesar_plus': await import('./caesarp.js'),
	'obfuscator.io': await import('./obfuscator.io.js'),
	'augmented_array_replacements': await import('./augmentedArray.js'),
	'function_to_array_replacements': await import('./functionToArray.js'),
	'proxied_augmented_array_replacements': await import('./augmentedArray.js'),
	'augmented_array_function_replacements': await import('./augmentedArray.js'),
	'augmented_proxied_array_function_replacements': await import('./augmentedArray.js'),
};
