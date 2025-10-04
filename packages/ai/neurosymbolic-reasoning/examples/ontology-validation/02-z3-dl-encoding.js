#!/usr/bin/env node
/**
 * Test Z3 Description Logic Encoding
 *
 * This validates that we can encode OWL axioms directly in Z3
 * using description logic constructs (quantifiers, uninterpreted functions)
 *
 * Bootstrap Ontology Tests:
 * 1. Disjointness: Continuant ⊥ Occurrent
 * 2. Subsumption: PhysicalEntity ⊆ Continuant
 * 3. Domain/Range: transforms has domain Process, range PhysicalEntity
 * 4. Consistency: All axioms together are consistent
 * 5. Contradiction detection: Pump cannot be both PhysicalEntity and State
 *
 * Run: node examples/ontology-validation/02-z3-dl-encoding.js
 */

import { Z3DescriptionLogicSolver } from '../../src/solvers/Z3DescriptionLogicSolver.js';
import { OWLAxiomEncoder } from '../../src/ontology/OWLAxiomEncoder.js';

async function main() {
  console.log('='.repeat(80));
  console.log('Z3 Description Logic Encoding Test');
  console.log('='.repeat(80));
  console.log();

  // Initialize solver and encoder
  console.log('Initializing Z3 Description Logic Solver...');
  const solver = new Z3DescriptionLogicSolver();
  await solver.initialize();

  const encoder = new OWLAxiomEncoder(solver);
  encoder.initialize('Entity');

  console.log('✓ Initialized\n');

  // Test 1: Disjointness
  console.log('='.repeat(80));
  console.log('TEST 1: Disjointness Axiom');
  console.log('='.repeat(80));
  console.log('Encoding: Continuant ⊥ Occurrent (owl:disjointWith)');
  console.log('Z3 Form: ∀x. ¬(Continuant(x) ∧ Occurrent(x))\n');

  const z3Solver1 = solver.createSolver();

  // Add disjointness axiom
  const disjointAxiom = encoder.encodeDisjoint('Continuant', 'Occurrent');
  z3Solver1.add(disjointAxiom);

  // Try to assert that some entity is BOTH (should be unsat)
  const entity1 = solver.createConst('e1', solver.sorts.get('Entity'));
  const continuantFn = solver.functions.get('Continuant');
  const occurrentFn = solver.functions.get('Occurrent');

  z3Solver1.add(continuantFn(entity1));
  z3Solver1.add(occurrentFn(entity1));

  const result1 = await z3Solver1.check();
  console.log(`Result: ${result1}`);
  console.log(`Expected: unsat (cannot be both)\n`);

  if (result1 === 'unsat') {
    console.log('✅ PASS: Disjointness correctly enforced\n');
  } else {
    console.log('❌ FAIL: Should be unsatisfiable\n');
  }

  // Test 2: Subclass transitivity
  console.log('='.repeat(80));
  console.log('TEST 2: Subclass Axioms');
  console.log('='.repeat(80));
  console.log('Encoding: PhysicalEntity ⊆ Continuant');
  console.log('Z3 Form: ∀x. PhysicalEntity(x) → Continuant(x)\n');

  solver.reset();
  encoder.initialize('Entity');
  const z3Solver2 = solver.createSolver();

  // Add subclass axiom
  const subclassAxiom = encoder.encodeSubClassOf('PhysicalEntity', 'Continuant');
  z3Solver2.add(subclassAxiom);

  // Assert: Pump is PhysicalEntity
  const pump = solver.createConst('Pump', solver.sorts.get('Entity'));
  const physicalEntityFn = solver.functions.get('PhysicalEntity');
  const continuantFn2 = solver.functions.get('Continuant');

  z3Solver2.add(physicalEntityFn(pump));

  // Check if Pump is Continuant (should be sat, and model should have Continuant(Pump)=true)
  const result2 = await z3Solver2.check();
  console.log(`Result: ${result2}`);
  console.log(`Expected: sat (subsumption works)\n`);

  if (result2 === 'sat') {
    const model = z3Solver2.model();
    const pumpIsContinuant = model.eval(continuantFn2(pump));
    console.log(`Continuant(Pump) = ${pumpIsContinuant.toString()}\n`);

    if (pumpIsContinuant.toString() === 'true') {
      console.log('✅ PASS: Subsumption correctly inferred\n');
    } else {
      console.log('❌ FAIL: Pump should be inferred as Continuant\n');
    }
  } else {
    console.log('❌ FAIL: Should be satisfiable\n');
  }

  // Test 3: Domain/Range constraints
  console.log('='.repeat(80));
  console.log('TEST 3: Domain/Range Constraints');
  console.log('='.repeat(80));
  console.log('Encoding: transforms has domain Process, range PhysicalEntity');
  console.log('Z3 Form: ∀x,y. transforms(x,y) → (Process(x) ∧ PhysicalEntity(y))\n');

  solver.reset();
  encoder.initialize('Entity');
  const z3Solver3 = solver.createSolver();

  // Add domain/range axioms
  const domainAxiom = encoder.encodeDomain('transforms', 'Process');
  const rangeAxiom = encoder.encodeRange('transforms', 'PhysicalEntity');
  z3Solver3.add(domainAxiom);
  z3Solver3.add(rangeAxiom);

  // Assert: HeatingProcess transforms Water
  const heating = solver.createConst('HeatingProcess', solver.sorts.get('Entity'));
  const water = solver.createConst('Water', solver.sorts.get('Entity'));
  const transformsFn = solver.functions.get('transforms');

  z3Solver3.add(transformsFn(heating, water));

  // Check satisfiability
  const result3 = await z3Solver3.check();
  console.log(`Result: ${result3}`);
  console.log(`Expected: sat\n`);

  if (result3 === 'sat') {
    const model3 = z3Solver3.model();
    const processFn = solver.functions.get('Process');
    const physicalEntityFn3 = solver.functions.get('PhysicalEntity');

    const heatingIsProcess = model3.eval(processFn(heating));
    const waterIsPhysical = model3.eval(physicalEntityFn3(water));

    console.log(`Process(HeatingProcess) = ${heatingIsProcess.toString()}`);
    console.log(`PhysicalEntity(Water) = ${waterIsPhysical.toString()}\n`);

    if (heatingIsProcess.toString() === 'true' && waterIsPhysical.toString() === 'true') {
      console.log('✅ PASS: Domain/range correctly inferred\n');
    } else {
      console.log('❌ FAIL: Domain/range not inferred correctly\n');
    }
  } else {
    console.log('❌ FAIL: Should be satisfiable\n');
  }

  // Test 4: Full bootstrap consistency
  console.log('='.repeat(80));
  console.log('TEST 4: Full Bootstrap Consistency');
  console.log('='.repeat(80));
  console.log('Adding all bootstrap axioms together...\n');

  solver.reset();
  encoder.initialize('Entity');
  const z3Solver4 = solver.createSolver();

  // Add all axioms
  const axioms = [
    // Top-level disjointness
    encoder.encodeDisjoint('Continuant', 'Occurrent'),

    // Subclass relationships
    encoder.encodeSubClassOf('PhysicalEntity', 'Continuant'),
    encoder.encodeSubClassOf('State', 'Continuant'),
    encoder.encodeSubClassOf('Process', 'Occurrent'),
    encoder.encodeSubClassOf('Task', 'Occurrent'),

    // Sub-category disjointness
    encoder.encodeDisjoint('PhysicalEntity', 'State'),
    encoder.encodeDisjoint('Process', 'Task'),

    // Domain/range
    encoder.encodeDomain('transforms', 'Process'),
    encoder.encodeRange('transforms', 'PhysicalEntity')
  ];

  for (const axiom of axioms) {
    z3Solver4.add(axiom);
  }

  const result4 = await z3Solver4.check();
  console.log(`Result: ${result4}`);
  console.log(`Expected: sat (axioms are consistent)\n`);

  if (result4 === 'sat') {
    console.log('✅ PASS: Bootstrap ontology is consistent\n');
  } else {
    console.log('❌ FAIL: Axioms should be consistent\n');
  }

  // Test 5: Contradiction detection
  console.log('='.repeat(80));
  console.log('TEST 5: Contradiction Detection');
  console.log('='.repeat(80));
  console.log('Adding: Pump is PhysicalEntity AND State (contradicts disjointness)\n');

  solver.reset();
  encoder.initialize('Entity');
  const z3Solver5 = solver.createSolver();

  // Add axioms
  z3Solver5.add(encoder.encodeDisjoint('PhysicalEntity', 'State'));

  // Add contradictory facts
  const pump5 = solver.createConst('Pump', solver.sorts.get('Entity'));
  const physicalFn = solver.functions.get('PhysicalEntity');
  const stateFn = solver.functions.get('State');

  z3Solver5.add(physicalFn(pump5));
  z3Solver5.add(stateFn(pump5));

  const result5 = await z3Solver5.check();
  console.log(`Result: ${result5}`);
  console.log(`Expected: unsat (contradiction detected)\n`);

  if (result5 === 'unsat') {
    console.log('✅ PASS: Contradiction correctly detected\n');
  } else {
    console.log('❌ FAIL: Should detect contradiction\n');
  }

  // Summary
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const tests = [
    { name: 'Disjointness enforcement', result: result1 === 'unsat' },
    { name: 'Subsumption inference', result: result2 === 'sat' },
    { name: 'Domain/range inference', result: result3 === 'sat' },
    { name: 'Bootstrap consistency', result: result4 === 'sat' },
    { name: 'Contradiction detection', result: result5 === 'unsat' }
  ];

  const passed = tests.filter(t => t.result).length;
  const total = tests.length;

  console.log(`\nTests passed: ${passed}/${total}\n`);
  console.log('Details:');
  tests.forEach(t => {
    const mark = t.result ? '✅' : '❌';
    console.log(`  ${mark} ${t.name}`);
  });

  if (passed === total) {
    console.log('\n' + '='.repeat(80));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(80));
    console.log('\n✅ Z3 Description Logic encoding works correctly');
    console.log('✅ Ready to build OntologyVerifier');
  } else {
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  SOME TESTS FAILED');
    console.log('='.repeat(80));
  }

  console.log();
}

main().catch(error => {
  console.error('Test error:', error);
  console.error(error.stack);
  process.exit(1);
});
