/**
 * Core storage interfaces for Knowledge Graph
 * This package defines the base interfaces that all storage implementations must follow
 */

// Core interfaces and base classes
export { ITripleStore, ITransaction } from './ITripleStore.js';

// Error classes
export { 
  StorageError, 
  ConnectionError, 
  TransactionError, 
  ValidationError, 
  CapacityError, 
  AuthenticationError, 
  NetworkError,
  isRetryableError 
} from './StorageError.js';