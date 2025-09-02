#!/usr/bin/env node
/**
 * Tool Registry Validation Script
 * Comprehensive diagnostic tool to validate module and tool integrity
 * 
 * This script will:
 * 1. Scan all modules in database
 * 2. Attempt to load each module and verify proper Module instance
 * 3. Load each tool from each module and verify Tool instance
 * 4. Generate detailed report of failures
 * 5. Provide repair suggestions
 * 6. Option to remove broken entries
 */

import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '../src/index.js';
import { Tool } from '../src/core/Tool.js';
import { Module } from '../src/core/Module.js';

class ToolRegistryValidator {
  constructor() {
    this.resourceManager = null;
    this.toolRegistry = null;
    this.results = {
      modules: {
        total: 0,
        valid: 0,
        invalid: 0,
        details: []
      },
      tools: {
        total: 0,
        valid: 0,
        invalid: 0,
        details: []
      }
    };
  }

  async initialize() {
    console.log('🚀 Initializing Tool Registry Validator...');
    
    this.resourceManager = await ResourceManager.getInstance();
    this.toolRegistry = await getToolRegistry();
    
    console.log('✅ Tool Registry Validator initialized');
  }

  async validateAllModules() {
    console.log('\n📦 Phase 1: Validating All Modules in Database');
    
    try {
      // Get all modules from database
      const moduleService = this.toolRegistry.serviceOrchestrator.moduleService;
      const databaseService = moduleService.databaseService;
      
      // List all modules in module-registry collection
      const modules = await databaseService.listModules();
      
      console.log(`Found ${modules.length} modules in database`);
      this.results.modules.total = modules.length;
      
      for (let i = 0; i < modules.length; i++) {
        const moduleDoc = modules[i];
        console.log(`\n--- Module ${i + 1}/${modules.length}: ${moduleDoc.name} ---`);
        
        await this.validateSingleModule(moduleDoc);
      }
      
      console.log(`\n📊 Module Validation Summary:`);
      console.log(`   Total: ${this.results.modules.total}`);
      console.log(`   Valid: ${this.results.modules.valid}`);
      console.log(`   Invalid: ${this.results.modules.invalid}`);
      
    } catch (error) {
      console.error('❌ Error during module validation:', error.message);
    }
  }

  async validateSingleModule(moduleDoc) {
    const moduleResult = {
      name: moduleDoc.name,
      id: moduleDoc._id?.toString(),
      path: moduleDoc.path,
      isValid: false,
      error: null,
      loadTime: null,
      isModuleInstance: false,
      toolsCount: 0,
      validTools: 0,
      invalidTools: 0,
      toolDetails: []
    };

    try {
      console.log(`  📋 Name: ${moduleDoc.name}`);
      console.log(`  🆔 ID: ${moduleDoc._id}`);
      console.log(`  📁 Path: ${moduleDoc.path}`);
      
      // Attempt to load the module
      const startTime = Date.now();
      
      const module = await this.toolRegistry.serviceOrchestrator.moduleService.getModuleById(moduleDoc._id);
      
      const loadTime = Date.now() - startTime;
      moduleResult.loadTime = loadTime;
      
      console.log(`  ⏱️  Load time: ${loadTime}ms`);
      
      if (module) {
        console.log(`  ✅ Module loaded successfully`);
        console.log(`  🏗️  Constructor: ${module.constructor.name}`);
        console.log(`  📱 Is Module instance: ${module instanceof Module}`);
        
        moduleResult.isModuleInstance = module instanceof Module;
        moduleResult.isValid = true;
        this.results.modules.valid++;
        
        // Validate tools in this module
        await this.validateModuleTools(module, moduleResult);
        
      } else {
        console.log(`  ❌ Module loading returned null/undefined`);
        moduleResult.error = 'Module loading returned null';
        this.results.modules.invalid++;
      }
      
    } catch (error) {
      console.log(`  ❌ Module loading failed: ${error.message}`);
      moduleResult.error = error.message;
      this.results.modules.invalid++;
    }
    
    this.results.modules.details.push(moduleResult);
  }

  async validateModuleTools(module, moduleResult) {
    console.log(`\n  🔧 Validating tools in module: ${module.name}`);
    
    try {
      // Get tool metadata from module
      const toolMetadata = module.getAvailableTools();
      console.log(`  📊 Module reports ${toolMetadata.length} tools`);
      
      moduleResult.toolsCount = toolMetadata.length;
      this.results.tools.total += toolMetadata.length;
      
      for (const toolMeta of toolMetadata) {
        const toolResult = await this.validateSingleTool(module, toolMeta);
        moduleResult.toolDetails.push(toolResult);
        
        if (toolResult.isValid) {
          moduleResult.validTools++;
          this.results.tools.valid++;
        } else {
          moduleResult.invalidTools++;
          this.results.tools.invalid++;
        }
      }
      
      console.log(`  ✅ Valid tools: ${moduleResult.validTools}/${moduleResult.toolsCount}`);
      
    } catch (error) {
      console.log(`  ❌ Error validating tools: ${error.message}`);
      moduleResult.error = `Tool validation failed: ${error.message}`;
    }
  }

  async validateSingleTool(module, toolMeta) {
    const toolResult = {
      name: toolMeta.name,
      isValid: false,
      error: null,
      isToolInstance: false,
      hasExecuteMethod: false,
      hasProperSchema: false
    };

    try {
      console.log(`    🔧 Validating tool: ${toolMeta.name}`);
      
      // Create tool instance using module
      const tool = new Tool(module, toolMeta.name);
      
      console.log(`    ✅ Tool created successfully`);
      console.log(`    🏗️  Constructor: ${tool.constructor.name}`);
      console.log(`    📱 Is Tool instance: ${tool instanceof Tool}`);
      console.log(`    ⚙️  Has execute method: ${typeof tool.execute === 'function'}`);
      
      toolResult.isToolInstance = tool instanceof Tool;
      toolResult.hasExecuteMethod = typeof tool.execute === 'function';
      toolResult.hasProperSchema = !!(tool.inputSchema && tool.outputSchema);
      
      if (toolResult.isToolInstance && toolResult.hasExecuteMethod && toolResult.hasProperSchema) {
        toolResult.isValid = true;
        console.log(`    ✅ Tool is fully valid`);
      } else {
        console.log(`    ⚠️  Tool has issues:`);
        if (!toolResult.isToolInstance) console.log(`         - Not a Tool instance`);
        if (!toolResult.hasExecuteMethod) console.log(`         - Missing execute method`);
        if (!toolResult.hasProperSchema) console.log(`         - Missing proper schemas`);
      }
      
    } catch (error) {
      console.log(`    ❌ Tool validation failed: ${error.message}`);
      toolResult.error = error.message;
    }
    
    return toolResult;
  }

  async validateSearchConsistency() {
    console.log('\n🔍 Phase 2: Validating Search Consistency');
    
    const testQueries = ['javascript', 'file', 'write', 'http', 'database'];
    
    for (const query of testQueries) {
      console.log(`\n--- Testing search query: "${query}" ---`);
      
      try {
        const searchResults = await this.toolRegistry.searchTools(query, { limit: 10 });
        console.log(`  📊 Search found ${searchResults.length} results`);
        
        let validCount = 0;
        let invalidCount = 0;
        
        for (const result of searchResults) {
          if (result.tool && result.tool instanceof Tool) {
            validCount++;
            console.log(`    ✅ ${result.name} - Valid Tool instance`);
          } else {
            invalidCount++;
            console.log(`    ❌ ${result.name} - Invalid Tool (${typeof result.tool})`);
          }
        }
        
        console.log(`  📈 Consistency: ${validCount}/${searchResults.length} (${Math.round((validCount / searchResults.length) * 100)}%)`);
        
        if (invalidCount > 0) {
          console.log(`  ⚠️  CONSISTENCY VIOLATION: ${invalidCount} invalid tools returned by search`);
        }
        
      } catch (error) {
        console.log(`  ❌ Search failed for "${query}": ${error.message}`);
      }
    }
  }

  async generateReport() {
    console.log('\n📋 Generating Comprehensive Validation Report');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        modules: this.results.modules,
        tools: this.results.tools
      },
      issues: {
        brokenModules: [],
        brokenTools: [],
        suggestions: []
      }
    };

    // Identify broken modules
    for (const moduleDetail of this.results.modules.details) {
      if (!moduleDetail.isValid || !moduleDetail.isModuleInstance) {
        report.issues.brokenModules.push({
          name: moduleDetail.name,
          path: moduleDetail.path,
          error: moduleDetail.error,
          isModuleInstance: moduleDetail.isModuleInstance
        });
      }
    }

    // Identify broken tools
    for (const moduleDetail of this.results.modules.details) {
      for (const toolDetail of moduleDetail.toolDetails) {
        if (!toolDetail.isValid) {
          report.issues.brokenTools.push({
            toolName: toolDetail.name,
            moduleName: moduleDetail.name,
            error: toolDetail.error,
            isToolInstance: toolDetail.isToolInstance,
            hasExecuteMethod: toolDetail.hasExecuteMethod
          });
        }
      }
    }

    // Generate suggestions
    if (report.issues.brokenModules.length > 0) {
      report.issues.suggestions.push(
        `Fix ${report.issues.brokenModules.length} broken modules - ensure they extend Module base class`
      );
    }

    if (report.issues.brokenTools.length > 0) {
      report.issues.suggestions.push(
        `Fix ${report.issues.brokenTools.length} broken tools - ensure proper Tool instantiation`
      );
    }

    // Save report
    const reportPath = `/tmp/tool-registry-validation-${Date.now()}.json`;
    const fs = await import('fs/promises');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n✅ Report saved to: ${reportPath}`);
    
    // Display summary
    this.displaySummary(report);
    
    return report;
  }

  displaySummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n📦 MODULES:`);
    console.log(`   Total: ${report.summary.modules.total}`);
    console.log(`   Valid: ${report.summary.modules.valid}`);
    console.log(`   Invalid: ${report.summary.modules.invalid}`);
    
    console.log(`\n🔧 TOOLS:`);
    console.log(`   Total: ${report.summary.tools.total}`);
    console.log(`   Valid: ${report.summary.tools.valid}`);
    console.log(`   Invalid: ${report.summary.tools.invalid}`);
    
    if (report.issues.brokenModules.length > 0) {
      console.log(`\n❌ BROKEN MODULES (${report.issues.brokenModules.length}):`);
      report.issues.brokenModules.forEach(module => {
        console.log(`   - ${module.name}: ${module.error}`);
      });
    }
    
    if (report.issues.brokenTools.length > 0) {
      console.log(`\n❌ BROKEN TOOLS (${report.issues.brokenTools.length}):`);
      report.issues.brokenTools.forEach(tool => {
        console.log(`   - ${tool.moduleName}::${tool.toolName}: ${tool.error}`);
      });
    }
    
    if (report.issues.suggestions.length > 0) {
      console.log(`\n💡 SUGGESTIONS:`);
      report.issues.suggestions.forEach((suggestion, idx) => {
        console.log(`   ${idx + 1}. ${suggestion}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }

  async run() {
    console.log('🔍 Tool Registry Comprehensive Validation');
    console.log('==========================================');
    
    try {
      await this.initialize();
      await this.validateAllModules();
      await this.validateSearchConsistency();
      const report = await this.generateReport();
      
      // Exit with error code if issues found
      const hasIssues = report.issues.brokenModules.length > 0 || report.issues.brokenTools.length > 0;
      
      if (hasIssues) {
        console.log('\n❌ Validation completed with issues found');
        process.exit(1);
      } else {
        console.log('\n✅ Validation completed successfully - no issues found');
        process.exit(0);
      }
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ToolRegistryValidator();
  await validator.run();
}

export { ToolRegistryValidator };