#!/usr/bin/env node
/**
 * Ontology Bootstrap Validation
 *
 * This validates that ProofOfThought can formally verify the
 * upper-level ontology axioms from @legion/ontology
 *
 * Bootstrap Ontology (BFO-inspired):
 * - kg:Continuant ⊥ kg:Occurrent (disjoint)
 * - kg:PhysicalEntity ⊥ kg:State (disjoint)
 * - kg:Process ⊥ kg:Task (disjoint)
 * - kg:PhysicalEntity ⊆ kg:Continuant
 * - kg:State ⊆ kg:Continuant
 * - kg:Process ⊆ kg:Occurrent
 * - kg:Task ⊆ kg:Occurrent
 *
 * Run: node examples/ontology-validation/01-bootstrap-validation.js
 */

import { ProofOfThought } from '../../src/index.js';
import { ResourceManager } from '@legion/resource-manager';

async function main() {
  console.log('='.repeat(80));
  console.log('ProofOfThought - Ontology Bootstrap Validation');
  console.log('='.repeat(80));
  console.log();

  // Initialize
  console.log('Initializing ProofOfThought...');
  const resourceManager = await ResourceManager.getInstance();
  const llmClient = await resourceManager.get('llmClient');
  const pot = new ProofOfThought(llmClient);

  // Test 1: Verify disjointness axioms
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: Disjointness Axioms');
  console.log('='.repeat(80));
  console.log('\nTesting: Continuant and Occurrent are disjoint');
  console.log('Question: Can something be both a Continuant and an Occurrent?');

  const disjointnessResult = await pot.query(
    'Can an entity be both a Continuant (thing that persists) and an Occurrent (thing that happens)?',
    {
      facts: [
        'Continuant means things that persist through time',
        'Occurrent means things that happen or occur',
        'By definition, if something persists it does not happen',
        'If something happens it does not persist'
      ],
      constraints: [
        'Continuant and Occurrent are mutually exclusive',
        'Nothing can be both Continuant and Occurrent'
      ]
    }
  );

  console.log(`\nAnswer: ${disjointnessResult.answer}`);
  console.log(`Confidence: ${(disjointnessResult.confidence * 100).toFixed(1)}%`);
  console.log(`\nExplanation: ${disjointnessResult.explanation}`);

  if (disjointnessResult.answer === 'No') {
    console.log('\n✅ PASS: Disjointness correctly verified');
  } else {
    console.log('\n❌ FAIL: Expected answer to be "No"');
  }

  // Test 2: Verify subclass relationships
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Subclass Transitivity');
  console.log('='.repeat(80));
  console.log('\nTesting: If PhysicalEntity ⊆ Continuant, is a Pump (PhysicalEntity) a Continuant?');

  const subclassResult = await pot.verify(
    'Pump is a Continuant',
    [
      'Pump is a PhysicalEntity',
      'PhysicalEntity is a subclass of Continuant',
      'If something is a PhysicalEntity then it is a Continuant'
    ],
    []
  );

  console.log(`\nValid: ${subclassResult.valid}`);
  console.log(`Violations: ${subclassResult.violations.length}`);

  if (subclassResult.valid) {
    console.log('\n✅ PASS: Transitivity correctly inferred');
  } else {
    console.log('\n❌ FAIL: Expected valid to be true');
    console.log('Violations:', subclassResult.violations);
  }

  // Test 3: Verify consistency of the full bootstrap
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Full Bootstrap Consistency');
  console.log('='.repeat(80));
  console.log('\nTesting: Are all bootstrap axioms mutually consistent?');

  const bootstrapAxioms = [
    // Top-level disjointness
    'Continuant and Occurrent are disjoint',

    // Subclass relationships
    'PhysicalEntity is subclass of Continuant',
    'State is subclass of Continuant',
    'Process is subclass of Occurrent',
    'Task is subclass of Occurrent',

    // Sub-category disjointness
    'PhysicalEntity and State are disjoint',
    'Process and Task are disjoint',

    // Transitivity
    'Subclass relationship is transitive',
    'Disjoint relationship is symmetric'
  ];

  const consistencyResult = await pot.verify(
    'Bootstrap ontology is logically consistent',
    [],
    bootstrapAxioms
  );

  console.log(`\nValid: ${consistencyResult.valid}`);
  console.log(`Violations: ${consistencyResult.violations.length}`);

  if (consistencyResult.violations.length > 0) {
    console.log('\nViolations detected:');
    consistencyResult.violations.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v}`);
    });
  }

  if (consistencyResult.valid) {
    console.log('\n✅ PASS: Bootstrap ontology is consistent');
  } else {
    console.log('\n❌ FAIL: Bootstrap has logical contradictions');
  }

  // Test 4: Detect contradiction (negative test)
  console.log('\n' + '='.repeat(80));
  console.log('TEST 4: Contradiction Detection');
  console.log('='.repeat(80));
  console.log('\nTesting: Can we detect when axioms contradict?');
  console.log('Adding contradiction: "A Pump is both PhysicalEntity AND State"');

  const contradictionResult = await pot.verify(
    'This ontology is consistent',
    [
      'Pump is a PhysicalEntity',
      'Pump is also a State'  // Contradiction!
    ],
    [
      'PhysicalEntity and State are disjoint',
      'Nothing can be both PhysicalEntity and State'
    ]
  );

  console.log(`\nValid: ${contradictionResult.valid}`);
  console.log(`Violations: ${contradictionResult.violations.length}`);

  if (!contradictionResult.valid) {
    console.log('\n✅ PASS: Contradiction correctly detected');
    console.log('\nDetected violations:');
    contradictionResult.violations.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v}`);
    });
  } else {
    console.log('\n❌ FAIL: Should have detected contradiction');
  }

  // Test 5: Domain/Range constraints
  console.log('\n' + '='.repeat(80));
  console.log('TEST 5: Relationship Domain/Range Constraints');
  console.log('='.repeat(80));
  console.log('\nTesting: kg:transforms has domain Process and range PhysicalEntity');

  const domainRangeResult = await pot.verify(
    'The transforms relationship is correctly typed',
    [
      'HeatingProcess is a Process',
      'Water is a PhysicalEntity',
      'HeatingProcess transforms Water'
    ],
    [
      'transforms has domain Process',
      'transforms has range PhysicalEntity',
      'If X transforms Y, then X must be a Process and Y must be a PhysicalEntity'
    ]
  );

  console.log(`\nValid: ${domainRangeResult.valid}`);
  console.log(`Violations: ${domainRangeResult.violations.length}`);

  if (domainRangeResult.valid) {
    console.log('\n✅ PASS: Domain/range constraints satisfied');
  } else {
    console.log('\n❌ FAIL: Domain/range violation detected');
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80));

  const tests = [
    { name: 'Disjointness axioms', result: disjointnessResult.answer === 'No' },
    { name: 'Subclass transitivity', result: subclassResult.valid },
    { name: 'Bootstrap consistency', result: consistencyResult.valid },
    { name: 'Contradiction detection', result: !contradictionResult.valid },
    { name: 'Domain/range constraints', result: domainRangeResult.valid }
  ];

  const passed = tests.filter(t => t.result).length;
  const total = tests.length;

  console.log(`\nTests passed: ${passed}/${total}`);
  console.log('\nDetails:');
  tests.forEach((t, i) => {
    const mark = t.result ? '✅' : '❌';
    console.log(`  ${mark} ${t.name}`);
  });

  if (passed === total) {
    console.log('\n' + '='.repeat(80));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(80));
    console.log('\n✅ ProofOfThought CAN verify ontology axioms');
    console.log('✅ Ready to integrate with @legion/ontology');
  } else {
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  SOME TESTS FAILED');
    console.log('='.repeat(80));
    console.log(`\n❌ ${total - passed} tests failed`);
    console.log('   Review results above for details');
  }

  console.log();
}

// Run validation
main().catch(error => {
  console.error('Validation error:', error);
  process.exit(1);
});
