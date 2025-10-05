#!/usr/bin/env node
/**
 * Example 2: Constraint Verification
 *
 * This demonstrates using ProofOfThought to verify claims against
 * facts and constraints - useful for safety-critical decisions.
 *
 * Scenarios covered:
 * - Deployment safety checks
 * - Transaction validation
 * - Constraint violation detection
 *
 * Run: node examples/02-constraint-verification.js
 */

import { ProofOfThought } from '../src/index.js';
import { ResourceManager } from '@legion/resource-manager';

async function deploymentSafety(pot) {
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 1: Deployment Safety Check');
  console.log('='.repeat(80));

  const claim = "Deployment to production is safe";
  const facts = [
    "tests_passing = true",
    "code_coverage = 76",
    "no_critical_vulnerabilities = true"
  ];
  const constraints = [
    "tests_passing == true",
    "code_coverage > 80",
    "no_critical_vulnerabilities == true"
  ];

  console.log(`\nClaim: "${claim}"`);
  console.log('\nFacts:');
  facts.forEach(f => console.log(`  - ${f}`));
  console.log('\nConstraints:');
  constraints.forEach(c => console.log(`  - ${c}`));

  const result = await pot.verify(claim, facts, constraints);

  console.log('\nResult:');
  console.log(`  Valid: ${result.valid}`);
  console.log(`  Violations: ${result.violations.length > 0 ? result.violations.join(', ') : 'None'}`);

  if (result.valid) {
    console.log('\n✅ DEPLOYMENT APPROVED - All constraints satisfied');
  } else {
    console.log('\n❌ DEPLOYMENT BLOCKED - Constraint violations detected');
    console.log('\nBlocked because:');
    console.log('  - Code coverage (76%) is below required threshold (80%)');
  }

  return result;
}

async function transactionValidation(pot) {
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 2: Transaction Validation');
  console.log('='.repeat(80));

  const claim = "This transaction is safe to process";
  const facts = [
    "transaction_amount = 1000",
    "user_balance = 500",
    "transaction_verified = true"
  ];
  const constraints = [
    "transaction_amount <= user_balance",
    "transaction_verified == true"
  ];

  console.log(`\nClaim: "${claim}"`);
  console.log('\nFacts:');
  facts.forEach(f => console.log(`  - ${f}`));
  console.log('\nConstraints:');
  constraints.forEach(c => console.log(`  - ${c}`));

  const result = await pot.verify(claim, facts, constraints);

  console.log('\nResult:');
  console.log(`  Valid: ${result.valid}`);
  console.log(`  Violations: ${result.violations.length > 0 ? result.violations.join(', ') : 'None'}`);

  if (result.valid) {
    console.log('\n✅ TRANSACTION APPROVED');
  } else {
    console.log('\n❌ TRANSACTION REJECTED');
    console.log('\nRejected because:');
    console.log('  - Transaction amount ($1000) exceeds user balance ($500)');
  }

  return result;
}

async function validDeployment(pot) {
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 3: Valid Deployment (All Constraints Satisfied)');
  console.log('='.repeat(80));

  const claim = "Deployment to production is safe";
  const facts = [
    "tests_passing = true",
    "code_coverage = 95",
    "no_critical_vulnerabilities = true"
  ];
  const constraints = [
    "tests_passing == true",
    "code_coverage > 80",
    "no_critical_vulnerabilities == true"
  ];

  console.log(`\nClaim: "${claim}"`);
  console.log('\nFacts:');
  facts.forEach(f => console.log(`  - ${f}`));
  console.log('\nConstraints:');
  constraints.forEach(c => console.log(`  - ${c}`));

  const result = await pot.verify(claim, facts, constraints);

  console.log('\nResult:');
  console.log(`  Valid: ${result.valid}`);
  console.log(`  Violations: ${result.violations.length > 0 ? result.violations.join(', ') : 'None'}`);

  if (result.valid) {
    console.log('\n✅ DEPLOYMENT APPROVED - All safety checks passed');
  } else {
    console.log('\n❌ DEPLOYMENT BLOCKED');
  }

  return result;
}

async function main() {
  console.log('='.repeat(80));
  console.log('ProofOfThought - Constraint Verification Examples');
  console.log('='.repeat(80));

  try {
    // Initialize
    console.log('\nInitializing ProofOfThought...');
    const resourceManager = await ResourceManager.getInstance();
    const llmClient = await resourceManager.get('llmClient');
    const pot = new ProofOfThought(llmClient);

    // Run scenarios
    await deploymentSafety(pot);
    await transactionValidation(pot);
    await validDeployment(pot);

    console.log('\n' + '='.repeat(80));
    console.log('ALL SCENARIOS COMPLETE');
    console.log('='.repeat(80));
    console.log('\nKey Takeaways:');
    console.log('  • verify() checks claims against facts and constraints');
    console.log('  • Returns valid: true/false with proof');
    console.log('  • Identifies specific constraint violations');
    console.log('  • Useful for safety-critical decision making');

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('ERROR');
    console.error('='.repeat(80));
    console.error(`\n${error.message}`);
    process.exit(1);
  }
}

// Run the example
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
