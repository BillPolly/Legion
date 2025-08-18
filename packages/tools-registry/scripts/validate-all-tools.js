#!/usr/bin/env node

/**
 * Tool Validation Script
 * 
 * Validates all modules and tools in the database:
 * - Schema validation
 * - Implementation validation
 * - Database consistency
 * - Dependency checks
 */

import { ComprehensiveValidator } from '../src/validation/ComprehensiveValidator.js';
import chalk from 'chalk';

async function main() {
  console.log(chalk.blue.bold('\n✅ Tool Validation Script\n'));
  console.log(chalk.gray('Validating all modules and tools...\n'));
  
  try {
    const validator = new ComprehensiveValidator({
      verbose: true
    });
    
    const results = await validator.validateAllModules();
    
    console.log(chalk.blue.bold('\n📊 Validation Results\n'));
    
    // Module results
    console.log(chalk.cyan('Modules:'));
    console.log(chalk.white(`   Total: ${results.modules.total}`));
    console.log(chalk.green(`   ✅ Validated: ${results.modules.validated}`));
    console.log(chalk.yellow(`   ⚠️  Warnings: ${results.modules.warnings}`));
    console.log(chalk.red(`   ❌ Failed: ${results.modules.failed}`));
    
    // Tool results
    console.log(chalk.cyan('\nTools:'));
    console.log(chalk.white(`   Total: ${results.tools.total}`));
    console.log(chalk.green(`   ✅ Schema valid: ${results.tools.schemaValid}`));
    console.log(chalk.green(`   ✅ Executable: ${results.tools.executableValid}`));
    console.log(chalk.green(`   ✅ DB consistent: ${results.tools.databaseConsistent}`));
    console.log(chalk.red(`   ❌ Failed: ${results.tools.failed}`));
    
    // Generate report
    const report = validator.generateReport();
    
    if (report.recommendations.length > 0) {
      console.log(chalk.yellow('\n💡 Recommendations:'));
      report.recommendations.forEach(rec => {
        console.log(chalk.gray(`   • ${rec}`));
      });
    }
    
    // Success rate
    const moduleSuccessRate = results.modules.total > 0 
      ? ((results.modules.validated / results.modules.total) * 100).toFixed(1)
      : 0;
    const toolSuccessRate = results.tools.total > 0
      ? ((results.tools.executableValid / results.tools.total) * 100).toFixed(1)
      : 0;
    
    console.log(chalk.blue('\n📈 Success Rates:'));
    console.log(chalk.white(`   Modules: ${moduleSuccessRate}%`));
    console.log(chalk.white(`   Tools: ${toolSuccessRate}%`));
    
    if (results.modules.failed > 0 || results.tools.failed > 0) {
      console.log(chalk.yellow('\n⚠️ Some validations failed. Check the database for details.'));
      process.exit(1);
    } else {
      console.log(chalk.green.bold('\n✅ All validations passed!\n'));
    }
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Validation failed:'), error);
    console.error(chalk.red(error.stack));
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(chalk.red.bold('❌ Fatal error:'), error);
  process.exit(1);
});