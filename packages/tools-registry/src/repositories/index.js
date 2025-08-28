/**
 * Repository Layer - Clean Architecture Implementation
 * 
 * This module exports repository interfaces and concrete implementations
 * following Clean Architecture principles. The domain/application layers
 * depend only on the interfaces, while concrete implementations handle
 * specific database technologies.
 * 
 * Repository Pattern Benefits:
 * - Clean separation of concerns
 * - Database technology independence
 * - Testable business logic
 * - Consistent data access patterns
 * - Easy to mock for testing
 */

// Repository Interfaces (Domain Layer)
export { IToolRepository } from './interfaces/IToolRepository.js';
export { IModuleRepository } from './interfaces/IModuleRepository.js';
export { IPerspectiveRepository } from './interfaces/IPerspectiveRepository.js';

// MongoDB Implementations (Infrastructure Layer)
export { MongoToolRepository } from './mongodb/MongoToolRepository.js';
export { MongoModuleRepository } from './mongodb/MongoModuleRepository.js';

/**
 * Repository Factory - Provides dependency injection for repositories
 * 
 * This factory allows the application to create repositories without
 * knowing their concrete implementations, supporting the Dependency
 * Inversion Principle.
 */
export class RepositoryFactory {
  constructor(databaseStorage, options = {}) {
    if (!databaseStorage) {
      throw new Error('DatabaseStorage is required for RepositoryFactory');
    }
    
    this.databaseStorage = databaseStorage;
    this.options = options;
  }
  
  /**
   * Create tool repository
   * @returns {IToolRepository} Tool repository instance
   */
  createToolRepository() {
    return new MongoToolRepository(this.databaseStorage, this.options);
  }
  
  /**
   * Create module repository
   * @returns {IModuleRepository} Module repository instance
   */
  createModuleRepository() {
    return new MongoModuleRepository(this.databaseStorage, this.options);
  }
  
  /**
   * Create perspective repository
   * @returns {IPerspectiveRepository} Perspective repository instance
   */
  createPerspectiveRepository() {
    // This would return MongoPerspectiveRepository when implemented
    throw new Error('PerspectiveRepository not yet implemented');
  }
}