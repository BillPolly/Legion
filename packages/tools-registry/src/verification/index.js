/**
 * Verification Framework - Main export point
 * 
 * Complete tool registry verification and testing framework
 */

// Core components
export { MetadataManager } from './MetadataManager.js';
export { ToolValidator } from './ToolValidator.js';
export { ToolTester } from './ToolTester.js';
export { TestRunner } from './TestRunner.js';
export { ReportGenerator } from './ReportGenerator.js';
export { AutoFixer } from './AutoFixer.js';

// Utilities
export { generateTestDataFromSchema, generateKeywordTestData } from './utils/TestDataGenerator.js';

// Schemas
export * from './schemas/index.js';

// Default export - TestRunner for main usage
import { TestRunner } from './TestRunner.js';
export default TestRunner;