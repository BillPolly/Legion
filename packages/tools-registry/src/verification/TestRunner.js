/**
 * TestRunner - Orchestrates comprehensive testing across all modules and tools
 * 
 * Manages the complete testing pipeline from discovery to reporting
 */

import { ModuleDiscovery } from '../core/ModuleDiscovery.js';
import { ModuleLoader } from '../core/ModuleLoader.js';
import { MetadataManager } from './MetadataManager.js';
import { ToolValidator } from './ToolValidator.js';
import { ToolTester } from './ToolTester.js';
import { ReportGenerator } from './ReportGenerator.js';
import { EventEmitter } from 'events';

export class TestRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      parallel: options.parallel || false,
      concurrency: options.concurrency || 5,
      stopOnFailure: options.stopOnFailure || false,
      verbose: options.verbose || false,
      testTimeout: options.testTimeout || 30000,
      includePerformance: options.includePerformance !== false,
      includeIntegration: options.includeIntegration || false,
      moduleFilter: options.moduleFilter || null,
      toolFilter: options.toolFilter || null,
      ...options
    };
    
    // Initialize components
    this.moduleDiscovery = new ModuleDiscovery({
      verbose: this.options.verbose,
      databaseStorage: this.options.databaseStorage
    });
    
    this.moduleLoader = new ModuleLoader({
      resourceManager: this.options.resourceManager
    });
    
    this.metadataManager = new MetadataManager({
      strictMode: this.options.strictMode,
      autoFix: this.options.autoFix
    });
    
    this.toolValidator = new ToolValidator({
      strictMode: this.options.strictMode,
      performanceChecks: this.options.includePerformance
    });
    
    this.toolTester = new ToolTester({
      parallel: this.options.parallel,
      concurrency: this.options.concurrency,
      timeout: this.options.testTimeout
    });
    
    this.reportGenerator = new ReportGenerator();
    
    // Track results
    this.results = {
      modules: [],
      tools: [],
      validation: [],
      tests: [],
      integration: [],
      timestamp: null,
      duration: 0
    };
  }
  
  /**
   * Run complete testing pipeline
   * @param {Object} options - Pipeline options
   * @returns {Object} Comprehensive test results
   */
  async runCompletePipeline(options = {}) {
    const startTime = Date.now();
    this.results.timestamp = new Date().toISOString();
    
    this.emit('pipeline:start', { timestamp: this.results.timestamp });
    
    try {
      // Phase 1: Discovery
      this.emit('phase:start', { phase: 'discovery' });
      const modules = await this.discoverModules();
      this.results.modules = modules;
      this.emit('phase:complete', { phase: 'discovery', count: modules.length });
      
      // Phase 2: Load and Validate
      this.emit('phase:start', { phase: 'loading' });
      const loadedModules = await this.loadModules(modules);
      this.emit('phase:complete', { phase: 'loading', count: loadedModules.length });
      
      // Phase 3: Metadata Validation
      this.emit('phase:start', { phase: 'validation' });
      const validationResults = await this.validateModules(loadedModules);
      this.results.validation = validationResults;
      this.emit('phase:complete', { phase: 'validation', results: validationResults });
      
      // Phase 4: Test Execution
      this.emit('phase:start', { phase: 'testing' });
      const testResults = await this.testAllTools(loadedModules);
      this.results.tests = testResults;
      this.emit('phase:complete', { phase: 'testing', results: testResults });
      
      // Phase 5: Integration Tests
      if (this.options.includeIntegration) {
        this.emit('phase:start', { phase: 'integration' });
        const integrationResults = await this.runIntegrationTests(loadedModules);
        this.results.integration = integrationResults;
        this.emit('phase:complete', { phase: 'integration', results: integrationResults });
      }
      
      // Phase 6: Report Generation
      this.emit('phase:start', { phase: 'reporting' });
      const report = await this.generateComprehensiveReport(this.results);
      this.emit('phase:complete', { phase: 'reporting', report });
      
      this.results.duration = Date.now() - startTime;
      this.emit('pipeline:complete', {
        duration: this.results.duration,
        report
      });
      
      return report;
      
    } catch (error) {
      this.emit('pipeline:error', { error: error.message, stack: error.stack });
      throw error;
    }
  }
  
  /**
   * Discover modules in the monorepo
   * @private
   */
  async discoverModules() {
    this.emit('discovery:start');
    
    const modules = await this.moduleDiscovery.discoverInMonorepo();
    
    // Apply module filter if provided
    let filteredModules = modules;
    if (this.options.moduleFilter) {
      if (typeof this.options.moduleFilter === 'string') {
        filteredModules = modules.filter(m => m.name === this.options.moduleFilter);
      } else if (this.options.moduleFilter instanceof RegExp) {
        filteredModules = modules.filter(m => this.options.moduleFilter.test(m.name));
      } else if (typeof this.options.moduleFilter === 'function') {
        filteredModules = modules.filter(this.options.moduleFilter);
      }
    }
    
    this.emit('discovery:complete', {
      total: modules.length,
      filtered: filteredModules.length
    });
    
    return filteredModules;
  }
  
  /**
   * Load discovered modules
   * @private
   */
  async loadModules(modules) {
    this.emit('loading:start', { count: modules.length });
    
    const loadedModules = [];
    const errors = [];
    
    for (const moduleInfo of modules) {
      try {
        this.emit('loading:module', { name: moduleInfo.name, path: moduleInfo.path });
        
        const moduleInstance = await this.moduleLoader.loadModule(moduleInfo.path);
        
        loadedModules.push({
          info: moduleInfo,
          instance: moduleInstance,
          metadata: await this.moduleLoader.getModuleMetadata(moduleInstance),
          tools: await this.moduleLoader.getTools(moduleInstance)
        });
        
        this.emit('loading:module:success', { name: moduleInfo.name });
      } catch (error) {
        errors.push({
          module: moduleInfo.name,
          error: error.message
        });
        
        this.emit('loading:module:error', {
          name: moduleInfo.name,
          error: error.message
        });
        
        if (this.options.stopOnFailure) {
          throw error;
        }
      }
    }
    
    this.emit('loading:complete', {
      loaded: loadedModules.length,
      errors: errors.length
    });
    
    return loadedModules;
  }
  
  /**
   * Validate module and tool metadata
   * @private
   */
  async validateModules(loadedModules) {
    this.emit('validation:start', { count: loadedModules.length });
    
    const validationResults = {
      modules: [],
      tools: [],
      summary: {
        totalModules: loadedModules.length,
        validModules: 0,
        totalTools: 0,
        validTools: 0,
        averageModuleScore: 0,
        averageToolScore: 0
      }
    };
    
    let totalModuleScore = 0;
    let totalToolScore = 0;
    
    for (const module of loadedModules) {
      // Validate module metadata
      const moduleValidation = this.metadataManager.validateModuleMetadata(module.metadata);
      
      validationResults.modules.push({
        name: module.info.name,
        validation: moduleValidation
      });
      
      if (moduleValidation.valid) {
        validationResults.summary.validModules++;
      }
      totalModuleScore += moduleValidation.score;
      
      // Validate each tool
      for (const tool of module.tools) {
        validationResults.summary.totalTools++;
        
        // Apply tool filter if provided
        if (this.options.toolFilter) {
          if (typeof this.options.toolFilter === 'string' && tool.name !== this.options.toolFilter) {
            continue;
          } else if (this.options.toolFilter instanceof RegExp && !this.options.toolFilter.test(tool.name)) {
            continue;
          } else if (typeof this.options.toolFilter === 'function' && !this.options.toolFilter(tool)) {
            continue;
          }
        }
        
        const toolMetadata = {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          ...tool
        };
        
        const toolMetadataValidation = this.metadataManager.validateToolMetadata(toolMetadata);
        const toolInterfaceValidation = this.toolValidator.validateInterface(tool);
        const toolSchemaValidation = this.toolValidator.validateSchemas(tool);
        
        const combinedScore = (
          toolMetadataValidation.score * 0.4 +
          (toolInterfaceValidation.valid ? 30 : 0) +
          (toolSchemaValidation.valid ? 30 : 0)
        );
        
        validationResults.tools.push({
          module: module.info.name,
          name: tool.name,
          metadata: toolMetadataValidation,
          interface: toolInterfaceValidation,
          schemas: toolSchemaValidation,
          combinedScore
        });
        
        if (toolMetadataValidation.valid && toolInterfaceValidation.valid && toolSchemaValidation.valid) {
          validationResults.summary.validTools++;
        }
        totalToolScore += combinedScore;
      }
    }
    
    // Calculate averages
    if (validationResults.summary.totalModules > 0) {
      validationResults.summary.averageModuleScore = totalModuleScore / validationResults.summary.totalModules;
    }
    if (validationResults.summary.totalTools > 0) {
      validationResults.summary.averageToolScore = totalToolScore / validationResults.summary.totalTools;
    }
    
    this.emit('validation:complete', validationResults.summary);
    
    return validationResults;
  }
  
  /**
   * Test all tools
   * @private
   */
  async testAllTools(loadedModules) {
    this.emit('testing:start');
    
    const testResults = [];
    let totalTests = 0;
    let passedTests = 0;
    
    // Process modules
    const testPromises = [];
    
    for (const module of loadedModules) {
      for (const tool of module.tools) {
        // Apply tool filter
        if (this.options.toolFilter) {
          if (typeof this.options.toolFilter === 'string' && tool.name !== this.options.toolFilter) {
            continue;
          } else if (this.options.toolFilter instanceof RegExp && !this.options.toolFilter.test(tool.name)) {
            continue;
          } else if (typeof this.options.toolFilter === 'function' && !this.options.toolFilter(tool)) {
            continue;
          }
        }
        
        const testPromise = this.testSingleTool(module, tool).then(result => {
          totalTests += result.summary.total;
          passedTests += result.summary.passed;
          return result;
        });
        
        if (this.options.parallel) {
          testPromises.push(testPromise);
        } else {
          const result = await testPromise;
          testResults.push(result);
          
          if (this.options.stopOnFailure && result.summary.failed > 0) {
            break;
          }
        }
      }
      
      if (this.options.stopOnFailure && testResults.some(r => r.summary.failed > 0)) {
        break;
      }
    }
    
    // Wait for parallel tests
    if (this.options.parallel) {
      const batchSize = this.options.concurrency;
      for (let i = 0; i < testPromises.length; i += batchSize) {
        const batch = testPromises.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch);
        testResults.push(...batchResults);
      }
    }
    
    this.emit('testing:complete', {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0
    });
    
    return testResults;
  }
  
  /**
   * Test a single tool
   * @private
   */
  async testSingleTool(module, tool) {
    this.emit('testing:tool', {
      module: module.info.name,
      tool: tool.name
    });
    
    try {
      // Generate test cases
      const testCases = this.toolTester.generateTestCases(tool);
      
      // Combine all test cases
      const allTestCases = [
        ...testCases.valid,
        ...testCases.edge,
        ...testCases.invalid,
        ...testCases.custom
      ];
      
      // Run tests
      const results = await this.toolTester.runTests(tool, allTestCases);
      
      // Generate report
      const report = this.toolTester.generateTestReport(tool, results);
      
      // Add performance validation if enabled
      if (this.options.includePerformance && testCases.valid.length > 0) {
        const perfResult = await this.toolValidator.validatePerformance(
          tool,
          testCases.valid[0].input,
          { iterations: 5 }
        );
        report.performance = perfResult;
      }
      
      this.emit('testing:tool:complete', {
        module: module.info.name,
        tool: tool.name,
        summary: report.summary
      });
      
      return {
        module: module.info.name,
        tool: tool.name,
        report,
        summary: report.summary,
        results
      };
      
    } catch (error) {
      this.emit('testing:tool:error', {
        module: module.info.name,
        tool: tool.name,
        error: error.message
      });
      
      return {
        module: module.info.name,
        tool: tool.name,
        error: error.message,
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          errors: 1
        }
      };
    }
  }
  
  /**
   * Run integration tests between tools
   * @private
   */
  async runIntegrationTests(loadedModules) {
    this.emit('integration:start');
    
    const integrationTests = [];
    const results = [];
    
    // Find potential tool chains
    for (const module1 of loadedModules) {
      for (const tool1 of module1.tools) {
        for (const module2 of loadedModules) {
          for (const tool2 of module2.tools) {
            if (tool1 !== tool2 && this.canChainTools(tool1, tool2)) {
              integrationTests.push({
                chain: [
                  { module: module1.info.name, tool: tool1 },
                  { module: module2.info.name, tool: tool2 }
                ]
              });
            }
          }
        }
      }
    }
    
    // Run integration tests
    for (const test of integrationTests) {
      const tool1 = test.chain[0].tool;
      const tool2 = test.chain[1].tool;
      
      // Generate compatible test input
      const testInput = this.generateCompatibleInput(tool1.inputSchema);
      
      const result = await this.toolTester.testToolIntegration(tool1, tool2, testInput);
      results.push({
        chain: test.chain.map(c => `${c.module}/${c.tool.name}`),
        result
      });
    }
    
    this.emit('integration:complete', {
      totalTests: results.length,
      compatible: results.filter(r => r.result.compatible).length
    });
    
    return results;
  }
  
  /**
   * Check if two tools can be chained
   * @private
   */
  canChainTools(tool1, tool2) {
    // Simple heuristic: check if tool1 output has any fields that match tool2 input
    if (!tool1.outputSchema || !tool2.inputSchema) return false;
    
    const output = tool1.outputSchema.properties || {};
    const input = tool2.inputSchema.properties || {};
    
    // Check for at least one matching field
    for (const field of Object.keys(output)) {
      if (field in input) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Generate compatible input for a schema
   * @private
   */
  generateCompatibleInput(schema) {
    // Use TestDataGenerator
    const { generateTestDataFromSchema } = require('./utils/TestDataGenerator.js');
    const validData = generateTestDataFromSchema(schema, 'valid');
    return validData[0] || {};
  }
  
  /**
   * Generate comprehensive report
   * @private
   */
  async generateComprehensiveReport(results) {
    return this.reportGenerator.generateComprehensiveReport({
      modules: results.modules,
      validation: results.validation,
      tests: results.tests,
      integration: results.integration,
      timestamp: results.timestamp,
      duration: results.duration
    });
  }
  
  /**
   * Test modules concurrently with controlled concurrency
   * @param {Array} modules - Modules to test
   * @param {number} concurrency - Maximum concurrent tests
   * @returns {Array} Test results
   */
  async testModulesConcurrently(modules, concurrency = 5) {
    const results = [];
    const queue = [...modules];
    const inProgress = new Set();
    
    while (queue.length > 0 || inProgress.size > 0) {
      // Start new tests up to concurrency limit
      while (inProgress.size < concurrency && queue.length > 0) {
        const module = queue.shift();
        const promise = this.testModule(module).then(result => {
          inProgress.delete(promise);
          results.push(result);
          return result;
        }).catch(error => {
          inProgress.delete(promise);
          results.push({ module: module.info.name, error: error.message });
        });
        
        inProgress.add(promise);
      }
      
      // Wait for at least one to complete
      if (inProgress.size > 0) {
        await Promise.race(inProgress);
      }
    }
    
    return results;
  }
  
  /**
   * Test a single module
   * @private
   */
  async testModule(module) {
    const moduleResults = {
      name: module.info.name,
      tools: []
    };
    
    for (const tool of module.tools) {
      const testResult = await this.testSingleTool(module, tool);
      moduleResults.tools.push(testResult);
    }
    
    return moduleResults;
  }
  
  /**
   * Watch for changes and re-test
   * @param {Object} options - Watch options
   */
  async watchAndTest(options = {}) {
    const { watch } = await import('chokidar');
    
    const watcher = watch('packages/**/*Module.js', {
      ignored: ['**/node_modules/**', '**/__tests__/**'],
      persistent: true
    });
    
    watcher.on('change', async (path) => {
      this.emit('watch:change', { path });
      
      try {
        // Reload and test the changed module
        const moduleInfo = { path, name: path.split('/').pop().replace('.js', '') };
        const moduleInstance = await this.moduleLoader.loadModule(path, { forceReload: true });
        const module = {
          info: moduleInfo,
          instance: moduleInstance,
          metadata: await this.moduleLoader.getModuleMetadata(moduleInstance),
          tools: await this.moduleLoader.getTools(moduleInstance)
        };
        
        // Test the module
        const result = await this.testModule(module);
        
        this.emit('watch:tested', { path, result });
      } catch (error) {
        this.emit('watch:error', { path, error: error.message });
      }
    });
    
    this.emit('watch:start');
    
    return watcher;
  }
  
  /**
   * Get test summary
   * @returns {Object} Summary of all test results
   */
  getTestSummary() {
    const summary = {
      modules: {
        total: this.results.modules.length,
        tested: this.results.tests.length
      },
      validation: {
        modules: this.results.validation?.summary || {},
        tools: this.results.validation?.tools?.length || 0
      },
      tests: {
        total: 0,
        passed: 0,
        failed: 0,
        errors: 0
      },
      integration: {
        total: this.results.integration?.length || 0,
        compatible: 0
      }
    };
    
    // Aggregate test results
    for (const test of this.results.tests) {
      if (test.summary) {
        summary.tests.total += test.summary.total;
        summary.tests.passed += test.summary.passed;
        summary.tests.failed += test.summary.failed;
        summary.tests.errors += test.summary.errors || 0;
      }
    }
    
    // Count compatible integrations
    if (this.results.integration) {
      summary.integration.compatible = this.results.integration.filter(
        r => r.result && r.result.compatible
      ).length;
    }
    
    return summary;
  }
  
  /**
   * Clear all cached results
   */
  clearResults() {
    this.results = {
      modules: [],
      tools: [],
      validation: [],
      tests: [],
      integration: [],
      timestamp: null,
      duration: 0
    };
    
    this.metadataManager.clearCache();
    this.toolValidator.clearCache();
    this.toolTester.clearResults();
  }
}

export default TestRunner;