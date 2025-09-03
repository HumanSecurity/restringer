// Static regex patterns for flag matching - compiled once for performance
const FLAG_PATTERNS = {
	help: /^(-h|--help)$/,
	clean: /^(-c|--clean)$/,
	quiet: /^(-q|--quiet)$/,
	verbose: /^(-v|--verbose)$/,
	output: /^(-o|--output)$/,
	outputWithValue: /^(-o=|--output=)(.*)$/,
	maxIterations: /^(-m|--max-iterations)$/,
	maxIterationsWithValue: /^(-m=|--max-iterations=)(.*)$/,
};

/**
 * Returns the help text for REstringer command line interface.
 * Provides comprehensive usage information including all available flags,
 * their descriptions, and usage examples.
 * 
 * @return {string} The complete help text formatted for console output
 */
export function printHelp() {
	return `
REstringer - a JavaScript deobfuscator

Usage: restringer input_filename [-h] [-c] [-q | -v] [-m M] [-o [output_filename]]

positional arguments:
	input_filename                  The obfuscated JS file

optional arguments:
  -h, --help                      Show this help message and exit.
  -c, --clean                     Remove dead nodes from script after deobfuscation is complete (unsafe).
  -q, --quiet                     Suppress output to stdout. Output result only to stdout if the -o option is not set.
                                  Does not go with the -v option.
  -m, --max-iterations M          Run at most M iterations
  -v, --verbose                   Show more debug messages while deobfuscating. Does not go with the -q option.
  -o, --output [output_filename]  Write deobfuscated script to output_filename. 
                                  <input_filename>-deob.js is used if no filename is provided.`;
}

/**
 * Parses command line arguments into a structured options object.
 * 
 * This function handles various argument formats including:
 * - Boolean flags: -h, --help, -c, --clean, -q, --quiet, -v, --verbose
 * - Value flags: -o [file], --output [file], -m <num>, --max-iterations <num>
 * - Equal syntax: --output=file, --max-iterations=5, -o=file, -m=5
 * - Space syntax: --output file, --max-iterations 5, -o file, -m 5
 * 
 * Edge cases handled:
 * - Empty arguments array returns default configuration
 * - Missing values for flags that require them (handled gracefully)
 * - Invalid input types (null, undefined) return safe defaults
 * - Parsing errors are caught and return safe defaults
 * - Input filename detection (first non-flag argument)
 * 
 * Performance optimizations:
 * - Pre-compiled regex patterns to avoid repeated compilation
 * - Single-pass parsing instead of multiple regex tests on joined strings
 * - Direct array iteration without string concatenation overhead
 * 
 * @param {string[]} args - Array of command line arguments (typically process.argv.slice(2))
 * @return {Object} Parsed options object with the following structure:
 * @return {string} return.inputFilename - Path to input JavaScript file
 * @return {boolean} return.help - Whether help was requested
 * @return {boolean} return.clean - Whether to remove dead nodes after deobfuscation
 * @return {boolean} return.quiet - Whether to suppress output to stdout
 * @return {boolean} return.verbose - Whether to show debug messages
 * @return {boolean} return.outputToFile - Whether output should be written to file
 * @return {number|boolean|null} return.maxIterations - Maximum iterations (number > 0), false if not set, or null if flag present with invalid value
 * @return {string} return.outputFilename - Output filename (auto-generated or user-specified)
 * 
 * @example
 * // Basic usage
 * parseArgs(['script.js']) 
 * // => { inputFilename: 'script.js', help: false, clean: false, ..., outputFilename: 'script.js-deob.js' }
 * 
 * @example  
 * // With flags
 * parseArgs(['script.js', '-v', '--clean', '-o', 'output.js'])
 * // => { inputFilename: 'script.js', verbose: true, clean: true, outputToFile: true, outputFilename: 'output.js', ... }
 * 
 * @example
 * // Equal syntax
 * parseArgs(['script.js', '--max-iterations=10', '--output=result.js'])
 * // => { inputFilename: 'script.js', maxIterations: 10, outputToFile: true, outputFilename: 'result.js', ... }
 */
export function parseArgs(args) {
	// Input validation - handle edge cases gracefully
	if (!args || !Array.isArray(args)) {
		return createDefaultOptions('');
	}

	try {
		// Extract input filename (first non-flag argument)
		const inputFilename = args.length > 0 && args[0] && !args[0].startsWith('-') ? args[0] : '';
		
		// Initialize options with defaults
		const opts = createDefaultOptions(inputFilename);

		// Single-pass parsing for optimal performance
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			const nextArg = args[i + 1];
			
			// Skip input filename (first non-flag argument)
			if (i === 0 && !arg.startsWith('-')) {
				continue;
			}

			// Parse boolean flags
			if (FLAG_PATTERNS.help.test(arg)) {
				opts.help = true;
			} else if (FLAG_PATTERNS.clean.test(arg)) {
				opts.clean = true;
			} else if (FLAG_PATTERNS.quiet.test(arg)) {
				opts.quiet = true;
			} else if (FLAG_PATTERNS.verbose.test(arg)) {
				opts.verbose = true;
			}
			// Parse output flag with potential value
			else if (FLAG_PATTERNS.output.test(arg)) {
				opts.outputToFile = true;
				// Check if next argument is a value (not another flag)
				if (nextArg && !nextArg.startsWith('-')) {
					opts.outputFilename = nextArg;
					i++; // Skip the next argument since we consumed it
				}
			} else if (FLAG_PATTERNS.outputWithValue.test(arg)) {
				const match = FLAG_PATTERNS.outputWithValue.exec(arg);
				opts.outputToFile = true;
				const value = match[2];
				// Only override default filename if a non-empty value was provided
				if (value && value.length > 0) {
					opts.outputFilename = value;
				}
			}
			// Parse max-iterations flag with potential value
			else if (FLAG_PATTERNS.maxIterations.test(arg)) {
				// Flag is present, but we need to check for a value
				if (nextArg && !nextArg.startsWith('-') && !isNaN(Number(nextArg)) && Number(nextArg) > 0) {
					opts.maxIterations = Number(nextArg);
					i++; // Skip the next argument since we consumed it
				} else {
					// Flag present but no valid positive number - mark as invalid
					opts.maxIterations = null;
				}
			} else if (FLAG_PATTERNS.maxIterationsWithValue.test(arg)) {
				const match = FLAG_PATTERNS.maxIterationsWithValue.exec(arg);
				const value = match[2];
				if (value && !isNaN(Number(value)) && Number(value) > 0) {
					opts.maxIterations = Number(value);
				} else {
					// Invalid or missing value - mark as invalid
					opts.maxIterations = null;
				}
			}
		}

		return opts;
	} catch (error) {
		// Provide meaningful error context instead of silent failure
		console.warn(`Warning: Error parsing arguments, using defaults. Error: ${error.message}`);
		return createDefaultOptions('');
	}
}

/**
 * Creates a default options object with safe fallback values.
 * This helper ensures consistent default behavior and reduces code duplication.
 * 
 * @param {string} inputFilename - The input filename to use for generating output filename
 * @return {Object} Default options object with all required properties
 */
function createDefaultOptions(inputFilename) {
	return {
		inputFilename,
		help: false,
		clean: false,
		quiet: false,
		verbose: false,
		outputToFile: false,
		maxIterations: false,
		outputFilename: inputFilename ? `${inputFilename}-deob.js` : '-deob.js',
	};
}

/**
 * Validates parsed command line arguments and prints appropriate error messages.
 * This function performs comprehensive validation including:
 * - Required argument presence (input filename)
 * - Mutually exclusive flag combinations (quiet vs verbose)
 * - Value validation (max iterations must be positive number)
 * - Help display logic
 * 
 * All error messages are printed to console for user feedback, making debugging
 * command line usage easier.
 * 
 * @param {Object} args - The parsed arguments object returned from parseArgs()
 * @param {string} args.inputFilename - Input file path
 * @param {boolean} args.help - Help flag
 * @param {boolean} args.quiet - Quiet flag  
 * @param {boolean} args.verbose - Verbose flag
 * @param {number|boolean|null} args.maxIterations - Max iterations value, false if not set, or null if invalid
 * @return {boolean} true if all arguments are valid and execution should proceed, false otherwise
 * 
 * @example
 * // Valid arguments
 * argsAreValid({ inputFilename: 'script.js', help: false, quiet: false, verbose: true, maxIterations: 10 })
 * // => true
 * 
 * @example  
 * // Invalid - missing input file
 * argsAreValid({ inputFilename: '', help: false, quiet: false, verbose: false, maxIterations: false })
 * // => false (prints error message)
 */
export function argsAreValid(args) {
	// Handle undefined/null args gracefully
	if (!args || typeof args !== 'object') {
		console.log('Error: Invalid arguments provided');
		return false;
	}

	// Help request - always print and return false to exit
	if (args.help) {
		console.log(printHelp());
		return false;
	}
	
	// Required argument validation
	if (!args.inputFilename || args.inputFilename.length === 0) {
		console.log('Error: Input filename must be provided');
		return false;
	}
	
	// Mutually exclusive flags validation
	if (args.verbose && args.quiet) {
		console.log('Error: Don\'t set both -q and -v at the same time *smh*');
		return false;
	}
	
	// Max iterations validation - check for null (invalid flag usage) 
	if (args.maxIterations === null) {
		console.log('Error: --max-iterations requires a number larger than 0 (e.g. --max-iterations 12)');
		return false;
	}
	
	// All validations passed
	return true;
}