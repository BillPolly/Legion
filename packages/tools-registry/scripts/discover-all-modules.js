#!/usr/bin/env node

/**
 * Module Discovery Script
 * 
 * Scans the entire repository for modules and registers them in the database.
 * This should be run when new modules are added to the codebase.
 */

import { ModuleDiscovery } from '../src/loading/ModuleDiscovery.js';
import chalk from 'chalk';

async function main() {
  console.log(chalk.blue.bold('\n🔍 Module Discovery Script\n'));
  console.log(chalk.gray('Scanning repository for all available modules...\n'));
  
  try {
    const discovery = new ModuleDiscovery({
      verbose: true
    });
    
    const result = await discovery.discover();
    
    console.log(chalk.green.bold('\n✅ Discovery Complete!\n'));
    console.log(chalk.white('📊 Summary:'));
    console.log(chalk.white(`   • Files scanned: ${result.stats.scanned}`));
    console.log(chalk.white(`   • Modules discovered: ${result.stats.discovered}`));
    console.log(chalk.white(`   • New registrations: ${result.stats.registered}`));
    console.log(chalk.white(`   • Updates: ${result.stats.updated}`));
    console.log(chalk.white(`   • Failures: ${result.stats.failed}`));
    
    if (result.stats.errors.length > 0) {
      console.log(chalk.yellow('\n⚠️ Issues encountered:'));
      result.stats.errors.forEach(err => {
        console.log(chalk.gray(`   - ${err.module || err.file}: ${err.error}`));
      });
    }
    
    console.log(chalk.blue('\n💡 Next steps:'));
    console.log(chalk.gray('   1. Run "npm run db:validate" to validate all modules'));
    console.log(chalk.gray('   2. Run "npm run db:populate" to load validated modules'));
    console.log(chalk.gray('   3. Check validation report for any issues\n'));
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Discovery failed:'), error);
    console.error(chalk.red(error.stack));
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(chalk.red.bold('❌ Fatal error:'), error);
  process.exit(1);
});