# Contributing to REstringer

Thank you for your interest in contributing to REstringer! This guide covers everything you need to know about contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Development Setup](#development-setup)
  - [Running Tests](#running-tests)
- [Contribution Process](#contribution-process)
  - [General Guidelines](#general-guidelines)
  - [Code Standards](#code-standards)
  - [Testing Requirements](#testing-requirements)
- [Module Development](#module-development)
  - [Module Architecture](#module-architecture)
  - [Match/Transform Pattern](#matchtransform-pattern)
  - [Performance Requirements](#performance-requirements)
  - [Documentation Standards](#documentation-standards)
- [Processor Development](#processor-development)
  - [Processor Architecture](#processor-architecture)
  - [Development Guidelines](#development-guidelines)
  - [Testing Processors](#testing-processors)
- [Code Quality](#code-quality)
  - [Naming Conventions](#naming-conventions)
  - [Error Handling](#error-handling)
  - [Memory Management](#memory-management)
- [Testing Guidelines](#testing-guidelines)
  - [Test Categories](#test-categories)
  - [Test Organization](#test-organization)
  - [Running Tests](#running-tests-1)
- [Documentation](#documentation)
  - [JSDoc Requirements](#jsdoc-requirements)
  - [README Updates](#readme-updates)
- [Submission Guidelines](#submission-guidelines)
  - [Pull Request Process](#pull-request-process)
  - [Review Checklist](#review-checklist)

---

## Getting Started

### Prerequisites

- **Node.js v18+** (v22+ recommended)
- **npm** (latest stable version)
- **Git** for version control

### Development Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/restringer.git
   cd restringer
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a feature branch:
   ```bash
   git checkout -b feature-name
   ```

### Running Tests

```bash
# Full test suite with sample files
npm test

# Quick test suite (recommended for development)
npm run test:quick

# Watch mode during development (quick tests)
npm run test:quick:watch
```

---

## Contribution Process

### General Guidelines

1. **Follow project conventions** - Maintain consistency with existing code style and patterns
2. **Focus on quality over quantity** - Well-tested, documented improvements are preferred over large changes
3. **Be respectful** - Follow the code of conduct and be considerate in discussions
4. **Start small** - Begin with small improvements to familiarize yourself with the codebase
5. **Ask questions** - Don't hesitate to open an issue for clarification or discussion before starting work
6. **Test thoroughly** - Use the `test:quick` option to validate code while working, but always run the full test suite and add tests for new functionality before proceeding to submit the code

### Code Standards

- **Prefer `const` and `let`** - Avoid using `var` as much as possible
- **Single quotes** - Use single quotes for strings (use backticks if string contains single quotes)
- **2 spaces for indentation** - If file uses tabs, maintain tabs
- **Match existing style** - Always try to match existing style when adding or changing code

### Testing Requirements

- **Add tests for new functionality** - Include both positive (TP) and negative (TN) test cases
- **Maintain test coverage** - Ensure comprehensive coverage for edge cases
- **Run appropriate test suite** - Use `npm run test:quick` during development, `npm test` for full validation
- **Watch for regressions** - Changes to one module could affect other parts of the system

---

## Module Development

### Module Architecture

All modules must follow the **match/transform pattern**:

```javascript
// Match function - identifies target nodes
export function moduleNameMatch(arb, candidateFilter = () => true) {
  const matches = [];
  const candidates = arb.ast[0].typeMap.TargetNodeType
                        .concat(arb.ast[0].typeMap.AnotherTargetNodeType);
  
  for (let i = 0; i < candidates.length; i++) {
    const node = candidates[i];
    if (matchesCriteria(node) && candidateFilter(node)) {
      matches.push(node);
    }
  }
  return matches;
}

// Transform function - modifies matched nodes
export function moduleNameTransform(arb, node) {
  // Apply transformations
  performTransformation(node);
  return arb; // Must explicitly return arb
}

// Main function - orchestrates match and transform
export default function moduleName(arb, candidateFilter = () => true) {
  const matches = moduleNameMatch(arb, candidateFilter);
  
  for (let i = 0; i < matches.length; i++) {
    arb = moduleNameTransform(arb, matches[i]); // Capture returned arb
  }
  return arb;
}
```

### Match/Transform Pattern

- **Separate matching logic** - Create `moduleNameMatch(arb, candidateFilter = () => true)` function
- **Separate transformation logic** - Create `moduleNameTransform(arb, node)` function  
- **Main function orchestration** - Main function calls match, then iterates and transforms
- **Explicit arb returns** - All transform functions must return `arb` explicitly, even though the transformation can be considered a side-effect
- **Capture returned arb** - Main functions must use `arb = transformFunction(arb, node)`

### Performance Requirements

#### Loop Optimization
- **Traditional for loops** - Prefer `for (let i = 0; i < length; i++)` over `for..of` or `for..in` 
- **Use 'i' variable** - Use `i` for iteration variable unless inside nested scope

#### Memory & Allocation Optimization
- **Extract static arrays/sets** - Move static collections outside functions to avoid recreation overhead
- **Array operations** - Use `.concat()` for array concatenation and `.slice()` for array copying
- **Object cloning** - Use spread operators `{ ...obj }` for AST node cloning

### Documentation Standards

#### JSDoc Requirements
- **Comprehensive function docs** - All exported functions need full JSDoc
- **Specific types** - Use `{ASTNode}` and `{ASTNode[]}` instead of generic `{Object}` and `{Array}`
- **Custom object types** - Use `{Object[]}` for arrays of custom objects
- **Parameter documentation** - Document all parameters with types
- **Return value documentation** - Document what functions return
- **Algorithm explanations** - Explain complex algorithms and their purpose

#### Inline Comments
- **NON-TRIVIAL ONLY** - Only add comments that explain complex logic and reason, never obvious statements
- **Algorithm steps** - Break down multi-step processes
- **Safety warnings** - Note any potential issues or limitations
- **Examples** - Include before/after transformation examples where helpful

---

## Processor Development

### Processor Architecture

Processors export **preprocessors** and **postprocessors** arrays:

```javascript
// Processor function - can be written as a single function
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

### Development Guidelines

1. **Follow match/transform pattern** for consistency (optional for processors)
2. **Extract static patterns** for performance  
3. **Add comprehensive tests** (TP/TN cases)
4. **Document obfuscation patterns** in code comments
5. **Use performance optimizations** (typeMap access, efficient loops)

### Testing Processors

#### Test Structure
**NOTE**: Preprocessors and postprocessors must be applied separately—never run preprocessors after postprocessors. Do not combine both arrays in a single `applyIteratively` call, as this would incorrectly apply preprocessors after postprocessors.

```javascript
import assert from 'node:assert';
import {describe, it} from 'node:test';
import {applyIteratively} from 'flast';

describe('Custom Processor Tests', async () => {
  const targetProcessors = await import('./customProcessor.js');
  
  it('TP-1: Should transform basic pattern', () => {
    const code = `/* obfuscated pattern */`;
    const expected = `/* expected result */`;
    
    // Apply preprocessors
    let script = applyIteratively(code, targetProcessors.preprocessors);
    // Apply postprocessors  
    script = applyIteratively(script, targetProcessors.postprocessors);
    
    assert.strictEqual(script, expected);
  });
  
  it('TN-1: Should not transform invalid pattern', () => {
    const code = `/* non-matching pattern */`;
    const originalScript = code;
    
    // Apply preprocessors
    let script = applyIteratively(code, targetProcessors.preprocessors);
    // Apply postprocessors
    script = applyIteratively(script, targetProcessors.postprocessors);
    
    assert.strictEqual(script, originalScript);
  });
});
```

---

## Code Quality

### Naming Conventions

- **Variable naming** - Prefer `n` over `node` for AST node variables
- **Iteration variables** - Use `i` for loop iteration unless already used in nested scope
- **Constants** - Use ALL_CAPS for static constants
- **Function names** - Clear, descriptive names that indicate purpose

### Error Handling

- **Input validation** - Add appropriate null/undefined checks
- **Infinite loop protection** - Implement safeguards for recursive operations
- **Graceful degradation** - Handle edge cases without breaking functionality

### Memory Management

- **Cache management** - Implement appropriate caching strategies
- **Static extractions** - Extract static arrays/sets outside functions
- **Efficient data structures** - Use Sets for large collections, arrays for small ones

---

## Testing Guidelines

### Test Categories

- **TP (True Positive)** - Cases where transformation should occur
- **TN (True Negative)** - Cases where transformation should NOT occur
- **Edge Cases** - Boundary conditions and unusual inputs
- **Different operand types** - Test all relevant AST node types as operands

### Test Organization

- **Clear naming** - Use descriptive test names that explain what's being tested
- **Comprehensive scenarios** - Cover simple cases, complex cases, and edge cases
- **Proper assertions** - Ensure expected results match actual behavior

### Running Tests

- **Full test suite** - Always run complete test suite
- **Review all output** - Changes to one module could affect other parts of the system
- **Watch for regressions** - Ensure no existing functionality is broken

---

## Documentation

### JSDoc Requirements

- **Function documentation** - All exported functions need comprehensive JSDoc
- **Type specifications** - Use specific types like `{ASTNode}` instead of generic `{Object}`
- **Parameter descriptions** - Document all parameters with types and purpose
- **Return documentation** - Clearly describe what functions return
- **Examples** - Include usage examples for complex functions

### README Updates

- **Keep documentation current** - Update relevant READMEs when adding new features
- **Add examples** - Include practical usage examples
- **Link to related documentation** - Reference other relevant docs

---

## Submission Guidelines

### Pull Request Process

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature-name`
3. **Make changes** following the coding standards outlined above
4. **Add comprehensive tests** for new functionality
5. **Update documentation** as needed
6. **Run the full test suite**: `npm test`
7. **Submit a pull request** with a clear description

### Review Checklist

#### For Modules:
- [ ] Follows match/transform pattern
- [ ] Includes comprehensive JSDoc documentation
- [ ] Has static pattern extraction for performance
- [ ] Uses traditional for loops with proper variable naming
- [ ] Includes both TP and TN test cases
- [ ] No obvious or trivial comments
- [ ] Explicit `arb` returns and proper functional flow

#### For Processors:
- [ ] Exports `preprocessors` and `postprocessors` arrays
- [ ] Follows architectural patterns (when applicable)
- [ ] Comprehensive test coverage added
- [ ] JSDoc documentation for all functions  
- [ ] Performance optimizations implemented
- [ ] Integration tests with main pipeline

#### General Requirements:
- [ ] All tests pass without failures
- [ ] No regressions in existing functionality
- [ ] Code follows project style guidelines
- [ ] Documentation is updated appropriately
- [ ] Commit messages are clear and descriptive

### Commit Message Guidelines

- **Focus on changes** - Describe what was changed, improved, or added
- **Be concise** - Keep commit messages focused and descriptive

---

## Getting Help

- 💬 **GitHub Issues** - Ask questions or report issues
- 🐦 **Twitter / X** - Reach out to Ben Baryo [@ctrl__esc](https://twitter.com/ctrl__esc)
- 📖 **Documentation** - Check the [main README](README.md) and [processors guide](src/processors/README.md)

---

## Resources

- 🔍 [Obfuscation Detector](https://github.com/HumanSecurity/obfuscation-detector) - Pattern recognition system
- 🌳 [flAST Documentation](https://github.com/HumanSecurity/flast) - AST manipulation utilities  
- 📖 [Main README](README.md) - Complete project documentation
- 📖 [Processors Guide](src/processors/README.md) - Detailed processor documentation

---

**Made with ❤️ by [HUMAN Security](https://www.HumanSecurity.com/)**
