/**
 * @legion/data-store
 * 
 * Data Store with Incremental N-ary Relational Kernel integration
 * Provides binary relationship storage with live query subscriptions
 */

// Core classes
import { DataStore, createDataStore } from './DataStore.js';
export { DataStore, createDataStore };
export { Store } from './Store.js';
export { Edge } from './Edge.js';
export { Attribute } from './Attribute.js';
export { RelationshipType } from './RelationshipType.js';

// Trie infrastructure
export { TrieNode } from './trie/TrieNode.js';
export { OutTrie } from './trie/OutTrie.js';
export { InTrie } from './trie/InTrie.js';
export { TrieManager } from './trie/TrieManager.js';

// Kernel integration
export { Dispatcher } from './kernel/Dispatcher.js';

// Query system
export { PathStep } from './query/PathStep.js';
export { PathQuery, Variable } from './query/PathQuery.js';
export { GraphSpec, GraphSpecBuilder } from './query/GraphSpecBuilder.js';
export { PredicateProvider } from './query/PredicateProvider.js';
export { ComplexQueryPatterns, createComplexQueryPatterns } from './query/ComplexQueryPatterns.js';

// Subscription system
export { Subscription } from './subscription/Subscription.js';
export { SubscriptionManager } from './subscription/SubscriptionManager.js';

// Client API
export { QueryAPI } from './api/QueryAPI.js';

// Default export
export default {
  DataStore,
  createDataStore
};