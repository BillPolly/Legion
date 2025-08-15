/**
 * ValidateJavaScriptSyntaxTool - Validate JavaScript code syntax
 */

import { Tool } from '@legion/tools-registry';
import { z } from 'zod';

export class ValidateJavaScriptSyntaxTool extends Tool {
  constructor() {
    super({
      name: 'validate_javascript_syntax',
      description: 'Validate JavaScript code syntax using Function constructor'
    });
    this.inputSchema = z.object({
        code: z.string().describe('JavaScript code to validate'),
        strict: z.boolean().default(true).describe('Use strict mode validation')
      });
    this.outputSchema = z.object({
        valid: z.boolean().describe('Whether the code is syntactically valid'),
        error: z.string().optional().describe('Syntax error message if invalid'),
        line: z.number().optional().describe('Line number of error if available'),
        column: z.number().optional().describe('Column number of error if available')
      });
  }

  async execute(args) {
    try {
      this.emit('progress', { percentage: 20, status: 'Preparing code validation...' });

      const { code, strict = true } = args;

      if (!code || typeof code !== 'string') {
        return {
          valid: false,
          error: 'Code must be a non-empty string'
        };
      }

      this.emit('progress', { percentage: 50, status: 'Validating syntax...' });

      // Prepare code for validation
      let validationCode = code;
      if (strict) {
        validationCode = `"use strict";\n${code}`;
      }

      try {
        // Use Function constructor to validate syntax
        // This is safer than eval() and only checks syntax
        new Function(validationCode);

        this.emit('progress', { percentage: 100, status: 'Validation complete' });

        return {
          valid: true
        };

      } catch (syntaxError) {
        this.emit('progress', { percentage: 100, status: 'Validation complete with errors' });

        // Parse error details
        const errorDetails = this._parseError(syntaxError, code);

        return {
          valid: false,
          error: syntaxError.message,
          ...errorDetails
        };
      }

    } catch (error) {
      this.emit('error', { message: error.message });
      throw error;
    }
  }

  _parseError(syntaxError, originalCode) {
    const details = {};
    
    // Try to extract line and column information from the error message
    const lineMatch = syntaxError.message.match(/line (\d+)/i);
    const columnMatch = syntaxError.message.match(/column (\d+)/i);
    
    if (lineMatch) {
      details.line = parseInt(lineMatch[1], 10);
      // Adjust for "use strict" line if it was added
      if (details.line > 1) {
        details.line -= 1;
      }
    }
    
    if (columnMatch) {
      details.column = parseInt(columnMatch[1], 10);
    }

    // Try alternative parsing for different JavaScript engines
    if (!details.line) {
      // Look for patterns like "at line 5" or "on line 3"
      const altLineMatch = syntaxError.message.match(/(?:at|on) line (\d+)/i);
      if (altLineMatch) {
        details.line = parseInt(altLineMatch[1], 10);
        if (details.line > 1) {
          details.line -= 1;
        }
      }
    }

    // Provide additional context if we found line information
    if (details.line) {
      const lines = originalCode.split('\n');
      if (details.line <= lines.length) {
        details.contextLine = lines[details.line - 1];
      }
    }

    return details;
  }

  /**
   * Additional method to validate specific JavaScript constructs
   */
  async validateSpecificSyntax(code, options = {}) {
    const results = {
      overall: await this.execute({ code, strict: options.strict }),
      checks: {}
    };

    // Check for common syntax patterns
    if (options.checkArrowFunctions !== false) {
      results.checks.arrowFunctions = this._checkArrowFunctions(code);
    }

    if (options.checkAsyncAwait !== false) {
      results.checks.asyncAwait = this._checkAsyncAwait(code);
    }

    if (options.checkModules !== false) {
      results.checks.modules = this._checkModuleSyntax(code);
    }

    if (options.checkClasses !== false) {
      results.checks.classes = this._checkClassSyntax(code);
    }

    return results;
  }

  _checkArrowFunctions(code) {
    try {
      const arrowPattern = /=>\s*[\{\(]/;
      const hasArrowFunctions = arrowPattern.test(code);
      
      if (hasArrowFunctions) {
        // Try to validate arrow function syntax specifically
        const testCode = `const test = ${code.match(/.*=>.*/)?.[0] || '() => {}'};`;
        new Function(testCode);
      }
      
      return {
        valid: true,
        hasArrowFunctions,
        details: hasArrowFunctions ? 'Arrow functions detected and valid' : 'No arrow functions found'
      };
    } catch (error) {
      return {
        valid: false,
        hasArrowFunctions: true,
        error: error.message
      };
    }
  }

  _checkAsyncAwait(code) {
    try {
      const asyncPattern = /async\s+function|async\s*\(/;
      const awaitPattern = /await\s+/;
      const hasAsync = asyncPattern.test(code);
      const hasAwait = awaitPattern.test(code);
      
      if (hasAsync || hasAwait) {
        // Wrap in async function to test
        const testCode = `async function test() { ${code} }`;
        new Function(testCode);
      }
      
      return {
        valid: true,
        hasAsync,
        hasAwait,
        details: `Async: ${hasAsync}, Await: ${hasAwait}`
      };
    } catch (error) {
      return {
        valid: false,
        hasAsync: asyncPattern.test(code),
        hasAwait: awaitPattern.test(code),
        error: error.message
      };
    }
  }

  _checkModuleSyntax(code) {
    try {
      const importPattern = /import\s+.*\s+from|import\s*\{.*\}/;
      const exportPattern = /export\s+(?:default\s+)?(?:class|function|const|let|var|\{)/;
      const hasImports = importPattern.test(code);
      const hasExports = exportPattern.test(code);
      
      // Module syntax validation is tricky with Function constructor
      // We'll do basic pattern matching instead
      return {
        valid: true,
        hasImports,
        hasExports,
        details: `Imports: ${hasImports}, Exports: ${hasExports}`,
        note: 'Module syntax validation is limited - full validation requires module environment'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  _checkClassSyntax(code) {
    try {
      const classPattern = /class\s+\w+/;
      const hasClasses = classPattern.test(code);
      
      if (hasClasses) {
        // Extract and test class definitions
        const classMatches = code.match(/class\s+\w+[^{]*\{[^}]*\}/g);
        if (classMatches) {
          for (const classCode of classMatches) {
            new Function(`return ${classCode}`);
          }
        }
      }
      
      return {
        valid: true,
        hasClasses,
        classCount: hasClasses ? (code.match(/class\s+\w+/g) || []).length : 0,
        details: hasClasses ? 'Class definitions found and valid' : 'No class definitions found'
      };
    } catch (error) {
      return {
        valid: false,
        hasClasses: classPattern.test(code),
        error: error.message
      };
    }
  }
}