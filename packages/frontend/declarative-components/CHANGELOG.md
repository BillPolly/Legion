# Changelog

## [1.0.1] - 2025-09-13

### Fixed
- **Array Indexing Support**: Fixed property binding to support array indexing syntax (e.g., `todos.items[0].title`)
  - Updated ComponentCompiler to allow square brackets in simple property bindings
  - Added parsePropertyPath() method to DataStoreAdapter for proper path parsing
  - Enhanced getProperty() and setProperty() to handle array access correctly

- **Entity Data Initialization**: Fixed ComponentLifecycle to properly structure initial data
  - Now automatically wraps initial data with entity name as top-level key
  - Ensures compatibility between test data and DSL entity expectations

- **DataStoreAdapter Simple Mode**: Updated all tests to work correctly with simpleMode
  - Fixed schema format expectations
  - Updated entity access patterns
  - Corrected cache behavior expectations

### Added
- Documentation for array indexing support in README
- Comprehensive test coverage (498 tests passing)

### Technical Details
- ComponentCompiler.js: Modified parseBinding() regex to exclude `[]` from complex expression detection
- DataStoreAdapter.js: Added parsePropertyPath() to handle `entity.array[index].property` patterns
- ComponentLifecycle.js: Added auto-wrapping of initial data with entity name