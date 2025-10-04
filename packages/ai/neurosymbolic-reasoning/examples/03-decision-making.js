#!/usr/bin/env node
/**
 * Example 3: Decision Making with DecisionMakingActor
 *
 * This demonstrates using the DecisionMakingActor for safety-critical
 * decisions with formal proof-based reasoning.
 *
 * Features:
 * - Actor-based decision making
 * - Safety constraint enforcement
 * - Risk assessment
 * - Proof-based explanations
 *
 * Run: node examples/03-decision-making.js
 */

import { DecisionMakingActor } from './DecisionMakingActor.js';
import { ResourceManager } from '@legion/resource-manager';

async function safeDeploymentDecision(actor) {
  console.log('\n' + '='.repeat(80));
  console.log('DECISION 1: Safe Deployment');
  console.log('='.repeat(80));

  const action = 'deploy';
  const context = {
    facts: [
      'tests_passing = true',
      'code_coverage = 95',
      'no_vulnerabilities = true'
    ]
  };

  console.log(`\nAction: ${action}`);
  console.log('Context:');
  context.facts.forEach(f => console.log(`  - ${f}`));

  const result = await actor.decide(action, context);

  console.log(`\nDecision: ${result.allowed ? 'ALLOWED' : 'BLOCKED'}`);
  console.log(`Explanation: ${result.explanation}`);

  return result;
}

async function unsafeDeploymentDecision(actor) {
  console.log('\n' + '='.repeat(80));
  console.log('DECISION 2: Unsafe Deployment (Low Coverage)');
  console.log('='.repeat(80));

  const action = 'deploy';
  const context = {
    facts: [
      'tests_passing = true',
      'code_coverage = 70',  // Below threshold
      'vulnerabilities_count = 0'
    ]
  };

  console.log(`\nAction: ${action}`);
  console.log('Context:');
  context.facts.forEach(f => console.log(`  - ${f}`));

  const result = await actor.decide(action, context);

  console.log(`\nDecision: ${result.allowed ? 'ALLOWED' : 'BLOCKED'}`);
  console.log(`Explanation: ${result.explanation}`);

  if (result.violations && result.violations.length > 0) {
    console.log('\nViolations:');
    result.violations.forEach(v => console.log(`  - ${v}`));
  }

  return result;
}

async function vulnerableDeploymentDecision(actor) {
  console.log('\n' + '='.repeat(80));
  console.log('DECISION 3: Deployment with Vulnerabilities');
  console.log('='.repeat(80));

  const action = 'deploy';
  const context = {
    facts: [
      'tests_passing = true',
      'code_coverage = 90',
      'vulnerabilities_count = 3'  // Has vulnerabilities
    ]
  };

  console.log(`\nAction: ${action}`);
  console.log('Context:');
  context.facts.forEach(f => console.log(`  - ${f}`));

  const result = await actor.decide(action, context);

  console.log(`\nDecision: ${result.allowed ? 'ALLOWED' : 'BLOCKED'}`);
  console.log(`Explanation: ${result.explanation}`);

  return result;
}

async function riskAssessment(actor) {
  console.log('\n' + '='.repeat(80));
  console.log('RISK ASSESSMENT');
  console.log('='.repeat(80));

  const scenarios = [
    {
      name: 'Low Risk',
      facts: [
        'tests_passing = true',
        'code_coverage = 95',
        'no_vulnerabilities = true'
      ]
    },
    {
      name: 'Medium Risk',
      facts: [
        'tests_passing = true',
        'code_coverage = 75',
        'vulnerabilities_count = 1'
      ]
    },
    {
      name: 'High Risk',
      facts: [
        'tests_passing = false',
        'code_coverage = 60',
        'vulnerabilities_count = 5'
      ]
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n${scenario.name} Scenario:`);
    console.log('Facts:');
    scenario.facts.forEach(f => console.log(`  - ${f}`));

    const risk = await actor.evaluateRisk(scenario.facts);

    console.log(`Risk Level: ${risk.level.toUpperCase()}`);
    console.log(`Risk Score: ${(risk.score * 100).toFixed(0)}%`);
    console.log(`Explanation: ${risk.explanation}`);
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('ProofOfThought - Decision Making Actor Examples');
  console.log('='.repeat(80));

  try {
    // Initialize actor
    console.log('\nInitializing DecisionMakingActor...');
    const resourceManager = await ResourceManager.getInstance();
    const actor = new DecisionMakingActor(resourceManager);

    console.log('Safety Constraints:');
    actor.safetyConstraints.forEach(c => console.log(`  - ${c}`));

    // Run decision scenarios
    await safeDeploymentDecision(actor);
    await unsafeDeploymentDecision(actor);
    await vulnerableDeploymentDecision(actor);

    // Run risk assessments
    await riskAssessment(actor);

    console.log('\n' + '='.repeat(80));
    console.log('ALL DECISIONS COMPLETE');
    console.log('='.repeat(80));
    console.log('\nKey Takeaways:');
    console.log('  • DecisionMakingActor enforces safety constraints');
    console.log('  • Provides formal proofs for decisions');
    console.log('  • Evaluates risk based on constraint violations');
    console.log('  • Useful for autonomous agent safety');

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
