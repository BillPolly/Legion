# Decent Planner Test Status

## Summary
- **Total Test Suites**: 9
- **Passing**: 5 suites (81 tests)
- **Failing**: 3 suites (13 tests)
- **Skipped**: 1 suite (11 tests - require LIVE_TESTS=true)

## Unit Tests ✅ ALL PASSING

### PlanSynthesizer.test.js ✅
- 18 tests passing
- Tests bottom-up synthesis and validation
- Properly uses mocks for all dependencies

### ToolDiscoveryBridge.test.js ✅
- 13 tests passing
- Tests semantic tool discovery integration
- Properly mocks SemanticToolSearch initialization

### ValidatedSubtree.test.js ✅
- 15 tests passing
- Tests behavior tree encapsulation and I/O contracts
- Tests composition strategies (sequence/parallel)

### TaskDecomposer.test.js ✅
- 18 tests passing
- Tests LLM-based task decomposition
- Tests complexity classification

### ContextHints.test.js ✅
- 17 tests passing
- Tests context hint management
- Tests sibling output tracking

## Integration Tests ⚠️ NEED FIXES

### DecentPlanner.test.js ❌
- 6 tests failing
- Issue: Uses `resourceManager.register()` instead of `resourceManager.set()`
- Quick fix: Replace all `register` calls with `set`

### LiveDecomposition.test.js ⏭️ SKIPPED
- 11 tests skipped (only run with LIVE_TESTS=true)
- Uses real Anthropic API for testing
- Tests actual LLM decomposition quality

### SimpleDecomposition.test.js ❌
- 1 test failing
- Issue: Likely JSON parsing issue with Anthropic response
- Needs debugging of actual LLM response format

## E2E Tests ⚠️ NEED FIXES

### FileSystemTasks.test.js ❌
- 6 tests failing
- Issue: Missing `toolRegistryProvider` in ResourceManager
- Quick fix: Add mock toolRegistryProvider to ResourceManager setup

## Key Architectural Decisions

1. **Reusing Legion's existing validation**: The tests properly use BTValidator and PlanValidator from @legion/bt-validator instead of reimplementing validation logic.

2. **ResourceManager pattern**: All API keys and dependencies are accessed through ResourceManager.get('env.KEY_NAME'), following Legion's patterns.

3. **Mock-first testing**: Unit tests use comprehensive mocks, integration tests can use either mocks or real services, E2E tests use real tools with mock LLM.

4. **Bottom-up synthesis**: Tests validate that PlanSynthesizer properly builds behavior trees from leaves to root with I/O contract validation.

## Next Steps

1. Fix the 3 failing test suites (simple find/replace fixes)
2. Run LIVE_TESTS=true for integration tests with real Anthropic API
3. Add performance tests for hierarchical decomposition
4. Consider adding more edge case tests for error handling

## Commands

```bash
# Run all tests
NODE_OPTIONS='--experimental-vm-modules' npx jest

# Run unit tests only
NODE_OPTIONS='--experimental-vm-modules' npx jest __tests__/unit

# Run integration tests with live LLM
LIVE_TESTS=true NODE_OPTIONS='--experimental-vm-modules' npx jest __tests__/integration

# Run E2E tests
NODE_OPTIONS='--experimental-vm-modules' npx jest __tests__/e2e

# Run with coverage
NODE_OPTIONS='--experimental-vm-modules' npx jest --coverage
```