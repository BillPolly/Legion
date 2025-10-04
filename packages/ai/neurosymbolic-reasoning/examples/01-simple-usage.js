#!/usr/bin/env node
/**
 * Example 1: Simple Usage of ProofOfThought API
 *
 * This demonstrates the most basic usage pattern:
 * - Initialize ProofOfThought with LLM client from ResourceManager
 * - Ask a natural language question
 * - Get answer with formal proof
 *
 * Run: node examples/01-simple-usage.js
 */

import { ProofOfThought } from '../src/index.js';
import { ResourceManager } from '@legion/resource-manager';

async function main() {
  console.log('='.repeat(80));
  console.log('ProofOfThought - Simple Usage Example');
  console.log('='.repeat(80));
  console.log();

  // Get ResourceManager and LLM client
  console.log('Initializing ResourceManager...');
  const resourceManager = await ResourceManager.getInstance();
  const llmClient = await resourceManager.get('llmClient');

  // Create ProofOfThought instance
  console.log('Creating ProofOfThought instance...');
  const pot = new ProofOfThought(llmClient);

  // Ask a question requiring logical reasoning
  const question = "Would a Democrat politician publicly denounce abortion?";

  console.log(`\nQuestion: ${question}`);
  console.log('\nProcessing...');
  console.log('  1. LLM generates Z3 program from question');
  console.log('  2. Z3 theorem prover solves constraints');
  console.log('  3. Verifier extracts formal proof');
  console.log();

  try {
    const result = await pot.query(question);

    // Display results
    console.log('='.repeat(80));
    console.log('RESULTS');
    console.log('='.repeat(80));
    console.log(`\nAnswer: ${result.answer}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);

    if (result.model) {
      console.log('\nModel (variable assignments):');
      for (const [variable, value] of Object.entries(result.model)) {
        console.log(`  ${variable} = ${value}`);
      }
    }

    console.log('\nProof Chain:');
    if (result.proof && result.proof.length > 0) {
      result.proof.forEach((step, i) => {
        console.log(`  ${i + 1}. ${JSON.stringify(step)}`);
      });
    } else {
      console.log('  (No proof steps generated)');
    }

    console.log('\nExplanation:');
    console.log(`  ${result.explanation || 'N/A'}`);

    console.log('\n' + '='.repeat(80));
    console.log('SUCCESS');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('ERROR');
    console.error('='.repeat(80));
    console.error(`\n${error.message}`);
    console.error(`\nStack trace:\n${error.stack}`);
    process.exit(1);
  }
}

// Run the example
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
