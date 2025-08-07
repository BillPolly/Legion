/**
 * Class modification tools for updating existing classes and tests
 * Handles incremental changes to generated code with state tracking
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ClassModificationTools {
  constructor(workingDirectory = './generated') {
    this.workingDir = workingDirectory;
    this.classState = new Map(); // Track class state across modifications
  }

  /**
   * Initialize or load existing class state
   */
  async initializeClassState(className) {
    const classFile = path.join(this.workingDir, 'src', `${className}.js`);
    const testFile = path.join(this.workingDir, 'tests', `${className}.test.js`);
    
    let classExists = false;
    let testExists = false;
    let currentCode = '';
    let currentTests = '';
    
    try {
      currentCode = await fs.readFile(classFile, 'utf-8');
      classExists = true;
    } catch {
      // Class doesn't exist yet
    }
    
    try {
      currentTests = await fs.readFile(testFile, 'utf-8');
      testExists = true;
    } catch {
      // Tests don't exist yet
    }

    const state = {
      className,
      classExists,
      testExists,
      currentCode,
      currentTests,
      methods: this.extractMethods(currentCode),
      modifications: [],
      lastModified: Date.now()
    };

    this.classState.set(className, state);
    return state;
  }

  /**
   * Extract method names and signatures from existing class code
   */
  extractMethods(code) {
    if (!code) return [];
    
    const methods = [];
    // Regex to find method definitions
    const methodRegex = /^\s+(\w+)\s*\([^)]*\)\s*\{/gm;
    let match;
    
    while ((match = methodRegex.exec(code)) !== null) {
      const methodName = match[1];
      if (methodName !== 'constructor') {
        methods.push({
          name: methodName,
          signature: match[0].trim(),
          startIndex: match.index,
          // Extract the full method body (simplified)
          body: this.extractMethodBody(code, match.index)
        });
      }
    }
    
    return methods;
  }

  /**
   * Extract method body from code starting at given index
   */
  extractMethodBody(code, startIndex) {
    let braceCount = 0;
    let i = code.indexOf('{', startIndex);
    const start = startIndex; // Include the method signature
    
    for (i; i < code.length; i++) {
      if (code[i] === '{') braceCount++;
      if (code[i] === '}') braceCount--;
      if (braceCount === 0) break;
    }
    
    return code.substring(start, i + 1);
  }

  /**
   * Create a method modifier tool
   */
  createMethodModifier() {
    const self = this;
    return {
      name: 'methodModifier',
      async execute(params) {
        const { className, methodName, newImplementation, description } = params;
        
        if (!className || !methodName) {
          return {
            success: false,
            data: { error: 'className and methodName are required' }
          };
        }

        // Initialize or get current state
        const state = await self.initializeClassState(className);
        
        if (!state.classExists) {
          return {
            success: false,
            data: { error: `Class ${className} does not exist. Generate it first.` }
          };
        }

        // Find the method to modify
        const existingMethod = state.methods.find(m => m.name === methodName);
        let modifiedCode = state.currentCode;
        
        if (existingMethod) {
          // Replace existing method - find full method including signature
          const methodStart = existingMethod.startIndex;
          const methodBodyLength = existingMethod.body.length;
          const methodEnd = methodStart + methodBodyLength;
          
          const newMethodCode = `  ${methodName}(${self.generateMethodParams(methodName)}) {
${newImplementation || self.generateMethodBody(methodName)}
  }`;
          
          modifiedCode = state.currentCode.substring(0, methodStart) + 
                        newMethodCode + 
                        state.currentCode.substring(methodEnd);
        } else {
          // Add new method before the closing brace
          const insertPoint = modifiedCode.lastIndexOf('}');
          const newMethodCode = `
  ${methodName}(${self.generateMethodParams(methodName)}) {
    ${newImplementation || self.generateMethodBody(methodName)}
  }
`;
          
          modifiedCode = modifiedCode.substring(0, insertPoint) + 
                        newMethodCode + 
                        modifiedCode.substring(insertPoint);
        }

        // Write the modified class
        const classFile = path.join(self.workingDir, 'src', `${className}.js`);
        try {
          await fs.writeFile(classFile, modifiedCode, 'utf-8');
          
          // Update state
          state.currentCode = modifiedCode;
          state.methods = self.extractMethods(modifiedCode);
          state.modifications.push({
            type: existingMethod ? 'modified' : 'added',
            methodName,
            description,
            timestamp: Date.now()
          });
          state.lastModified = Date.now();
          
          return {
            success: true,
            data: {
              className,
              methodName,
              action: existingMethod ? 'modified' : 'added',
              code: modifiedCode,
              filePath: classFile,
              modifications: state.modifications,
              timestamp: Date.now()
            }
          };
        } catch (error) {
          return {
            success: false,
            data: { error: `Failed to write modified class: ${error.message}` }
          };
        }
      },
      getMetadata() {
        return {
          name: 'methodModifier',
          description: 'Modifies or adds methods to existing classes',
          input: {
            className: { type: 'string', required: true },
            methodName: { type: 'string', required: true },
            newImplementation: { type: 'string', required: false },
            description: { type: 'string', required: false }
          },
          output: {
            action: { type: 'string' },
            code: { type: 'string' },
            modifications: { type: 'array' }
          }
        };
      }
    };
  }

  /**
   * Create a test modifier tool
   */
  createTestModifier() {
    const self = this;
    return {
      name: 'testModifier',
      async execute(params) {
        const { className, methodName, testCases } = params;
        
        if (!className || !methodName) {
          return {
            success: false,
            data: { error: 'className and methodName are required' }
          };
        }

        // Initialize or get current state
        const state = await self.initializeClassState(className);
        
        // Generate new test cases for the method
        const newTestCases = testCases || self.generateTestCasesForMethod(methodName);
        let modifiedTests = state.currentTests;
        
        if (state.testExists) {
          // Find insertion point (before closing });)
          const insertPoint = modifiedTests.lastIndexOf('});');
          const newTestCode = `
${newTestCases}
`;
          
          modifiedTests = modifiedTests.substring(0, insertPoint) + 
                         newTestCode + 
                         modifiedTests.substring(insertPoint);
        } else {
          // Create new test file
          modifiedTests = `import ${className} from '../src/${className}.js';

describe('${className}', () => {
  let instance;

  beforeEach(() => {
    instance = new ${className}();
  });

  test('should create instance correctly', () => {
    expect(instance).toBeDefined();
    expect(instance.initialized).toBe(true);
  });

${newTestCases}
});`;
        }

        // Write the modified tests
        const testFile = path.join(self.workingDir, 'tests', `${className}.test.js`);
        try {
          await self.ensureWorkingDirectory();
          await fs.writeFile(testFile, modifiedTests, 'utf-8');
          
          // Update state
          state.currentTests = modifiedTests;
          state.testExists = true;
          state.modifications.push({
            type: 'test-modified',
            methodName,
            timestamp: Date.now()
          });
          
          return {
            success: true,
            data: {
              className,
              methodName,
              testCode: modifiedTests,
              testPath: testFile,
              modifications: state.modifications,
              timestamp: Date.now()
            }
          };
        } catch (error) {
          return {
            success: false,
            data: { error: `Failed to write modified tests: ${error.message}` }
          };
        }
      },
      getMetadata() {
        return {
          name: 'testModifier',
          description: 'Adds or modifies tests for class methods',
          input: {
            className: { type: 'string', required: true },
            methodName: { type: 'string', required: true },
            testCases: { type: 'string', required: false }
          },
          output: {
            testCode: { type: 'string' },
            testPath: { type: 'string' }
          }
        };
      }
    };
  }

  /**
   * Create a class refactor tool
   */
  createClassRefactor() {
    const self = this;
    return {
      name: 'classRefactor',
      async execute(params) {
        const { className, changes, description } = params;
        
        if (!className || !changes) {
          return {
            success: false,
            data: { error: 'className and changes are required' }
          };
        }

        // Initialize or get current state
        const state = await self.initializeClassState(className);
        
        if (!state.classExists) {
          return {
            success: false,
            data: { error: `Class ${className} does not exist` }
          };
        }

        let modifiedCode = state.currentCode;
        const appliedChanges = [];

        // Apply changes based on type
        for (const change of changes) {
          switch (change.type) {
            case 'rename-method':
              modifiedCode = self.renameMethod(modifiedCode, change.oldName, change.newName);
              appliedChanges.push(`Renamed method ${change.oldName} to ${change.newName}`);
              break;
              
            case 'add-property':
              modifiedCode = self.addProperty(modifiedCode, change.propertyName, change.defaultValue);
              appliedChanges.push(`Added property ${change.propertyName}`);
              break;
              
            case 'remove-method':
              modifiedCode = self.removeMethod(modifiedCode, change.methodName);
              appliedChanges.push(`Removed method ${change.methodName}`);
              break;
              
            case 'add-import':
              modifiedCode = self.addImport(modifiedCode, change.importStatement);
              appliedChanges.push(`Added import: ${change.importStatement}`);
              break;
          }
        }

        // Write the refactored class
        const classFile = path.join(self.workingDir, 'src', `${className}.js`);
        try {
          await fs.writeFile(classFile, modifiedCode, 'utf-8');
          
          // Update state
          state.currentCode = modifiedCode;
          state.methods = self.extractMethods(modifiedCode);
          state.modifications.push({
            type: 'refactored',
            description: description || 'Class refactoring',
            changes: appliedChanges,
            timestamp: Date.now()
          });
          
          return {
            success: true,
            data: {
              className,
              code: modifiedCode,
              appliedChanges,
              modifications: state.modifications,
              timestamp: Date.now()
            }
          };
        } catch (error) {
          return {
            success: false,
            data: { error: `Failed to write refactored class: ${error.message}` }
          };
        }
      },
      getMetadata() {
        return {
          name: 'classRefactor',
          description: 'Performs structural changes to existing classes',
          input: {
            className: { type: 'string', required: true },
            changes: { type: 'array', required: true },
            description: { type: 'string', required: false }
          },
          output: {
            code: { type: 'string' },
            appliedChanges: { type: 'array' }
          }
        };
      }
    };
  }

  /**
   * Create a state inspector tool
   */
  createStateInspector() {
    const self = this;
    return {
      name: 'stateInspector',
      async execute(params) {
        const { className } = params;
        
        if (!className) {
          return {
            success: false,
            data: { error: 'className is required' }
          };
        }

        const state = await self.initializeClassState(className);
        
        return {
          success: true,
          data: {
            className,
            exists: state.classExists,
            methods: state.methods.map(m => ({ name: m.name, signature: m.signature })),
            modifications: state.modifications,
            lastModified: state.lastModified,
            hasTests: state.testExists,
            linesOfCode: state.currentCode.split('\n').length
          }
        };
      },
      getMetadata() {
        return {
          name: 'stateInspector',
          description: 'Inspects the current state of a class',
          input: {
            className: { type: 'string', required: true }
          },
          output: {
            exists: { type: 'boolean' },
            methods: { type: 'array' },
            modifications: { type: 'array' }
          }
        };
      }
    };
  }

  // Helper methods for code manipulation
  async ensureWorkingDirectory() {
    try {
      await fs.mkdir(this.workingDir, { recursive: true });
      await fs.mkdir(path.join(this.workingDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(this.workingDir, 'tests'), { recursive: true });
    } catch {
      // Directory might already exist
    }
  }

  generateMethodParams(methodName) {
    if (methodName.toLowerCase().includes('create') || methodName.toLowerCase().includes('add')) return 'data';
    if (methodName.toLowerCase().includes('get') || methodName.toLowerCase().includes('find')) return 'id';
    if (methodName.toLowerCase().includes('update')) return 'id, updates';
    if (methodName.toLowerCase().includes('delete') || methodName.toLowerCase().includes('remove')) return 'id';
    return 'param';
  }

  generateMethodBody(methodName) {
    if (methodName.toLowerCase().includes('create') || methodName.toLowerCase().includes('add')) {
      return `    // Create new item
    if (!data) throw new Error('Data is required');
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const item = { id, ...data, createdAt: new Date().toISOString() };
    this.data.set(id, item);
    return item;`;
    }
    
    if (methodName.toLowerCase().includes('get') || methodName.toLowerCase().includes('find')) {
      return `    // Find existing item
    if (!id) throw new Error('ID is required');
    const item = this.data.get(id);
    if (!item) throw new Error('Item not found');
    return item;`;
    }
    
    return `    // Implementation for ${methodName}
    console.log('${methodName} called with:', param);
    return { success: true, method: '${methodName}', param };`;
  }

  generateTestCasesForMethod(methodName) {
    return `  test('should ${methodName} correctly', () => {
    const result = instance.${methodName}('test-param');
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.method).toBe('${methodName}');
  });

  test('should handle ${methodName} edge cases', () => {
    // Add edge case testing here
    expect(() => instance.${methodName}()).toBeDefined();
  });`;
  }

  // Code transformation helpers
  renameMethod(code, oldName, newName) {
    const regex = new RegExp(`\\b${oldName}\\s*\\(`, 'g');
    return code.replace(regex, `${newName}(`);
  }

  addProperty(code, propertyName, defaultValue = 'null') {
    const constructorMatch = code.match(/constructor\(\)\s*\{([^}]*)\}/);
    if (constructorMatch) {
      const constructorBody = constructorMatch[1];
      const newConstructorBody = constructorBody + `\n    this.${propertyName} = ${defaultValue};`;
      return code.replace(constructorMatch[0], `constructor() {${newConstructorBody}\n  }`);
    }
    return code;
  }

  removeMethod(code, methodName) {
    const methodRegex = new RegExp(`\\s+${methodName}\\s*\\([^)]*\\)\\s*\\{[^}]*\\}\\s*`, 's');
    return code.replace(methodRegex, '\n');
  }

  addImport(code, importStatement) {
    return importStatement + '\n' + code;
  }

  /**
   * Get current state of all tracked classes
   */
  getAllStates() {
    return Object.fromEntries(this.classState);
  }

  /**
   * Clear state for a specific class
   */
  clearState(className) {
    this.classState.delete(className);
  }

  /**
   * Clear all states
   */
  clearAllStates() {
    this.classState.clear();
  }
}