/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * Comprehensive Validator
 * 
 * Validates modules and tools across multiple dimensions:
 * - Schema validation (Zod schemas match implementation)
 * - Implementation validation (tools execute properly)
 * - Database consistency (DB matches actual code)
 * - Dependency validation (required packages available)
 * - Environment validation (required env vars set)
 */

import { MongoDBToolRegistryProvider } from '../providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';
import { ModuleLoader } from '../loading/ModuleLoader.js';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ComprehensiveValidator {
  constructor(options = {}) {
    this.resourceManager = options.resourceManager;
    this.provider = options.provider;
    this.moduleLoader = options.moduleLoader;
    this.verbose = options.verbose !== false;
    this.initialized = false;
    
    // Validation results
    this.results = {
      modules: {
        total: 0,
        validated: 0,
        failed: 0,
        warnings: 0
      },
      tools: {
        total: 0,
        schemaValid: 0,
        executableValid: 0,
        databaseConsistent: 0,
        failed: 0
      },
      issues: [],
      fixes: []
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    // Initialize ResourceManager
    if (!this.resourceManager) {
      this.resourceManager = ResourceManager.getInstance();
      if (!this.resourceManager.initialized) {
        await this.resourceManager.initialize();
      }
    }
    
    // Initialize database provider
    if (!this.provider) {
      this.provider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
        enableSemanticSearch: false
      });
    }
    
    // Initialize module loader
    if (!this.moduleLoader) {
      this.moduleLoader = new ModuleLoader({
        resourceManager: this.resourceManager,
        verbose: false
      });
      await this.moduleLoader.initialize();
    }
    
    this.initialized = true;
  }

  /**
   * Find the monorepo root directory
   */
  findMonorepoRoot() {
    let currentPath = __dirname;
    while (currentPath !== '/') {
      const packagePath = path.join(currentPath, 'package.json');
      if (fsSync.existsSync(packagePath)) {
        try {
          const pkg = JSON.parse(fsSync.readFileSync(packagePath, 'utf-8'));
          if (pkg.workspaces) {
            return currentPath;
          }
        } catch (e) {
          // Continue searching
        }
      }
      currentPath = path.dirname(currentPath);
    }
    return process.cwd(); // Fallback to current directory
  }

  /**
   * Validate all modules in the database
   */
  async validateAllModules() {
    await this.initialize();
    
    if (this.verbose) {
      console.log('\n🔍 Comprehensive Module Validation');
      console.log('═'.repeat(60));
    }
    
    // Get all modules from database
    const modules = await this.provider.databaseService.mongoProvider.find('modules', {
      loadable: { $ne: false }
    });
    
    this.results.modules.total = modules.length;
    
    for (const moduleDoc of modules) {
      const validation = await this.validateModule(moduleDoc);
      
      // Update module in database with validation results
      await this.provider.databaseService.mongoProvider.update(
        'modules',
        { _id: moduleDoc._id },
        { 
          $set: {
            validationStatus: validation.status,
            validationErrors: validation.errors,
            validationWarnings: validation.warnings,
            validationDate: new Date(),
            executionStatus: validation.executionStatus,
            lastTestedDate: validation.executionStatus ? new Date() : null
          }
        }
      );
      
      if (validation.status === 'validated') {
        this.results.modules.validated++;
      } else if (validation.status === 'failed') {
        this.results.modules.failed++;
      } else if (validation.status === 'warning') {
        this.results.modules.warnings++;
      }
    }
    
    return this.results;
  }

  /**
   * Validate a single module
   */
  async validateModule(moduleDoc) {
    const validation = {
      status: 'validated',
      errors: [],
      warnings: [],
      executionStatus: 'untested',
      tools: []
    };
    
    if (this.verbose) {
      console.log(`\n📦 Validating Module: ${moduleDoc.name}`);
    }
    
    try {
      // 1. Check if module file exists
      // Use filePath if available (for class modules), otherwise use path (for JSON modules)
      const moduleFilePath = moduleDoc.filePath || moduleDoc.path;
      
      // Get monorepo root from ResourceManager or find it
      const monorepoRoot = this.resourceManager.get('env.MONOREPO_ROOT') || this.findMonorepoRoot();
      const fullPath = path.join(monorepoRoot, moduleFilePath);
      
      try {
        await fs.access(fullPath);
      } catch (error) {
        validation.errors.push(`Module file not found: ${moduleFilePath}`);
        validation.status = 'failed';
        return validation;
      }
      
      // 2. Try to load the module
      let moduleInstance;
      try {
        const loadResult = await this.moduleLoader.loadModule(moduleDoc);
        moduleInstance = loadResult;
        
        if (!moduleInstance) {
          validation.errors.push('Module failed to load');
          validation.status = 'failed';
          return validation;
        }
      } catch (error) {
        validation.errors.push(`Load error: ${error.message}`);
        validation.status = 'failed';
        return validation;
      }
      
      // 3. Validate environment variables
      if (moduleDoc.requiredEnvVars && moduleDoc.requiredEnvVars.length > 0) {
        for (const envVar of moduleDoc.requiredEnvVars) {
          const value = this.resourceManager.get(`env.${envVar}`);
          if (!value) {
            validation.warnings.push(`Missing environment variable: ${envVar}`);
            if (validation.status === 'validated') {
              validation.status = 'warning';
            }
          }
        }
      }
      
      // 4. Validate tools
      if (moduleInstance && typeof moduleInstance.getTools === 'function') {
        const tools = moduleInstance.getTools();
        
        for (const tool of tools) {
          const toolValidation = await this.validateTool(tool, moduleDoc);
          validation.tools.push(toolValidation);
          
          if (toolValidation.schemaValid && toolValidation.executable) {
            this.results.tools.schemaValid++;
            this.results.tools.executableValid++;
          } else {
            this.results.tools.failed++;
            validation.warnings.push(`Tool ${tool.name} has issues`);
          }
        }
        
        // Check tool count consistency
        const dbToolCount = await this.provider.databaseService.mongoProvider.count('tools', {
          moduleName: moduleDoc.name
        });
        
        if (dbToolCount !== tools.length) {
          validation.warnings.push(`Tool count mismatch: DB has ${dbToolCount}, module has ${tools.length}`);
        }
      }
      
      // 5. Test execution if possible
      if (moduleInstance && validation.tools.length > 0) {
        const executableTools = validation.tools.filter(t => t.executable);
        if (executableTools.length > 0) {
          validation.executionStatus = 'working';
        } else if (validation.tools.length > 0) {
          validation.executionStatus = 'partial';
        }
      }
      
      if (this.verbose) {
        console.log(`   Status: ${validation.status}`);
        if (validation.errors.length > 0) {
          console.log(`   ❌ Errors: ${validation.errors.length}`);
        }
        if (validation.warnings.length > 0) {
          console.log(`   ⚠️  Warnings: ${validation.warnings.length}`);
        }
      }
      
    } catch (error) {
      validation.errors.push(`Validation error: ${error.message}`);
      validation.status = 'failed';
    }
    
    return validation;
  }

  /**
   * Validate a single tool
   */
  async validateTool(tool, moduleDoc) {
    const validation = {
      name: tool.name,
      schemaValid: false,
      executable: false,
      databaseConsistent: false,
      errors: []
    };
    
    this.results.tools.total++;
    
    try {
      // 1. Validate schema
      if (tool.inputSchema) {
        try {
          // Check if it's a valid Zod schema
          if (tool.inputSchema._def) {
            validation.schemaValid = true;
          } else {
            validation.errors.push('Input schema is not a valid Zod schema');
          }
        } catch (error) {
          validation.errors.push(`Schema validation error: ${error.message}`);
        }
      } else {
        validation.warnings = ['No input schema defined'];
      }
      
      // 2. Validate execute method
      if (typeof tool.execute === 'function') {
        validation.executable = true;
        
        // Try a simple execution test if we have a test input
        if (tool.testInput) {
          try {
            const result = await tool.execute(tool.testInput);
            if (!result.success) {
              validation.errors.push(`Test execution failed: ${result.error}`);
            }
          } catch (error) {
            validation.errors.push(`Execution error: ${error.message}`);
          }
        }
      } else {
        validation.errors.push('Tool does not have execute method');
      }
      
      // 3. Check database consistency
      const dbTool = await this.provider.databaseService.mongoProvider.findOne('tools', {
        name: tool.name,
        moduleName: moduleDoc.name
      });
      
      if (dbTool) {
        validation.databaseConsistent = true;
        
        // Check if descriptions match
        if (dbTool.description !== tool.description) {
          validation.warnings = validation.warnings || [];
          validation.warnings.push('Description mismatch between DB and implementation');
        }
        
        // Check if schemas match (simplified check)
        if (JSON.stringify(dbTool.inputSchema) !== JSON.stringify(tool.inputSchema)) {
          validation.warnings = validation.warnings || [];
          validation.warnings.push('Schema mismatch between DB and implementation');
        }
      } else {
        validation.errors.push('Tool not found in database');
      }
      
      if (validation.databaseConsistent) {
        this.results.tools.databaseConsistent++;
      }
      
    } catch (error) {
      validation.errors.push(`Validation error: ${error.message}`);
    }
    
    return validation;
  }

  /**
   * Validate and test tool execution with sample inputs
   */
  async validateToolExecution(toolName, testInputs = null) {
    await this.initialize();
    
    const tool = await this.provider.getTool(toolName);
    if (!tool) {
      return {
        success: false,
        error: 'Tool not found in database'
      };
    }
    
    // Load the module to get the executable tool
    const module = await this.provider.databaseService.mongoProvider.findOne('modules', {
      name: tool.moduleName
    });
    
    if (!module) {
      return {
        success: false,
        error: 'Module not found for tool'
      };
    }
    
    try {
      const moduleInstance = await this.moduleLoader.loadModule(module);
      const executableTool = moduleInstance.getTool ? moduleInstance.getTool(toolName) : null;
      
      if (!executableTool) {
        return {
          success: false,
          error: 'Could not get executable tool from module'
        };
      }
      
      // Generate test inputs if not provided
      if (!testInputs && tool.inputSchema) {
        testInputs = this.generateTestInputs(tool.inputSchema);
      }
      
      const results = [];
      for (const input of testInputs || [{}]) {
        try {
          const result = await executableTool.execute(input);
          results.push({
            input,
            output: result,
            success: result.success
          });
        } catch (error) {
          results.push({
            input,
            error: error.message,
            success: false
          });
        }
      }
      
      return {
        success: true,
        results
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate test inputs from schema
   */
  generateTestInputs(schema) {
    // Simple test input generation based on schema
    const testInputs = [];
    
    if (schema && schema.properties) {
      const testInput = {};
      
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (prop.type === 'string') {
          testInput[key] = 'test';
        } else if (prop.type === 'number') {
          testInput[key] = 42;
        } else if (prop.type === 'boolean') {
          testInput[key] = true;
        } else if (prop.type === 'array') {
          testInput[key] = [];
        } else if (prop.type === 'object') {
          testInput[key] = {};
        }
      }
      
      testInputs.push(testInput);
    }
    
    return testInputs;
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const report = {
      summary: {
        modules: this.results.modules,
        tools: this.results.tools
      },
      issues: this.results.issues,
      recommendations: []
    };
    
    // Add recommendations based on results
    if (this.results.modules.failed > 0) {
      report.recommendations.push('Fix failed modules before deployment');
    }
    
    if (this.results.tools.failed > this.results.tools.total * 0.1) {
      report.recommendations.push('More than 10% of tools are failing - investigate common issues');
    }
    
    if (this.results.tools.databaseConsistent < this.results.tools.total) {
      report.recommendations.push('Run database synchronization to fix inconsistencies');
    }
    
    return report;
  }
}

// Export singleton for convenience
export const comprehensiveValidator = new ComprehensiveValidator();
export default comprehensiveValidator;