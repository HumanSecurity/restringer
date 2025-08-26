# REstringer Module Refactoring Guidelines

This document outlines the comprehensive requirements for refactoring REstringer JavaScript deobfuscator modules.

## 🎯 **Overall Approach**

### Scope & Planning
- **One file at a time** - Usually limit work to a single file, but more is possible if all apply to the same functionality. Ask before applying to other modules
- **Incremental improvement** - Focus on improving the codebase bit by bit
- **Suggest before implementing** - Always propose changes with example code snippets before executing them

### Core Objectives
1. **Fix bugs** - Identify and resolve any bugs or logic errors
2. **Add non-trivial comments** - Explain algorithms, reasoning, and rationale
3. **Performance improvements** - Optimize while staying within current code style
4. **Enhanced test coverage** - Review and improve test suites

## 🏗️ **Code Structure Requirements**

### Match/Transform Pattern
- **Separate matching logic** - Create `moduleNameMatch(arb, candidateFilter)` function
- **Separate transformation logic** - Create `moduleNameTransform(arb, node)` function  
- **Main function orchestration** - Main function calls match, then iterates and transforms

```javascript
// Example structure:
export function moduleNameMatch(arb, candidateFilter = () => true) {
    // Find all matching nodes
    return matchingNodes;
}

export function moduleNameTransform(arb, n) {
    // Transform a single node
    return arb;
}

export default function moduleName(arb, candidateFilter = () => true) {
    const matchingNodes = moduleNameMatch(arb, candidateFilter);
    for (let i = 0; i < matchingNodes.length; i++) {
        arb = moduleNameTransform(arb, matchingNodes[i]);
    }
    return arb;
}
```

### Function Returns & Flow
- **Explicit arb returns** - All transform functions must return `arb` explicitly
- **Capture returned arb** - Main functions must use `arb = transformFunction(arb, node)`
- **Functional style** - Ensure arborist instance is properly threaded through transformations

## ⚡ **Performance Requirements**

### Loop Optimization
- **Traditional for loops** - Prefer `for (let i = 0; i < length; i++)` over `for..of` or `for..in` for performance
- **Use 'i' variable** - Use `i` for iteration variable unless inside another for loop that already has `i`

### Memory & Allocation Optimization
- **Extract static arrays/sets** - Move static collections outside functions to avoid recreation overhead
- **Remove spread operators** - Remove `...(arb.ast[0].typeMap.NodeType || [])` patterns
- **Remove redundant checks** - Remove `|| []` when `arb.ast[0].typeMap` returns empty array for missing keys

```javascript
// ❌ Bad - recreated every call
function someFunction() {
    const types = ['Type1', 'Type2'];
    // ...
}

// ✅ Good - created once
const allowedTypes = ['Type1', 'Type2'];
function someFunction() {
    // ...
}
```

### TypeMap Access Patterns
- **Direct access** - Use `arb.ast[0].typeMap.NodeType` directly instead of spread
- **No unnecessary fallbacks** - Remove `|| []` when not needed

## 📚 **Documentation Standards**

### JSDoc Requirements
- **Comprehensive function docs** - All exported functions need full JSDoc
- **Parameter documentation** - Document all parameters with types
- **Return value documentation** - Document what functions return
- **Algorithm explanations** - Explain complex algorithms and their purpose

### Inline Comments
- **Non-trivial logic** - Comment complex conditions and transformations
- **Algorithm steps** - Break down multi-step processes
- **Safety warnings** - Note any potential issues or limitations
- **Examples** - Include before/after transformation examples where helpful

```javascript
/**
 * Find all logical expressions that can be converted to if statements.
 * 
 * Algorithm:
 * 1. Find expression statements containing logical operations (&& or ||)
 * 2. Extract the rightmost operand as the consequent action
 * 3. Use the left operand(s) as the test condition
 * 
 * @param {Arborist} arb
 * @param {Function} candidateFilter (optional) a filter to apply on the candidates list
 * @return {Array} Array of expression statement nodes with logical expressions
 */
```

## 🧪 **Testing Requirements**

### Test Review Process
- **Assess relevance** - Check if tests are testing what they claim to test
- **Evaluate exhaustiveness** - Identify missing use cases and edge cases
- **Add/modify/remove** - Enhance test coverage as needed

### Test Coverage Standards
- **Positive cases (TP)** - Test various scenarios where transformation should occur
- **Negative cases (TN)** - Test scenarios where transformation should NOT occur
- **Edge cases** - Test boundary conditions and unusual inputs
- **Different operand types** - Test various AST node types as operands

### Test Organization
- **Clear naming** - Use descriptive test names that explain what's being tested
- **Comprehensive scenarios** - Cover simple cases, complex cases, and edge cases
- **Proper assertions** - Ensure expected results match actual behavior

## 🔧 **Testing & Validation**

### Test Execution
- **Full test suite** - Always run complete test suite, never use `grep` or selective testing
- **Review all output** - Changes to one module could affect other parts of the system
- **Watch for regressions** - Ensure no existing functionality is broken

### Static Array Guidelines
- **Small collections** - For arrays with ≤6 elements, prefer arrays over Sets for simplicity
- **Large collections** - For larger collections, consider Sets for O(1) lookup performance
- **Semantic clarity** - Choose the data structure that best represents the intent

## 🚨 **Common Patterns to Fix**

### Performance Anti-patterns
```javascript
// ❌ Bad
const relevantNodes = [...(arb.ast[0].typeMap.NodeType || [])];
const types = ['Type1', 'Type2']; // inside function

// ✅ Good  
const allowedTypes = ['Type1', 'Type2']; // outside function
const relevantNodes = arb.ast[0].typeMap.NodeType;
```

### Structure Anti-patterns
```javascript
// ❌ Bad - everything in one function
function moduleMainFunc(arb) {
    // matching logic mixed with transformation logic
}

// ✅ Good - separated concerns
export function moduleMainFuncMatch(arb) { /* matching */ }
export function moduleMainFuncTransform(arb, node) { /* transformation */ }
export default function moduleMainFunc(arb) { /* orchestration */ }
```

## 📋 **Checklist for Each Module**

### Code Review
- [ ] Identify and fix any bugs
- [ ] Split into match/transform functions
- [ ] Extract static arrays/sets outside functions
- [ ] Use traditional for loops with `i` variable
- [ ] Add comprehensive JSDoc documentation
- [ ] Add non-trivial inline comments
- [ ] Remove spread operators from typeMap access
- [ ] Ensure explicit `arb` returns
- [ ] Use `arb = transform(arb, node)` pattern

### Test Review
- [ ] Review existing tests for relevance and correctness
- [ ] Identify missing test cases
- [ ] Add positive test cases (TP)
- [ ] Add negative test cases (TN)  
- [ ] Add edge case tests
- [ ] Ensure test names are descriptive
- [ ] Verify expected results match actual behavior

### Validation
- [ ] Run full test suite (no grep/filtering)
- [ ] Verify all tests pass
- [ ] Check for no regressions in other modules
- [ ] Confirm performance improvements don't break functionality

## 🎯 **Success Criteria**

A successfully refactored module should:
1. **Function identically** to the original (all tests pass)
2. **Have better structure** (match/transform separation)
3. **Perform better** (optimized loops, static extractions)
4. **Be well documented** (comprehensive JSDoc and comments)
5. **Have comprehensive tests** (positive, negative, edge cases)
6. **Follow established patterns** (consistent with other refactored modules)

---

*This document serves as the authoritative guide for REstringer module refactoring. All work should be measured against these requirements.*