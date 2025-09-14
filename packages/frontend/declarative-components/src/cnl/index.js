/**
 * CNL (Controlled Natural Language) Module for Declarative Components
 * Provides natural language syntax for component definitions
 */

export { CNLGrammar } from './CNLGrammar.js';
export { CNLParser, parseCNL, validateCNL } from './CNLParser.js';
export { CNLTranspiler } from './CNLTranspiler.js';
export { DSLParser, parseDSL, validateDSL } from './DSLParser.js';
export { DSLToCNLConverter } from './DSLToCNLConverter.js';
export { JsonToDSLConverter } from './JsonToDSLConverter.js';
export { JsonToCNLConverter } from './JsonToCNLConverter.js';

// Export async functions for bidirectional conversion
export { cnlToDSL } from './CNLTranspiler.js';
export { dslToCNL } from './DSLToCNLConverter.js';
export { jsonToDSL } from './JsonToDSLConverter.js';
export { jsonToCNL } from './JsonToCNLConverter.js';

/**
 * Convert CNL text to compiled component
 * @param {string} cnlText - The CNL source text
 * @returns {Function} Compiled component function
 */
export async function compileCNL(cnlText) {
  const { cnlToDSL } = await import('./CNLTranspiler.js');
  const { ComponentCompiler } = await import('../compiler/ComponentCompiler.js');
  
  // Convert CNL to DSL
  const dslCode = await cnlToDSL(cnlText);
  
  // Compile DSL to component
  const compiler = new ComponentCompiler();
  return compiler.compile(dslCode);
}

/**
 * Load and compile a CNL file
 * @param {string} filePath - Path to the CNL file
 * @returns {Function} Compiled component function
 */
export async function loadCNLFile(filePath) {
  const fs = await import('fs/promises');
  const cnlText = await fs.readFile(filePath, 'utf-8');
  return compileCNL(cnlText);
}