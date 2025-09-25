/**
 * @fileoverview Data Proxies Package - Main Entry Point
 * 
 * This package provides data proxy classes that extend Handle from @legion/km-data-handle,
 * enabling universal Actor system integration while providing convenient interfaces for
 * working with DataStore data.
 * 
 * ## Architecture Overview
 * 
 * All proxy classes extend the Handle base class, providing:
 * - Actor System Integration: receive(), call(), query() methods
 * - Resource Manager Pattern: Synchronous data access through ResourceManager interface  
 * - Lifecycle Management: Proper subscription cleanup and cascading destruction
 * - Error Handling: Consistent "Handle has been destroyed" error handling
 * 
 * ## Key Classes
 * 
 * - **EntityProxy**: Individual entity access with direct property manipulation
 * - **CollectionProxy**: Collection operations with iteration, filtering, and bulk updates
 * - **StreamProxy**: Continuous query result streaming with filtering and subscriptions
 * - **DataStoreProxy**: Factory for creating and managing different proxy types
 * - **DataStoreResourceManager**: Adapter bridging DataStore to ResourceManager interface
 * 
 * ## Cross-Proxy Integration
 * 
 * Different proxy types work together seamlessly - changes made through one proxy type
 * are automatically reflected in other proxy instances viewing the same data.
 * 
 * @example
 * ```javascript
 * import { 
 *   EntityProxy, 
 *   CollectionProxy, 
 *   StreamProxy,
 *   DataStoreProxy,
 *   DataStoreResourceManager 
 * } from '@legion/data-proxies';
 * 
 * // Create resource manager
 * const store = createDataStore(schema);
 * const resourceManager = new DataStoreResourceManager(store);
 * 
 * // Create proxies
 * const entityProxy = new EntityProxy(resourceManager, entityId);
 * const collectionProxy = new CollectionProxy(resourceManager, querySpec);
 * const streamProxy = new StreamProxy(resourceManager, querySpec);
 * 
 * // Or use factory
 * const dataStoreProxy = new DataStoreProxy(store);
 * const entity = dataStoreProxy.entity(entityId);
 * ```
 * 
 * @version 1.0.0
 * @author Legion Framework
 * @since 1.0.0
 */

import { DataStore } from '@legion/data-store';
import { initializeDataStoreHandler } from './DataStoreHandler.js';

// Initialize DataStore with subscription interface
initializeDataStoreHandler(DataStore);

// ============================================================================
// CORE EXPORTS
// ============================================================================

/**
 * Enhanced DataStore with subscription interface
 * @see {@link module:@legion/data-store}
 */
export { DataStore };

/**
 * Factory proxy for creating and managing different proxy types
 * @see {@link DataStoreProxy}
 */
export { DataStoreProxy } from './DataStoreProxy.js';

/**
 * Proxy wrapper for individual entities with direct property access
 * @see {@link EntityProxy}
 */
export { EntityProxy } from './EntityProxy.js';

/**
 * Dynamic proxy wrapper for entities with schema-aware property access
 * @see {@link DynamicEntityProxy}
 */
export { DynamicEntityProxy, createDynamicEntityProxy } from './DynamicEntityProxy.js';

/**
 * Proxy wrapper for collections of entities with iteration and filtering
 * @see {@link CollectionProxy}
 */
export { CollectionProxy } from './CollectionProxy.js';

/**
 * Proxy wrapper for continuous query result streaming
 * @see {@link StreamProxy}
 */
export { StreamProxy } from './StreamProxy.js';

// ============================================================================
// RESOURCE MANAGEMENT
// ============================================================================

/**
 * ResourceManager adapter that bridges DataStore to Handle interface
 * @see {@link DataStoreResourceManager}
 */
export { DataStoreResourceManager } from './DataStoreResourceManager.js';

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Utility for detecting appropriate proxy types for different data patterns
 * @see {@link ProxyTypeDetector}
 */
export { ProxyTypeDetector } from './ProxyTypeDetector.js';

/**
 * DataStore handler utilities for subscription interface enhancement
 * @see {@link initializeDataStoreHandler}
 * @see {@link addSubscriptionInterface}
 * @see {@link createSubscription}
 */
export { initializeDataStoreHandler, addSubscriptionInterface, createSubscription } from './DataStoreHandler.js';

/**
 * DataStore factory function
 * @see {@link module:@legion/data-store.createDataStore}
 */
export { createDataStore } from '@legion/data-store';