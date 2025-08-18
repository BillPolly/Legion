#!/usr/bin/env node

/**
 * Complete Module Registration Script
 * 
 * Performs the full pipeline:
 * 1. Discovers all modules in repository
 * 2. Registers them in database
 * 3. Loads and validates each module
 * 4. Tests tool execution
 * 5. Generates comprehensive report
 */

import toolRegistry from '../src/index.js';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  console.log(chalk.blue.bold('\n🚀 Complete Module Registration Pipeline\n'));
  console.log(chalk.gray('This will discover, load, validate, and test all modules\n'));
  
  const args = process.argv.slice(2);
  const options = {
    clearFirst: args.includes('--clear'),
    skipValidation: args.includes('--skip-validation'),
    verbose: !args.includes('--quiet'),
    generateReport: !args.includes('--no-report')
  };
  
  if (args.includes('--help')) {
    console.log(`
Options:
  --clear           Clear database before loading
  --skip-validation Skip validation step (faster but less thorough)
  --quiet           Less verbose output
  --no-report       Don't generate final report
  --help            Show this help message
`);
    process.exit(0);
  }
  
  try {
    console.log(chalk.blue('📦 Getting LoadingManager from ToolRegistry...'));
    const loader = await toolRegistry.getLoader();
    loader.verbose = options.verbose;
    
    // Run the enhanced pipeline
    console.log(chalk.blue('\n🔄 Running enhanced pipeline...\n'));
    const result = await loader.enhancedPipeline({
      discover: true,
      validate: !options.skipValidation,
      clearFirst: options.clearFirst,
      includePerspectives: false,
      includeVectors: false,
      onlyValidated: false
    });
    
    // Display results
    console.log(chalk.green.bold('\n✅ Registration Complete!\n'));
    
    // Discovery results
    if (result.discoveryResult) {
      console.log(chalk.cyan('Discovery:'));
      console.log(chalk.white(`   • Files scanned: ${result.discoveryResult.stats.scanned}`));
      console.log(chalk.white(`   • Modules found: ${result.discoveryResult.stats.discovered}`));
      console.log(chalk.white(`   • New registrations: ${result.discoveryResult.stats.registered}`));
      console.log(chalk.white(`   • Updates: ${result.discoveryResult.stats.updated}`));
    }
    
    // Loading results
    if (result.loadResult) {
      console.log(chalk.cyan('\nLoading:'));
      console.log(chalk.white(`   • Modules loaded: ${result.loadResult.modulesLoaded}`));
      console.log(chalk.white(`   • Modules failed: ${result.loadResult.loadResult?.summary.failed || 0}`));
      console.log(chalk.white(`   • Tools added: ${result.loadResult.toolsAdded}`));
    }
    
    // Validation results
    if (result.validationResult) {
      console.log(chalk.cyan('\nValidation:'));
      console.log(chalk.white(`   • Modules validated: ${result.validationResult.modules.validated}`));
      console.log(chalk.white(`   • Modules with warnings: ${result.validationResult.modules.warnings}`));
      console.log(chalk.white(`   • Modules failed: ${result.validationResult.modules.failed}`));
      console.log(chalk.white(`   • Tools validated: ${result.validationResult.tools.executableValid}`));
    }
    
    // Performance
    console.log(chalk.cyan('\nPerformance:'));
    console.log(chalk.white(`   • Total time: ${(result.totalTime / 1000).toFixed(2)}s`));
    
    // Generate detailed report if requested
    if (options.generateReport) {
      const report = await generateDetailedReport(result);
      const reportPath = path.join(process.cwd(), 'MODULE_REGISTRATION_REPORT.md');
      await fs.writeFile(reportPath, report);
      console.log(chalk.green(`\n📄 Detailed report saved to: ${reportPath}`));
    }
    
    // List available tools
    console.log(chalk.blue('\n📋 Available Tools:'));
    const allTools = await toolRegistry.listTools();
    
    // Group by module
    const toolsByModule = {};
    for (const tool of allTools) {
      const moduleName = tool.moduleName || 'Unknown';
      if (!toolsByModule[moduleName]) {
        toolsByModule[moduleName] = [];
      }
      toolsByModule[moduleName].push(tool.name);
    }
    
    // Display grouped tools
    for (const [moduleName, tools] of Object.entries(toolsByModule)) {
      console.log(chalk.cyan(`   ${moduleName}: ${tools.length} tools`));
      if (tools.length <= 5) {
        console.log(chalk.gray(`     → ${tools.join(', ')}`));
      } else {
        console.log(chalk.gray(`     → ${tools.slice(0, 5).join(', ')}, ...`));
      }
    }
    
    console.log(chalk.green.bold('\n✅ All modules registered successfully!\n'));
    
    // Exit with error if validation failed
    if (result.validationResult && result.validationResult.modules.failed > 0) {
      console.log(chalk.yellow('⚠️ Some modules failed validation. Check the report for details.'));
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Registration failed:'), error);
    console.error(chalk.red(error.stack));
    process.exit(1);
  }
}

/**
 * Generate detailed markdown report
 */
async function generateDetailedReport(result) {
  const date = new Date().toISOString().split('T')[0];
  
  let report = `# Module Registration Report\n\n`;
  report += `Date: ${date}\n\n`;
  
  report += `## Summary\n\n`;
  
  if (result.discoveryResult) {
    report += `### Discovery\n`;
    report += `- Files scanned: ${result.discoveryResult.stats.scanned}\n`;
    report += `- Modules discovered: ${result.discoveryResult.stats.discovered}\n`;
    report += `- New registrations: ${result.discoveryResult.stats.registered}\n`;
    report += `- Updates: ${result.discoveryResult.stats.updated}\n`;
    report += `- Failures: ${result.discoveryResult.stats.failed}\n\n`;
  }
  
  if (result.loadResult) {
    report += `### Loading\n`;
    report += `- Modules attempted: ${result.loadResult.loadResult?.summary.total || 0}\n`;
    report += `- Modules loaded: ${result.loadResult.modulesLoaded}\n`;
    report += `- Modules failed: ${result.loadResult.loadResult?.summary.failed || 0}\n`;
    report += `- Tools added: ${result.loadResult.toolsAdded}\n\n`;
    
    if (result.loadResult.loadResult?.failed?.length > 0) {
      report += `#### Failed Modules\n`;
      for (const failure of result.loadResult.loadResult.failed) {
        report += `- **${failure.config.name}**: ${failure.error}\n`;
      }
      report += `\n`;
    }
  }
  
  if (result.validationResult) {
    report += `### Validation\n`;
    report += `- Modules validated: ${result.validationResult.modules.validated}\n`;
    report += `- Modules with warnings: ${result.validationResult.modules.warnings}\n`;
    report += `- Modules failed: ${result.validationResult.modules.failed}\n`;
    report += `- Tools checked: ${result.validationResult.tools.total}\n`;
    report += `- Tools executable: ${result.validationResult.tools.executableValid}\n`;
    report += `- Tools with valid schemas: ${result.validationResult.tools.schemaValid}\n\n`;
  }
  
  report += `## Performance\n`;
  report += `- Total execution time: ${(result.totalTime / 1000).toFixed(2)} seconds\n\n`;
  
  report += `## Recommendations\n`;
  report += `1. Fix any failed modules before using in production\n`;
  report += `2. Review modules with warnings\n`;
  report += `3. Run validation regularly to catch issues early\n`;
  report += `4. Consider adding tests for tools that don't have them\n\n`;
  
  report += `## Next Steps\n`;
  report += `- Run \`npm run test:tools\` to test tool execution\n`;
  report += `- Check individual module logs for detailed error information\n`;
  report += `- Update module documentation as needed\n`;
  
  return report;
}

// Run the script
main().catch(error => {
  console.error(chalk.red.bold('❌ Fatal error:'), error);
  process.exit(1);
});