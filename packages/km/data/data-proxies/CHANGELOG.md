# Changelog

All notable changes to @legion/data-proxies will be documented in this file.

## [1.0.0] - 2025-01-12

### Major Refactoring - Handle Base Class Integration

#### Added
- **Handle Base Class Integration**: All proxy classes now extend `Handle` from `@legion/km-data-handle`
- **Actor System Capabilities**: All proxies now support `receive()`, `call()`, `query()` methods from Actor base class
- **DataStoreResourceManager**: New adapter bridging DataStore to ResourceManager interface for Handle integration
- **Cross-Proxy Integration Tests**: Comprehensive test suite verifying different proxy types work together seamlessly
- **Comprehensive Documentation**: Complete README and JSDoc documentation for new architecture

#### Enhanced
- **EntityProxy**: Now extends Handle with Actor system integration while maintaining all entity access capabilities
- **CollectionProxy**: Now extends Handle with proper entity proxy caching and bulk operations
- **StreamProxy**: Now extends Handle with query result streaming and filtering capabilities  
- **DataStoreProxy**: Updated factory to work with Handle-based proxy classes
- **Memory Management**: Improved subscription cleanup and cascading destruction across all proxy types
- **Error Handling**: Consistent "Handle has been destroyed" error handling across all proxy classes

#### Technical Changes
- **Synchronous Resource Manager**: All ResourceManager operations are synchronous to eliminate race conditions
- **Uniform Interface**: All proxy classes follow the same Handle-based lifecycle and error patterns
- **Backward Compatibility**: Maintained existing API surface while adding Handle capabilities
- **Performance Optimized**: Enhanced memory management with proper cleanup and subscription tracking

#### Testing
- **95 Tests Passing**: All core proxy functionality tests passing (4/4 test suites)
- **Cross-Proxy Integration**: Tests verifying EntityProxy, CollectionProxy, and StreamProxy work together
- **Actor System Integration**: Tests validating Handle inheritance and Actor capabilities
- **Memory Management**: Tests ensuring proper subscription cleanup and cascading destruction

### Architecture Benefits

1. **Universal Base Functionality**: All proxies share Handle's Actor capabilities
2. **Consistent Interface**: All proxies follow the same lifecycle and error patterns  
3. **Actor Integration**: Seamless integration with Legion's actor-based architecture
4. **Memory Safety**: Proper resource cleanup and subscription management
5. **Cross-Proxy Compatibility**: Different proxy types work together harmoniously
6. **Synchronous Dispatch**: Eliminates race conditions in reactive scenarios

### Breaking Changes
- None - Full backward compatibility maintained

### Dependencies
- Added: `@legion/km-data-handle` as core dependency
- Maintained: `@legion/data-store` and `@legion/datascript` as peer dependencies

### Migration Guide
No migration required - all existing code continues to work unchanged while gaining new Actor system capabilities.

```javascript
// Existing code continues to work
const proxy = new EntityProxy(resourceManager, entityId);
const data = proxy.value();

// New Actor capabilities now available
const result = await proxy.call('remoteMethod', params);
const response = await proxy.receive(message);
```