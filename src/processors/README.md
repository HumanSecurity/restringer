# REstringer Processors

Processors are specialized modules that handle obfuscation-specific patterns and anti-debugging mechanisms. They run before (preprocessors) and after (postprocessors) the main deobfuscation process to prepare scripts and clean up results.

## Table of Contents

- [Overview](#overview)
  - [What are Processors?](#what-are-processors)
  - [When are Processors Used?](#when-are-processors-used)  
  - [Processor Architecture](#processor-architecture)
- [Available Processors](#available-processors)
  - [JavaScript Obfuscator](#javascript-obfuscator-obfuscatoriojs)
  - [Augmented Array](#augmented-array-augmentedarrayjs)
  - [Function to Array](#function-to-array-functiontoarrayjs)
  - [Caesar Plus](#caesar-plus-caesarpjs)
- [Processor Mapping](#processor-mapping)
- [Usage Examples](#usage-examples)
  - [Using Individual Processors](#using-individual-processors)
  - [Custom Processor Integration](#custom-processor-integration)
  - [Processor with Custom Filtering](#processor-with-custom-filtering)
- [Creating Custom Processors](#creating-custom-processors)
  - [Basic Processor Template](#basic-processor-template)
  - [Advanced Processor Features](#advanced-processor-features)
- [Performance Best Practices](#performance-best-practices)
  - [Static Pattern Extraction](#static-pattern-extraction)
  - [Efficient Node Traversal](#efficient-node-traversal)
  - [Memory Management](#memory-management)
- [Testing Processors](#testing-processors)
  - [Basic Test Structure](#basic-test-structure)
  - [Test Categories](#test-categories)
- [Debugging Processors](#debugging-processors)
  - [Enable Debug Logging](#enable-debug-logging)
  - [Custom Debug Information](#custom-debug-information)
- [Contributing](#contributing)
- [Resources](#resources)

---

## Overview

### What are Processors?

Processors are **obfuscation-specific handlers** that:
- **Remove anti-debugging traps** that prevent deobfuscation
- **Prepare scripts** for the main deobfuscation pipeline  
- **Apply targeted transformations** for specific obfuscation tools
- **Clean up results** after core deobfuscation is complete

### When are Processors Used?

Processors are **lazily loaded** only when:
1. The [Obfuscation Detector](https://github.com/HumanSecurity/obfuscation-detector) identifies a specific obfuscation type
2. Manual processor selection is specified
3. Custom deobfuscation pipelines are created

### Processor Architecture

Processors export **preprocessors** and **postprocessors** arrays, not a default function:

```javascript
// Main processor function - can be written as a single function
function myProcessorLogic(arb, candidateFilter = () => true) {
  const candidates = arb.ast[0].typeMap.TargetNodeType
                        .concat(arb.ast[0].typeMap.AnotherTargetNodeType);
  
  for (let i = 0; i < candidates.length; i++) {
    const node = candidates[i];
    if (matchesCriteria(node) && candidateFilter(node)) {
      // Apply transformation directly
      performTransformation(node);
    }
  }
  return arb;
}

// Processors export arrays of functions, not a default export
export const preprocessors = [myProcessorLogic];
export const postprocessors = [];
```

**Code Style Note**: While **modules** (in `src/modules/`) often separate their logic into `match` and `transform` functions for better organization and testing, this is a **code style choice, not a requirement**. Processors can implement their logic as single functions or use any internal structure that makes sense for their specific use case.

---

## Available Processors

### JavaScript Obfuscator (`obfuscator.io.js`)

**Purpose**: Handles obfuscation patterns from [JavaScript Obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator) (also available online at [obfuscator.io](https://obfuscator.io/)), particularly anti-debugging mechanisms.

**Anti-Debugging Protection**: JavaScript Obfuscator can inject code that:
- Tests function `toString()` output against regex patterns
- Triggers infinite loops when code modification is detected
- Prevents normal deobfuscation by freezing execution

**How it Works**:
```javascript
// Detects and neutralizes patterns like:
// 'newState' -> triggers anti-debug check
// 'removeCookie' -> triggers protection mechanism

// Before processing:
if (funcTest.toString().match(/function.*\{.*\}/)) {
  while(true) {} // Infinite loop trap
}

// After processing:
// Protection mechanisms replaced with bypass strings
```

**Configuration**:
- **Preprocessor**: Neutralizes anti-debugging, applies augmented array processing
- **Postprocessor**: None

### Augmented Array (`augmentedArray.js`)  

**Purpose**: Resolves array shuffling patterns where arrays are dynamically reordered by IIFE functions.

**Pattern Recognition**: Identifies IIFEs that:
- Take an array and a numeric shift count as arguments
- Perform array manipulation (shift, push operations)
- Are called immediately with literal values

**Example Transformation**:
```javascript
// Before:
const arr = [1, 2, 3, 4, 5];
(function(targetArray, shifts) {
  for (let i = 0; i < shifts; i++) {
    targetArray.push(targetArray.shift());
  }
})(arr, 2);

// After:
const arr = [3, 4, 5, 1, 2]; // Pre-computed result
```

**Advanced Features**:
- Supports both function expressions and arrow functions
- Handles complex shifting logic through VM evaluation
- Prevents infinite loops with self-modifying function detection

**Configuration**:
- **Preprocessor**: Resolves array augmentation patterns
- **Postprocessor**: None

### Function to Array (`functionToArray.js`)

**Purpose**: Wrapper processor that applies the `resolveFunctionToArray` module for function-based array generation patterns.

**Pattern Example**:
```javascript
// Before:
function getArray() { return ['a', 'b', 'c']; }
const data = getArray();
console.log(data[0]); // Complex array access

// After:
function getArray() { return ['a', 'b', 'c']; }
const data = ['a', 'b', 'c']; // Direct array assignment
console.log('a'); // Resolved access
```

**Configuration**:
- **Preprocessor**: Applies function-to-array resolution
- **Postprocessor**: None

### Caesar Plus (`caesarp.js`)

**Purpose**: Handles Caesar cipher-based obfuscation with additional encoding layers.

**Obfuscation Method**: 
- Strings encoded using Caesar cipher variants
- Multiple encoding layers applied
- Decoder functions embedded in the code

**Resources**:
- 📖 [Detailed Analysis](https://www.perimeterx.com/tech-blog/2020/deobfuscating-caesar/) - Complete breakdown of Caesar Plus obfuscation

**Configuration**:
- **Preprocessor**: Unwraps outer obfuscation layer
- **Postprocessor**: Removes dead code and cleanup

---

## Processor Mapping

The relationship between detected obfuscation types and their processors is defined in [`index.js`](index.js):

```javascript
export const processors = {
  'obfuscator.io': await import('./obfuscator.io.js'),
  'augmented_array_replacements': await import('./augmentedArray.js'),
  'function_to_array_replacements': await import('./functionToArray.js'),
  'caesar_plus': await import('./caesarp.js'),
  // ... other mappings
};
```

---

## Usage Examples

### Using Individual Processors

```javascript
import {applyIteratively} from 'flast';
import Arborist from 'arborist';

// Import specific processor
const targetProcessors = await import('./augmentedArray.js');

const code = `
const arr = [1, 2, 3];
(function(a, n) { 
  for(let i = 0; i < n; i++) a.push(a.shift()); 
})(arr, 1);
`;

// Processors export preprocessors and postprocessors arrays
let script = code;
script = applyIteratively(script, targetProcessors.preprocessors);
script = applyIteratively(script, targetProcessors.postprocessors);

console.log(script);
// Output: const arr = [2, 3, 1]; (pre-computed)
```

### Custom Processor Integration

```javascript
import {REstringer} from 'restringer';
import {applyIteratively} from 'flast';

const restringer = new REstringer(code);

// Apply specific processors only
restringer.detectObfuscationType = false;

// Manually apply processors
const obfuscatorIoProcessor = await import('./processors/obfuscator.io.js');

// Apply preprocessors before main deobfuscation
restringer.script = applyIteratively(restringer.script, obfuscatorIoProcessor.preprocessors);

// Run main deobfuscation
restringer.deobfuscate();

// Apply postprocessors after main deobfuscation  
restringer.script = applyIteratively(restringer.script, obfuscatorIoProcessor.postprocessors);
```

### Processor with Custom Filtering

```javascript
import {augmentedArrayMatch, augmentedArrayTransform} from './augmentedArray.js';

function customArrayProcessor(arb) {
  // Only process arrays with more than 5 elements
  const customFilter = (node) => {
    const arrayArg = node.arguments[0];
    return arrayArg.declNode?.init?.elements?.length > 5;
  };
  
  const matches = augmentedArrayMatch(arb, customFilter);
  
  for (let i = 0; i < matches.length; i++) {
    arb = augmentedArrayTransform(arb, matches[i]);
  }
  
  return arb;
}
```

---

## Creating Custom Processors

### Basic Processor Template

```javascript
// Static patterns for performance
const DETECTION_PATTERNS = {
  targetPattern: /your-regex-here/,
  // ... other patterns
};

/**
 * Identifies nodes that match your obfuscation pattern
 */
export function customProcessorMatch(arb, candidateFilter = () => true) {
  const matches = [];
  const candidates = arb.ast[0].typeMap.CallExpression; // or other node type
  
  for (let i = 0; i < candidates.length; i++) {
    const node = candidates[i];
    if (matchesYourPattern(node) && candidateFilter(node)) {
      matches.push(node);
    }
  }
  return matches;
}

/**
 * Transforms a matched node
 */
export function customProcessorTransform(arb, node) {
  // Your transformation logic here
  // Example: replace node with resolved value
  if (canResolve(node)) {
    const resolvedValue = resolveNode(node);
    node.replace(createNewNode(resolvedValue));
  }
  
  return arb;
}

/**
 * Main processor function
 */
export default function customProcessor(arb, candidateFilter = () => true) {
  const matches = customProcessorMatch(arb, candidateFilter);
  
  for (let i = 0; i < matches.length; i++) {
    arb = customProcessorTransform(arb, matches[i]);
  }
  return arb;
}
```

### Advanced Processor Features

```javascript
import {evalInVm, createNewNode} from '../modules/utils/index.js';

export function advancedProcessorTransform(arb, node) {
  // Use VM evaluation for complex expressions  
  const expression = extractExpression(node);
  const result = evalInVm(expression);
  
  if (result !== 'BAD_VALUE') {
    node.replace(result);
  }
  
  // Handle multiple transformation types
  switch (node.type) {
    case 'CallExpression':
      return handleCallExpression(arb, node);
    case 'MemberExpression':
      return handleMemberExpression(arb, node);
    default:
      return arb;
  }
}

function handleCallExpression(arb, node) {
  // Specific handling for call expressions
  const callee = node.callee;
  if (callee.type === 'Identifier' && isDecodingFunction(callee.name)) {
    const args = node.arguments.map(arg => arg.value);
    const decoded = performDecoding(callee.name, args);
    node.replace(createNewNode(decoded));
  }
  return arb;
}
```

---

## Performance Best Practices

### Static Pattern Extraction
```javascript
// ✅ Extract patterns outside functions  
const STATIC_PATTERNS = {
  methodCall: /^(decode|decrypt|transform)$/,
  arrayPattern: /^\[.*\]$/
};

// ❌ Don't create patterns in loops
function badExample(arb) {
  for (let i = 0; i < nodes.length; i++) {
    if (/pattern/.test(nodes[i].value)) { // Recreated each iteration
      // ...
    }
  }
}
```

### Efficient Node Traversal  
```javascript
// ✅ Use typeMap for direct access
const candidates = arb.ast[0].typeMap.CallExpression;

// ❌ Don't traverse entire AST
function badTraversal(arb) {
  traverse(arb.ast, {
    CallExpression(node) { /* inefficient */ }
  });
}
```

### Memory Management
```javascript
// ✅ Traditional for loops for performance
for (let i = 0; i < candidates.length; i++) {
  const node = candidates[i];
  // process node
}

// ✅ Use direct array access patterns
const elements = array.slice(); // Copy array
const combined = array1.concat(array2); // Combine arrays
```

---

## Testing Processors

### Basic Test Structure
```javascript
import {assert} from 'chai';
import {applyProcessors} from 'flast';
import Arborist from 'arborist';

describe('Custom Processor Tests', () => {
  const targetProcessors = await import('./customProcessor.js');
  
  it('TP-1: Should transform basic pattern', () => {
    const code = `/* obfuscated pattern */`;
    const expected = `/* expected result */`;
    
    let arb = new Arborist(code);
    arb = applyProcessors(arb, targetProcessors);
    
    assert.strictEqual(arb.script, expected);
  });
  
  it('TN-1: Should not transform invalid pattern', () => {
    const code = `/* non-matching pattern */`;
    const originalScript = code;
    
    let arb = new Arborist(code);
    arb = applyProcessors(arb, targetProcessors);
    
    assert.strictEqual(arb.script, originalScript);
  });
});
```

### Test Categories
- **TP (True Positive)**: Cases where transformation should occur
- **TN (True Negative)**: Cases where transformation should NOT occur  
- **Edge Cases**: Boundary conditions and error scenarios

---

## Debugging Processors

### Enable Debug Logging
```javascript
import {logger} from 'flast';

// Enable detailed logging
logger.setLogLevelDebug();

// Your processor will now show detailed information about:
// - Nodes being processed
// - Transformations applied  
// - Performance metrics
```

### Custom Debug Information
```javascript
export function debugProcessor(arb, candidateFilter = () => true) {
  const matches = customProcessorMatch(arb, candidateFilter);
  
  console.log(`Found ${matches.length} candidates for processing`);
  
  for (let i = 0; i < matches.length; i++) {
    console.log(`Processing node ${i + 1}:`, matches[i].type);
    arb = customProcessorTransform(arb, matches[i]);
  }
  
  return arb;
}
```

---

## Contributing

For detailed guidelines on contributing to processors, see our [Contributing Guide](../../docs/CONTRIBUTING.md). It covers:

- Processor development guidelines
- Code standards and performance requirements
- Testing requirements and best practices
- Submission process and review checklist

---

## Resources

- 🔍 [Obfuscation Detector](https://github.com/HumanSecurity/obfuscation-detector) - Pattern recognition system
- 🌳 [flAST Documentation](https://github.com/HumanSecurity/flast) - AST manipulation utilities  
- 📖 [Main REstringer README](../../README.md) - Complete project documentation
- 🤝 [Contributing Guide](../../docs/CONTRIBUTING.md) - How to contribute to REstringer