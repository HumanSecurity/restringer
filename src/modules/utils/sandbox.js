import pkg from 'isolated-vm';
const {Isolate, Reference} = pkg;

// Security-critical APIs that must be blocked in the sandbox environment
const BLOCKED_APIS = {
	debugger: undefined,
	WebAssembly: undefined,
	fetch: undefined,
	XMLHttpRequest: undefined,
	WebSocket: undefined,
	globalThis: undefined,
	navigator: undefined,
	Navigator: undefined,
};

// Default memory limit for VM instances (in MB)
const DEFAULT_MEMORY_LIMIT = 128;

// Default execution timeout (in milliseconds)
const DEFAULT_TIMEOUT = 1000;

/**
 * Isolated sandbox environment for executing untrusted JavaScript code during deobfuscation.
 * 
 * SECURITY NOTE: This sandbox provides isolation and basic protections but is NOT truly secure.
 * It's better than direct eval() but should not be relied upon for security-critical applications.
 * The isolated-vm library provides process isolation but vulnerabilities may still exist.
 * 
 * This class provides an isolated VM context using the isolated-vm library to evaluate
 * potentially malicious JavaScript with reduced risk to the host environment. The sandbox includes:
 * 
 * Isolation Features:
 * - Separate V8 context isolated from host environment
 * - Blocked access to dangerous APIs (WebAssembly, fetch, WebSocket, etc.)
 * - Memory and execution time limits to prevent resource exhaustion
 * - Deterministic evaluation (Math.random and Date are deleted for consistent results)
 * 
 * Performance Optimizations:
 * - Reusable instances to avoid VM creation overhead
 * - Shared contexts for multiple evaluations
 * - Pre-configured global environment setup
 * 
 * Used extensively by unsafe transformation modules for:
 * - Evaluating binary expressions with literal operands
 * - Resolving member expressions on literal objects/arrays
 * - Execution of prototype method calls
 * - Local function call resolution with context
 */
export class Sandbox {
	/**
	 * Creates a new isolated sandbox environment with security restrictions.
	 * The sandbox is configured with memory limits, execution timeouts, and blocked APIs.
	 */
	constructor() {
		this.replacedItems = {...BLOCKED_APIS};
		this.replacedItemsNames = Object.keys(BLOCKED_APIS);
		this.timeout = DEFAULT_TIMEOUT;

		// Create isolated V8 context with memory limits
		this.vm = new Isolate({memoryLimit: DEFAULT_MEMORY_LIMIT});
		this.context = this.vm.createContextSync();

		// Set up global reference for compatibility
		this.context.global.setSync('global', this.context.global.derefInto());

		// Block dangerous APIs by setting them to undefined in the sandbox
		for (let i = 0; i < this.replacedItemsNames.length; i++) {
			const itemName = this.replacedItemsNames[i];
			this.context.global.setSync(itemName, this.replacedItems[itemName]);
		}
	}

	/**
	 * Executes JavaScript code in the isolated sandbox environment.
	 * 
	 * For deterministic results during deobfuscation, Math.random and Date are deleted
	 * before execution to ensure consistent output across runs. This is critical for
	 * reliable deobfuscation results.
	 * 
	 * @param {string} code - JavaScript code to execute in the sandbox
	 * @return {Reference} A Reference object from isolated-vm containing the execution result
	 * 
	 * @example
	 * // const sandbox = new Sandbox();
	 * // const result = sandbox.run('2 + 3'); // Returns Reference containing 5
	 */
	run(code) {
		// Delete non-deterministic APIs to ensure consistent results across deobfuscation runs
		const script = this.vm.compileScriptSync('delete Math.random; delete Date;\n\n' + code);
		return script.runSync(this.context, {
			timeout: this.timeout,
			reference: true,
		});
	}

	/**
	 * Determines if an object is a VM Reference (from isolated-vm) rather than a native JavaScript value.
	 * This is used to distinguish between successfully evaluated results and objects that need
	 * further processing or conversion.
	 * 
	 * @param {*} obj - Object to check
	 * @return {boolean} True if the object is a VM Reference, false otherwise
	 */
	isReference(obj) {
		return obj != null && Object.getPrototypeOf(obj) === Reference.prototype;
	}
}