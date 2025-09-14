/**
 * Component Compiler - Main entry point for DSL compilation
 * Uses proper tokenizer, parser, and code generator architecture
 */

import { Parser } from './Parser.js';
import { CodeGenerator } from './CodeGenerator.js';

export class ComponentCompiler {
  constructor() {
    this.parser = null;
    this.generator = new CodeGenerator();
  }

  /**
   * Compile DSL string into a mountable component
   * @param {string} dsl - DSL source code
   * @returns {Object} Mountable component
   */
  compile(dsl) {
    if (!dsl || typeof dsl !== 'string') {
      throw new Error('DSL must be a non-empty string');
    }

    try {
      // Parse DSL into AST
      this.parser = new Parser(dsl);
      const ast = this.parser.parse();
      
      // Generate component from AST
      const component = this.generator.generate(ast);
      
      return component;
    } catch (error) {
      throw new Error(`Compilation failed: ${error.message}`);
    }
  }

  /**
   * Parse DSL without generating code (for testing)
   * @param {string} dsl - DSL source code
   * @returns {Object} Abstract syntax tree
   */
  parseOnly(dsl) {
    if (!dsl || typeof dsl !== 'string') {
      throw new Error('DSL must be a non-empty string');
    }

    try {
      this.parser = new Parser(dsl);
      return this.parser.parse();
    } catch (error) {
      throw new Error(`Parse failed: ${error.message}`);
    }
  }
}