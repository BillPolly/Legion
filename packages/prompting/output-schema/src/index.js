/**
 * @legion/output-schema - Multi-format LLM response specification and processing
 * 
 * This package provides a focused ResponseValidator with dual functionality:
 * 1. Generate format instructions from schema + examples for LLM prompts
 * 2. Parse and validate LLM responses into structured data or actionable errors
 */

// Main exports
export { ResponseValidator } from './ResponseValidator.js';
export { FormatDetector } from './FormatDetector.js';
export { ResponseParser } from './ResponseParser.js';
export { SchemaExtensions } from './SchemaExtensions.js';
export { SchemaAnalyzer } from './SchemaAnalyzer.js';
export { InstructionGenerator } from './InstructionGenerator.js';
export { BaseValidator } from './BaseValidator.js';

// Parser exports
export { JSONParser } from './parsers/JSONParser.js';
export { XMLParser } from './parsers/XMLParser.js';
export { DelimitedParser } from './parsers/DelimitedParser.js';
export { TaggedParser } from './parsers/TaggedParser.js';
export { MarkdownParser } from './parsers/MarkdownParser.js';
export { YAMLParser } from './parsers/YAMLParser.js';

// Default export - the most common use case
export { ResponseValidator as default } from './ResponseValidator.js';