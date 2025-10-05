#!/usr/bin/env node
/**
 * Example 6: CLI Integration
 *
 * This demonstrates how to use the /reason CLI command for
 * neurosymbolic reasoning from the command line.
 *
 * The /reason command is available in packages/cli and provides:
 * - Natural language question input
 * - Constraint and fact specification via flags
 * - Formatted output with proofs
 *
 * NOTE: This example shows the programmatic equivalent of CLI usage.
 * For actual CLI usage, use: legion /reason "question" --constraint "..." --fact "..."
 *
 * Run: node examples/06-cli-integration.js
 */

import { ReasonCommand } from '../../../cli/src/commands/ReasonCommand.js';
import { ResourceManager } from '@legion/resource-manager';

function printCommandUsage() {
  console.log('='.repeat(80));
  console.log('CLI Command Usage Examples');
  console.log('='.repeat(80));
  console.log('\nCommand Syntax:');
  console.log('  legion /reason "<question>" [--constraint "<constraint>"] [--fact "<fact>"]');
  console.log('\nFlags:');
  console.log('  --constraint  : Add a constraint that must be satisfied');
  console.log('  --fact        : Add a known fact to the reasoning context');
  console.log('\nYou can specify multiple constraints and facts by repeating the flags.');
  console.log();
}

async function simpleQuery(cmd) {
  console.log('\n' + '='.repeat(80));
  console.log('EXAMPLE 1: Simple Query');
  console.log('='.repeat(80));

  const args = ['Is there a number greater than 5?'];

  console.log('\nCommand:');
  console.log(`  legion /reason "${args[0]}"`);

  const result = await cmd.execute(args);

  console.log('\nOutput:');
  console.log(result.message);
}

async function queryWithConstraints(cmd) {
  console.log('\n' + '='.repeat(80));
  console.log('EXAMPLE 2: Query with Constraints');
  console.log('='.repeat(80));

  const args = [
    'Should we deploy to production?',
    '--constraint', 'tests_passing == true',
    '--constraint', 'code_coverage > 80',
    '--constraint', 'no_vulnerabilities == true'
  ];

  console.log('\nCommand:');
  console.log('  legion /reason "Should we deploy to production?" \\');
  console.log('    --constraint "tests_passing == true" \\');
  console.log('    --constraint "code_coverage > 80" \\');
  console.log('    --constraint "no_vulnerabilities == true"');

  const result = await cmd.execute(args);

  console.log('\nOutput:');
  console.log(result.message);
}

async function queryWithFacts(cmd) {
  console.log('\n' + '='.repeat(80));
  console.log('EXAMPLE 3: Query with Facts');
  console.log('='.repeat(80));

  const args = [
    'Is the deployment safe?',
    '--fact', 'tests_passing = true',
    '--fact', 'code_coverage = 85',
    '--fact', 'vulnerabilities_count = 0'
  ];

  console.log('\nCommand:');
  console.log('  legion /reason "Is the deployment safe?" \\');
  console.log('    --fact "tests_passing = true" \\');
  console.log('    --fact "code_coverage = 85" \\');
  console.log('    --fact "vulnerabilities_count = 0"');

  const result = await cmd.execute(args);

  console.log('\nOutput:');
  console.log(result.message);
}

async function queryWithBoth(cmd) {
  console.log('\n' + '='.repeat(80));
  console.log('EXAMPLE 4: Query with Facts and Constraints');
  console.log('='.repeat(80));

  const args = [
    'Can we proceed with deployment?',
    '--fact', 'tests_passing = true',
    '--fact', 'code_coverage = 92',
    '--constraint', 'tests_passing == true',
    '--constraint', 'code_coverage > 80'
  ];

  console.log('\nCommand:');
  console.log('  legion /reason "Can we proceed with deployment?" \\');
  console.log('    --fact "tests_passing = true" \\');
  console.log('    --fact "code_coverage = 92" \\');
  console.log('    --constraint "tests_passing == true" \\');
  console.log('    --constraint "code_coverage > 80"');

  const result = await cmd.execute(args);

  console.log('\nOutput:');
  console.log(result.message);
}

async function complexReasoning(cmd) {
  console.log('\n' + '='.repeat(80));
  console.log('EXAMPLE 5: Complex Multi-Step Reasoning');
  console.log('='.repeat(80));

  const args = [
    'Is x between 10 and 20 and divisible by 3?',
    '--constraint', 'x > 10',
    '--constraint', 'x < 20'
  ];

  console.log('\nCommand:');
  console.log('  legion /reason "Is x between 10 and 20 and divisible by 3?" \\');
  console.log('    --constraint "x > 10" \\');
  console.log('    --constraint "x < 20"');

  const result = await cmd.execute(args);

  console.log('\nOutput:');
  console.log(result.message);
}

async function main() {
  console.log('='.repeat(80));
  console.log('ProofOfThought - CLI Integration Examples');
  console.log('='.repeat(80));

  printCommandUsage();

  try {
    // Initialize command
    console.log('Initializing ReasonCommand...');
    const resourceManager = await ResourceManager.getInstance();
    const cmd = new ReasonCommand(resourceManager);

    // Run examples
    await simpleQuery(cmd);
    await queryWithConstraints(cmd);
    await queryWithFacts(cmd);
    await queryWithBoth(cmd);
    await complexReasoning(cmd);

    console.log('\n' + '='.repeat(80));
    console.log('ALL EXAMPLES COMPLETE');
    console.log('='.repeat(80));
    console.log('\nKey Takeaways:');
    console.log('  • /reason command provides CLI access to ProofOfThought');
    console.log('  • Use --constraint to specify requirements');
    console.log('  • Use --fact to provide known information');
    console.log('  • Combine facts and constraints for complex reasoning');
    console.log('  • Output includes answer, confidence, and proof');
    console.log('\nUsage in Legion CLI:');
    console.log('  $ legion /reason "your question here" --constraint "x > 5" --fact "y = 10"');

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('ERROR');
    console.error('='.repeat(80));
    console.error(`\n${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the example
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
