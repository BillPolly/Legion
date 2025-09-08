#!/usr/bin/env node

/**
 * AgentCreator Demo - Complete Single Entry Point for Agent Creation
 * 
 * This demonstrates the consolidated AgentCreator that combines:
 * - Agent design from requirements
 * - Template-based generation
 * - Prompt optimization
 * - Testing and validation
 * - Analysis and refinement
 * - Batch operations
 * - Export to multiple formats
 */

import { AgentCreator } from '../src/AgentCreator.js';
import { ResourceManager } from '../../../resource-manager/src/index.js';

async function demonstrateAgentCreator() {
  console.log('🚀 AgentCreator Demo - Complete Single Entry Point\n');
  console.log('=' + '='.repeat(60) + '\n');

  try {
    // Initialize ResourceManager
    console.log('📦 Initializing ResourceManager...');
    const resourceManager = await ResourceManager.getInstance();
    console.log('✅ ResourceManager ready\n');

    // Create AgentCreator - the single entry point
    console.log('🔧 Creating AgentCreator (single entry point)...');
    const agentCreator = new AgentCreator(resourceManager);
    await agentCreator.initialize();
    console.log('✅ AgentCreator ready\n');

    // ============================================================
    // 1. CREATE AGENT FROM REQUIREMENTS
    // ============================================================
    console.log('📋 1. Creating Agent from Requirements\n');
    console.log('-'.repeat(40));
    
    const requirements = {
      purpose: 'Create a helpful customer support agent for technical issues',
      taskType: 'conversational',
      capabilities: [
        'answer technical questions',
        'provide step-by-step solutions',
        'escalate complex issues'
      ],
      testCases: [
        {
          name: 'Greeting',
          input: 'Hello, I need help',
          expectedPatterns: ['hello', 'help', 'assist']
        },
        {
          name: 'Technical',
          input: 'My computer won\'t start',
          expectedPatterns: ['troubleshoot', 'check', 'try']
        }
      ],
      autoRefine: true
    };

    const result = await agentCreator.createAgent(requirements);
    console.log(`\n✅ Agent created: ${result.agentName} (${result.agentId})`);
    console.log(`   Tests passed: ${result.testsPassed}`);
    console.log(`   Registration ID: ${result.registrationId}\n`);

    // ============================================================
    // 2. GENERATE FROM TEMPLATE
    // ============================================================
    console.log('📋 2. Generating Agent from Template\n');
    console.log('-'.repeat(40));
    
    // List available templates
    const templates = agentCreator.listTemplates();
    console.log('Available templates:');
    templates.forEach(t => {
      console.log(`  - ${t.name} (${t.type}): ${t.description}`);
    });
    
    // Generate from template
    const templateConfig = await agentCreator.generateFromTemplate('customer-support', {
      companyName: 'TechCorp',
      productName: 'CloudSuite'
    });
    console.log(`\n✅ Generated from template: ${templateConfig.agent.name}\n`);

    // ============================================================
    // 3. ANALYZE AGENT CONFIGURATION
    // ============================================================
    console.log('📋 3. Analyzing Agent Configuration\n');
    console.log('-'.repeat(40));
    
    const analysis = await agentCreator.analyzeAgent(templateConfig);
    console.log(`Configuration Score: ${analysis.score}/100`);
    console.log('Issues found:', analysis.issues.length);
    console.log('Recommendations:', analysis.recommendations.join(', '));
    console.log('Suggestions:', analysis.suggestions.slice(0, 2).join('; '));
    console.log();

    // ============================================================
    // 4. OPTIMIZE PROMPTS
    // ============================================================
    console.log('📋 4. Optimizing Agent Prompts\n');
    console.log('-'.repeat(40));
    
    const optimizationResult = await agentCreator.optimizePrompts(templateConfig);
    console.log('Optimizations applied:');
    optimizationResult.optimizations.forEach(opt => {
      console.log(`  - ${opt.type}: reduced by ${opt.reduction} characters`);
    });
    console.log();

    // ============================================================
    // 5. VALIDATE CONFIGURATION
    // ============================================================
    console.log('📋 5. Validating Configuration\n');
    console.log('-'.repeat(40));
    
    const validation = agentCreator.validateConfig(optimizationResult.config);
    console.log(`Valid: ${validation.valid}`);
    if (validation.errors.length > 0) {
      console.log('Errors:', validation.errors.join('; '));
    }
    if (validation.warnings.length > 0) {
      console.log('Warnings:', validation.warnings.join('; '));
    }
    console.log();

    // ============================================================
    // 6. BATCH DESIGN
    // ============================================================
    console.log('📋 6. Batch Agent Design\n');
    console.log('-'.repeat(40));
    
    const batchRequirements = [
      { purpose: 'Create a code review assistant', taskType: 'analytical' },
      { purpose: 'Create a content writer', taskType: 'creative' },
      { purpose: 'Create a data analyst', taskType: 'analytical' }
    ];
    
    const batchResults = await agentCreator.designBatch(batchRequirements);
    console.log(`Batch processing complete:`);
    console.log(`  Total: ${batchResults.totalProcessed}`);
    console.log(`  Success: ${batchResults.successCount}`);
    console.log(`  Errors: ${batchResults.errorCount}`);
    console.log();

    // ============================================================
    // 7. EXPORT CONFIGURATIONS
    // ============================================================
    console.log('📋 7. Exporting Configurations\n');
    console.log('-'.repeat(40));
    
    // Export to JSON
    const jsonExport = agentCreator.exportConfig(templateConfig, 'json');
    console.log('JSON export (first 200 chars):');
    console.log(jsonExport.substring(0, 200) + '...\n');
    
    // Export to YAML
    const yamlExport = agentCreator.exportConfig(templateConfig, 'yaml');
    console.log('YAML export (first 200 chars):');
    console.log(yamlExport.substring(0, 200) + '...\n');
    
    // Export to TypeScript
    const tsExport = agentCreator.exportConfig(templateConfig, 'typescript');
    console.log('TypeScript export (first 300 chars):');
    console.log(tsExport.substring(0, 300) + '...\n');

    // ============================================================
    // 8. GENERATE COMPREHENSIVE REPORT
    // ============================================================
    console.log('📋 8. Generating Agent Report\n');
    console.log('-'.repeat(40));
    
    if (result.agentId) {
      const report = await agentCreator.generateAgentReport(result.agentId);
      console.log('Agent Report:');
      console.log(`  Name: ${report.agent.name}`);
      console.log(`  Type: ${report.agent.type}`);
      console.log(`  Score: ${report.analysis.score}/100`);
      console.log(`  Test Status: ${report.testing.passed ? 'PASSED' : 'FAILED'}`);
      console.log();
    }

    // ============================================================
    // 9. LIST CREATED AGENTS
    // ============================================================
    console.log('📋 9. Listing All Created Agents\n');
    console.log('-'.repeat(40));
    
    const createdAgents = agentCreator.listCreatedAgents();
    console.log(`Total agents created: ${createdAgents.length}`);
    createdAgents.forEach(agent => {
      console.log(`  - ${agent.name} (${agent.id})`);
      console.log(`    Tests: ${agent.testsPassed ? '✅' : '❌'}`);
      console.log(`    Registration: ${agent.registrationId}`);
    });
    console.log();

    // ============================================================
    // 10. ADD CUSTOM TEMPLATE
    // ============================================================
    console.log('📋 10. Adding Custom Template\n');
    console.log('-'.repeat(40));
    
    agentCreator.addTemplate('devops-assistant', {
      type: 'task',
      basePrompt: 'You are a DevOps assistant for {teamName}. You help with CI/CD, infrastructure, and deployment.',
      capabilities: ['deploy applications', 'monitor systems', 'troubleshoot infrastructure'],
      tools: ['code_execution', 'file_operations', 'web_search']
    });
    
    console.log('✅ Custom template added: devops-assistant');
    console.log(`Total templates available: ${agentCreator.listTemplates().length}\n`);

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('=' + '='.repeat(60));
    console.log('\n✨ AgentCreator Capabilities Demonstrated:\n');
    console.log('  ✅ Single entry point for all agent operations');
    console.log('  ✅ Create agents from requirements');
    console.log('  ✅ Generate from templates');
    console.log('  ✅ Test and validate agents');
    console.log('  ✅ Analyze and optimize configurations');
    console.log('  ✅ Batch operations');
    console.log('  ✅ Export to multiple formats');
    console.log('  ✅ Comprehensive reporting');
    console.log('  ✅ Extensible template system');
    console.log('\n🎉 AgentCreator is the complete solution for agent lifecycle management!\n');

    // Cleanup
    await agentCreator.cleanup();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the demo
demonstrateAgentCreator().catch(console.error);