/**
 * @legion/gellish - Gellish Controlled Natural Language for Handle-based resources
 * 
 * Provides CNL capabilities for Handle-wrapped resources, allowing natural language
 * assertions and queries while maintaining Handle's synchronous, proxy-based architecture.
 */

// Core Gellish components
import { GellishDictionary } from './GellishDictionary.js';
import { GellishDataSource } from './GellishDataSource.js';
import { GellishHandle, wrapWithGellish } from './GellishHandle.js';
import { GellishSystem } from './GellishSystem.js';
import { EntityRecognizer } from './EntityRecognizer.js';
import { GellishParser } from './GellishParser.js';
import { GellishQueryParser } from './GellishQueryParser.js';
import { GellishGenerator } from './GellishGenerator.js';
import { GellishValidator } from './GellishValidator.js';

export { 
  GellishDictionary, 
  GellishDataSource, 
  GellishHandle, 
  GellishSystem,
  wrapWithGellish, 
  EntityRecognizer,
  GellishParser,
  GellishQueryParser,
  GellishGenerator,
  GellishValidator
};

// Re-export DataSource validation from Handle
export { validateDataSourceInterface } from '@legion/handle';

/**
 * Create a Gellish-enabled Handle from any base Handle
 * This is the primary entry point for most users
 * 
 * @param {Handle} baseHandle - The Handle to enhance with CNL
 * @param {Object} options - Configuration options
 * @returns {GellishHandle} Handle with Gellish CNL capabilities
 */
export function createGellishHandle(baseHandle, options = {}) {
  return new GellishHandle(baseHandle, options);
}

/**
 * Create a Gellish DataSource that wraps any base DataSource
 * Use this when you need to add CNL to a DataSource before creating a Handle
 * 
 * @param {DataSource} baseDataSource - The DataSource to wrap
 * @param {Object} options - Configuration options
 * @returns {GellishDataSource} DataSource with Gellish CNL capabilities
 */
export function createGellishDataSource(baseDataSource, options = {}) {
  return new GellishDataSource(baseDataSource, options);
}

/**
 * Create a complete Gellish system that wraps a DataSource
 * This is the highest-level entry point for most users
 * 
 * @param {DataSource} baseDataSource - The DataSource to wrap
 * @param {Object} options - Configuration options
 * @returns {GellishSystem} Complete Gellish system with CNL interface
 */
export function createGellishSystem(baseDataSource, options = {}) {
  return new GellishSystem(baseDataSource, options);
}