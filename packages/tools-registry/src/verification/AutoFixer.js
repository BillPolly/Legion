/**
 * AutoFixer - Automatically fixes common metadata and schema issues
 * 
 * Provides safe, automated fixes for common problems in modules and tools
 */

import fs from 'fs/promises';
import path from 'path';
import { MetadataManager } from './MetadataManager.js';
import { jsonSchemaToZod } from '@legion/schema';
import { Logger } from '../utils/Logger.js';

export class AutoFixer {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      backup: options.backup !== false,
      verbose: options.verbose || false,
      fixMetadata: options.fixMetadata !== false,
      fixSchemas: options.fixSchemas !== false,
      fixInterfaces: options.fixInterfaces !== false,
      generateDocs: options.generateDocs || false,
      ...options
    };
    
    this.metadataManager = new MetadataManager({
      autoFix: true,
      inferMetadata: true
    });
    
    this.logger = Logger.create('AutoFixer', { verbose: this.options.verbose });
    
    this.fixedCount = 0;
    this.backups = [];
    this.fixLog = [];
  }
  
  /**
   * Fix all issues in a module file
   * @param {string} modulePath - Path to module file
   * @returns {Object} Fix results
   */
  async fixModule(modulePath) {
    const results = {
      path: modulePath,
      fixed: false,
      changes: [],
      errors: [],
      backup: null
    };
    
    try {
      // Read current file
      const content = await fs.readFile(modulePath, 'utf-8');
      
      // Create backup if not dry run
      if (!this.options.dryRun && this.options.backup) {
        const backupPath = await this.createBackup(modulePath, content);
        results.backup = backupPath;
      }
      
      // Parse and analyze module
      const analysis = await this.analyzeModule(content, modulePath);
      
      // Apply fixes
      let fixedContent = content;
      
      if (this.options.fixMetadata) {
        fixedContent = await this.fixMissingMetadata(fixedContent, analysis);
      }
      
      if (this.options.fixSchemas) {
        fixedContent = await this.fixSchemaIssues(fixedContent, analysis);
      }
      
      if (this.options.fixInterfaces) {
        fixedContent = await this.fixInterfaceIssues(fixedContent, analysis);
      }
      
      if (this.options.generateDocs) {
        fixedContent = await this.addDocumentation(fixedContent, analysis);
      }
      
      // Save fixed content
      if (!this.options.dryRun && fixedContent !== content) {
        await fs.writeFile(modulePath, fixedContent);
        results.fixed = true;
        this.fixedCount++;
      }
      
      results.changes = this.getChanges(content, fixedContent);
      
    } catch (error) {
      results.errors.push(error.message);
    }
    
    this.fixLog.push(results);
    return results;
  }
  
  /**
   * Analyze module content
   * @private
   */
  async analyzeModule(content, modulePath) {
    const analysis = {
      hasClass: false,
      className: null,
      hasStaticCreate: false,
      hasConstructor: false,
      hasGetTools: false,
      hasMetadata: {},
      tools: [],
      imports: [],
      exports: null
    };
    
    // Find class definition
    const classMatch = content.match(/class\s+(\w+)\s+extends\s+Module/);
    if (classMatch) {
      analysis.hasClass = true;
      analysis.className = classMatch[1];
    }
    
    // Check for static create method
    analysis.hasStaticCreate = content.includes('static async create');
    
    // Check for getTools method
    analysis.hasGetTools = content.includes('getTools()');
    
    // Check metadata properties
    analysis.hasMetadata.name = content.includes('this.name =');
    analysis.hasMetadata.description = content.includes('this.description =');
    analysis.hasMetadata.version = content.includes('this.version =');
    analysis.hasMetadata.author = content.includes('this.author =');
    analysis.hasMetadata.keywords = content.includes('this.keywords =');
    
    // Find tools
    const toolMatches = content.matchAll(/new\s+(\w+Tool)\(/g);
    for (const match of toolMatches) {
      analysis.tools.push(match[1]);
    }
    
    // Find imports
    const importMatches = content.matchAll(/import\s+.+\s+from\s+['"](.+)['"]/g);
    for (const match of importMatches) {
      analysis.imports.push(match[1]);
    }
    
    // Find export
    const exportMatch = content.match(/export\s+default\s+(\w+)/);
    if (exportMatch) {
      analysis.exports = exportMatch[1];
    }
    
    // Infer metadata from file if possible
    if (modulePath) {
      const inferredMetadata = await this.metadataManager.inferMetadataFromCode(modulePath);
      analysis.inferredMetadata = inferredMetadata;
    }
    
    return analysis;
  }
  
  /**
   * Fix missing metadata in module
   * @private
   */
  async fixMissingMetadata(content, analysis) {
    let fixed = content;
    
    if (!analysis.hasClass) {
      return fixed; // Can't fix without a class
    }
    
    // Find constructor
    const constructorMatch = fixed.match(/constructor\(\)\s*\{([^}]*)\}/s);
    if (!constructorMatch) {
      return fixed; // Can't fix without constructor
    }
    
    let constructorBody = constructorMatch[1];
    const additions = [];
    
    // Add missing metadata fields
    if (!analysis.hasMetadata.name && analysis.className) {
      const name = analysis.className
        .replace(/Module$/, '')
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '');
      additions.push(`    this.name = '${name}';`);
    }
    
    if (!analysis.hasMetadata.description) {
      const description = analysis.inferredMetadata?.description || 
        `Module for ${analysis.className?.replace(/Module$/, '')} functionality`;
      additions.push(`    this.description = '${description}';`);
    }
    
    if (!analysis.hasMetadata.version) {
      const version = analysis.inferredMetadata?.version || '1.0.0';
      additions.push(`    this.version = '${version}';`);
    }
    
    if (!analysis.hasMetadata.author) {
      const author = analysis.inferredMetadata?.author || 'Legion Team';
      additions.push(`    this.author = '${author}';`);
    }
    
    if (!analysis.hasMetadata.keywords && analysis.className) {
      const keywords = this.generateKeywords(analysis.className);
      additions.push(`    this.keywords = ${JSON.stringify(keywords)};`);
    }
    
    // Insert additions after super()
    if (additions.length > 0) {
      const superMatch = constructorBody.match(/super\(\);?\s*/);
      if (superMatch) {
        const insertPoint = constructorBody.indexOf(superMatch[0]) + superMatch[0].length;
        constructorBody = 
          constructorBody.slice(0, insertPoint) +
          '\n' + additions.join('\n') +
          constructorBody.slice(insertPoint);
        
        fixed = fixed.replace(constructorMatch[1], constructorBody);
      }
    }
    
    return fixed;
  }
  
  /**
   * Fix schema issues in module/tool
   * @private
   */
  async fixSchemaIssues(content, analysis) {
    let fixed = content;
    
    // Fix missing additionalProperties: false
    fixed = fixed.replace(
      /inputSchema:\s*\{([^}]+)\}/g,
      (match, schemaBody) => {
        if (!schemaBody.includes('additionalProperties')) {
          return match.replace(/\}$/, ',\n      additionalProperties: false\n    }');
        }
        return match;
      }
    );
    
    fixed = fixed.replace(
      /outputSchema:\s*\{([^}]+)\}/g,
      (match, schemaBody) => {
        if (!schemaBody.includes('additionalProperties')) {
          return match.replace(/\}$/, ',\n      additionalProperties: false\n    }');
        }
        return match;
      }
    );
    
    // Fix missing type: 'object' at root level
    fixed = fixed.replace(
      /(?:input|output)Schema:\s*\{/g,
      (match) => {
        const nextChar = fixed[fixed.indexOf(match) + match.length];
        if (nextChar !== '\n' || !fixed.includes('type: \'object\'')) {
          return match + '\n        type: \'object\',';
        }
        return match;
      }
    );
    
    // Fix missing required arrays
    fixed = fixed.replace(
      /properties:\s*\{([^}]+)\}/g,
      (match, propertiesBody) => {
        if (!match.includes('required:')) {
          // Extract required fields from properties
          const requiredFields = [];
          const propMatches = propertiesBody.matchAll(/(\w+):\s*\{/g);
          for (const prop of propMatches) {
            // Simple heuristic: fields without 'optional' in their description are required
            requiredFields.push(prop[1]);
          }
          
          if (requiredFields.length > 0) {
            return match + `,\n      required: ${JSON.stringify(requiredFields)}`;
          }
        }
        return match;
      }
    );
    
    return fixed;
  }
  
  /**
   * Fix interface issues in module
   * @private
   */
  async fixInterfaceIssues(content, analysis) {
    let fixed = content;
    
    // Add static create method if missing
    if (!analysis.hasStaticCreate && analysis.hasClass) {
      const classEnd = fixed.indexOf(`class ${analysis.className}`);
      const classBody = fixed.slice(classEnd);
      const firstMethod = classBody.match(/\n  \w+\(/);
      
      if (firstMethod) {
        const insertPoint = classEnd + classBody.indexOf(firstMethod[0]);
        const createMethod = `
  /**
   * Static async factory method
   */
  static async create(resourceManager) {
    const module = new ${analysis.className}();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }
`;
        fixed = fixed.slice(0, insertPoint) + createMethod + fixed.slice(insertPoint);
      }
    }
    
    // Add getTools method if missing
    if (!analysis.hasGetTools && analysis.hasClass) {
      const classEnd = fixed.lastIndexOf('}'); // End of class
      const getToolsMethod = `
  /**
   * Get all tools provided by this module
   * @returns {Array} Array of tool instances
   */
  getTools() {
    return Object.values(this.tools);
  }
`;
      fixed = fixed.slice(0, classEnd) + getToolsMethod + '\n' + fixed.slice(classEnd);
    }
    
    // Ensure proper imports
    if (!analysis.imports.includes('@legion/tools-registry')) {
      fixed = `import { Module } from '@legion/tools-registry';\n` + fixed;
    }
    
    // Ensure proper export
    if (!analysis.exports && analysis.className) {
      fixed += `\nexport default ${analysis.className};`;
    }
    
    return fixed;
  }
  
  /**
   * Add documentation to module
   * @private
   */
  async addDocumentation(content, analysis) {
    let fixed = content;
    
    // Add file header if missing
    if (!fixed.startsWith('/**')) {
      const header = `/**
 * ${analysis.className || 'Module'} - ${analysis.inferredMetadata?.description || 'Legion module'}
 * 
 * @author ${analysis.inferredMetadata?.author || 'Legion Team'}
 * @version ${analysis.inferredMetadata?.version || '1.0.0'}
 */

`;
      fixed = header + fixed;
    }
    
    // Add class documentation if missing
    if (analysis.hasClass && !fixed.includes(`/**\n * ${analysis.className}`)) {
      const classDoc = `
/**
 * ${analysis.className} - ${analysis.inferredMetadata?.description || 'Module class'}
 */`;
      fixed = fixed.replace(
        `class ${analysis.className}`,
        `${classDoc}\nclass ${analysis.className}`
      );
    }
    
    // Add method documentation for key methods
    if (analysis.hasStaticCreate && !fixed.includes('* Static async factory')) {
      fixed = fixed.replace(
        'static async create',
        `/**
   * Static async factory method for creating module instances
   * @param {ResourceManager} resourceManager - Resource manager instance
   * @returns {Promise<${analysis.className}>} Initialized module instance
   */
  static async create`
      );
    }
    
    return fixed;
  }
  
  /**
   * Fix tool metadata and schemas
   * @param {Object} tool - Tool instance
   * @returns {Object} Fixed tool metadata
   */
  async fixToolMetadata(tool) {
    const fixed = { ...tool };
    
    // Generate missing metadata
    if (!fixed.description && fixed.name) {
      fixed.description = `Tool for ${fixed.name.replace(/-/g, ' ')} operations`;
    }
    
    if (!fixed.version) {
      fixed.version = '1.0.0';
    }
    
    if (!fixed.author) {
      fixed.author = 'Legion Team';
    }
    
    if (!fixed.category) {
      fixed.category = 'other';
    }
    
    if (!fixed.keywords && fixed.name) {
      fixed.keywords = this.generateKeywords(fixed.name);
    }
    
    // Fix schemas
    if (fixed.inputSchema) {
      fixed.inputSchema = this.fixSchema(fixed.inputSchema);
    }
    
    if (fixed.outputSchema) {
      fixed.outputSchema = this.fixSchema(fixed.outputSchema);
    }
    
    // Add examples if missing
    if (!fixed.examples || fixed.examples.length === 0) {
      fixed.examples = this.generateExamples(fixed);
    }
    
    // Add test cases if missing
    if (!fixed.testCases || fixed.testCases.length === 0) {
      fixed.testCases = this.generateTestCases(fixed);
    }
    
    // Add performance constraints if missing
    if (!fixed.performance) {
      fixed.performance = {
        timeout: 30000,
        memory: 256
      };
    }
    
    return fixed;
  }
  
  /**
   * Fix a JSON schema
   * @private
   */
  fixSchema(schema) {
    const fixed = { ...schema };
    
    // Ensure type is specified
    if (!fixed.type) {
      fixed.type = 'object';
    }
    
    // Ensure properties exist for object type
    if (fixed.type === 'object' && !fixed.properties) {
      fixed.properties = {};
    }
    
    // Add additionalProperties: false for strict validation
    if (fixed.type === 'object' && fixed.additionalProperties === undefined) {
      fixed.additionalProperties = false;
    }
    
    // Ensure required array exists
    if (fixed.type === 'object' && !fixed.required) {
      fixed.required = [];
      
      // Infer required fields from properties
      if (fixed.properties) {
        for (const [key, prop] of Object.entries(fixed.properties)) {
          // Consider fields without default values as required
          if (!prop.default) {
            fixed.required.push(key);
          }
        }
      }
    }
    
    // Validate schema is parseable
    try {
      jsonSchemaToZod(fixed);
    } catch (error) {
      this.logger.warn(`Schema validation failed after fix`, { error: error.message });
    }
    
    return fixed;
  }
  
  /**
   * Generate keywords from name
   * @private
   */
  generateKeywords(name) {
    const words = name
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .split(/[\s-_]+/)
      .filter(word => word.length > 2);
    
    return [...new Set(words)];
  }
  
  /**
   * Generate example usage for a tool
   * @private
   */
  generateExamples(tool) {
    const examples = [];
    
    if (tool.inputSchema && tool.inputSchema.properties) {
      // Generate a basic example
      const exampleInput = {};
      
      for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
        if (prop.default !== undefined) {
          exampleInput[key] = prop.default;
        } else if (prop.examples && prop.examples.length > 0) {
          exampleInput[key] = prop.examples[0];
        } else {
          // Generate based on type
          switch (prop.type) {
            case 'string':
              exampleInput[key] = 'example';
              break;
            case 'number':
            case 'integer':
              exampleInput[key] = 1;
              break;
            case 'boolean':
              exampleInput[key] = true;
              break;
            case 'array':
              exampleInput[key] = [];
              break;
            case 'object':
              exampleInput[key] = {};
              break;
          }
        }
      }
      
      examples.push({
        name: 'Basic usage',
        input: exampleInput,
        output: {} // Would need actual execution to generate
      });
    }
    
    return examples;
  }
  
  /**
   * Generate test cases for a tool
   * @private
   */
  generateTestCases(tool) {
    const testCases = [];
    
    if (tool.inputSchema) {
      // Generate valid test case
      const validInput = {};
      
      if (tool.inputSchema.properties) {
        for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
          if (tool.inputSchema.required && tool.inputSchema.required.includes(key)) {
            // Required field
            switch (prop.type) {
              case 'string':
                validInput[key] = prop.default || 'test';
                break;
              case 'number':
              case 'integer':
                validInput[key] = prop.default || 1;
                break;
              case 'boolean':
                validInput[key] = prop.default !== undefined ? prop.default : true;
                break;
              default:
                validInput[key] = null;
            }
          }
        }
      }
      
      testCases.push({
        name: 'Valid input test',
        input: validInput,
        shouldFail: false
      });
      
      // Generate invalid test case (missing required field)
      if (tool.inputSchema.required && tool.inputSchema.required.length > 0) {
        const invalidInput = { ...validInput };
        delete invalidInput[tool.inputSchema.required[0]];
        
        testCases.push({
          name: 'Missing required field',
          input: invalidInput,
          shouldFail: true
        });
      }
    }
    
    return testCases;
  }
  
  /**
   * Create backup of file
   * @private
   */
  async createBackup(filepath, content) {
    const backupDir = path.join(path.dirname(filepath), '.backups');
    await fs.mkdir(backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = path.basename(filepath);
    const backupPath = path.join(backupDir, `${filename}.${timestamp}.backup`);
    
    await fs.writeFile(backupPath, content);
    this.backups.push(backupPath);
    
    return backupPath;
  }
  
  /**
   * Get changes between two contents
   * @private
   */
  getChanges(original, fixed) {
    const changes = [];
    
    const originalLines = original.split('\n');
    const fixedLines = fixed.split('\n');
    
    // Simple diff - just track additions
    if (fixedLines.length > originalLines.length) {
      changes.push({
        type: 'addition',
        lines: fixedLines.length - originalLines.length,
        description: 'Added missing code'
      });
    }
    
    // Check for specific fixes
    if (fixed.includes('static async create') && !original.includes('static async create')) {
      changes.push({
        type: 'interface',
        description: 'Added static create method'
      });
    }
    
    if (fixed.includes('this.version') && !original.includes('this.version')) {
      changes.push({
        type: 'metadata',
        description: 'Added version metadata'
      });
    }
    
    if (fixed.includes('additionalProperties: false') && !original.includes('additionalProperties: false')) {
      changes.push({
        type: 'schema',
        description: 'Added strict schema validation'
      });
    }
    
    return changes;
  }
  
  /**
   * Fix all modules in a directory
   * @param {string} directory - Directory path
   * @returns {Object} Fix results
   */
  async fixDirectory(directory) {
    const results = {
      total: 0,
      fixed: 0,
      errors: 0,
      modules: []
    };
    
    // Find all module files
    const { glob } = await import('glob');
    const files = await glob('**/*Module.js', {
      cwd: directory,
      ignore: ['**/node_modules/**', '**/__tests__/**']
    });
    
    results.total = files.length;
    
    for (const file of files) {
      const filepath = path.join(directory, file);
      const result = await this.fixModule(filepath);
      
      results.modules.push(result);
      
      if (result.fixed) {
        results.fixed++;
      }
      
      if (result.errors.length > 0) {
        results.errors++;
      }
      
      if (this.options.verbose) {
        this.logger.info(`Fixed ${filepath}: ${result.fixed ? 'YES' : 'NO'}`);
        if (result.changes.length > 0) {
          this.logger.info('  Changes:', { changes: result.changes.map(c => c.description).join(', ') });
        }
      }
    }
    
    return results;
  }
  
  /**
   * Generate fix report
   * @returns {Object} Fix report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      dryRun: this.options.dryRun,
      totalFixed: this.fixedCount,
      backups: this.backups,
      log: this.fixLog,
      summary: {
        total: this.fixLog.length,
        fixed: this.fixLog.filter(l => l.fixed).length,
        errors: this.fixLog.filter(l => l.errors.length > 0).length
      }
    };
    
    // Group by change type
    report.changesByType = {};
    for (const entry of this.fixLog) {
      for (const change of entry.changes) {
        if (!report.changesByType[change.type]) {
          report.changesByType[change.type] = 0;
        }
        report.changesByType[change.type]++;
      }
    }
    
    return report;
  }
  
  /**
   * Restore from backup
   * @param {string} backupPath - Backup file path
   * @param {string} targetPath - Target file path
   */
  async restoreFromBackup(backupPath, targetPath) {
    const content = await fs.readFile(backupPath, 'utf-8');
    await fs.writeFile(targetPath, content);
    
    if (this.options.verbose) {
      this.logger.info(`Restored ${targetPath} from ${backupPath}`);
    }
  }
  
  /**
   * Clear all backups
   */
  async clearBackups() {
    for (const backup of this.backups) {
      try {
        await fs.unlink(backup);
      } catch (error) {
        this.logger.warn(`Failed to delete backup ${backup}`, { error: error.message });
      }
    }
    
    this.backups = [];
  }
}

export default AutoFixer;