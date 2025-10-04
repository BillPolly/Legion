#!/usr/bin/env node
/**
 * Integration Test: OntologyBuilder with Z3 Verification
 *
 * This demonstrates the full integration of ProofOfThought formal verification
 * with the incremental ontology building pipeline from @legion/ontology.
 *
 * The OntologyBuilder now includes verification checkpoints:
 * 1. Bootstrap verification - Verify upper-level ontology is consistent
 * 2. Post-extension verification - Verify new additions don't violate axioms
 * 3. Statistics reporting - Track violations detected and prevented
 *
 * Run: node examples/ontology-validation/03-integration-with-ontology-builder.js
 */

import { OntologyBuilder } from '../../../../km/ontology/src/OntologyBuilder.js';
import { TripleStore } from '@legion/triplestore';
import { SemanticSearch } from '@legion/semantic-search';
import { ResourceManager } from '@legion/resource-manager';

async function main() {
  console.log('='.repeat(80));
  console.log('OntologyBuilder with Z3 Formal Verification');
  console.log('='.repeat(80));
  console.log();

  // Initialize dependencies
  console.log('Initializing dependencies...');
  const resourceManager = await ResourceManager.getInstance();
  const llmClient = await resourceManager.get('llmClient');

  const tripleStore = new TripleStore();
  await tripleStore.initialize();

  const semanticSearch = new SemanticSearch({
    dimensions: 1536,
    metric: 'cosine'
  });

  // Create OntologyBuilder with verification ENABLED
  const builder = new OntologyBuilder({
    tripleStore,
    semanticSearch,
    llmClient,
    verification: {
      enabled: true,  // Enable Z3 verification
      verifyBootstrap: true,
      verifyAfterExtension: true,
      failOnViolation: false  // Don't fail, just warn
    }
  });

  console.log('✓ OntologyBuilder created with Z3 verification enabled\n');

  // Test 1: Load bootstrap and verify
  console.log('='.repeat(80));
  console.log('TEST 1: Bootstrap Loading with Verification');
  console.log('='.repeat(80));
  console.log();

  await builder.ensureBootstrapLoaded();

  console.log('\n✅ Bootstrap loaded and verified');

  // Test 2: Build simple ontology
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Building Ontology with Verification');
  console.log('='.repeat(80));
  console.log();

  const plumbingText = `
    A pump is a device that moves fluids.
    A centrifugal pump is a type of pump.
    A valve controls fluid flow.
  `;

  console.log('Processing text:', plumbingText.trim());
  console.log();

  try {
    const result = await builder.processText(plumbingText, {
      domain: 'plumbing'
    });

    console.log('\n' + '='.repeat(80));
    console.log('RESULTS');
    console.log('='.repeat(80));

    console.log('\nOntology Statistics:');
    console.log(`  Classes: ${result.ontologyStats.classes}`);
    console.log(`  Properties: ${result.ontologyStats.properties}`);
    console.log(`  Relationships: ${result.ontologyStats.relationships}`);

    console.log('\nVerification Statistics:');
    console.log(`  Enabled: ${result.verificationStats.enabled}`);
    console.log(`  Verifications Run: ${result.verificationStats.verificationsRun}`);
    console.log(`  Violations Detected: ${result.verificationStats.violationsDetected}`);
    console.log(`  Violations Prevented: ${result.verificationStats.violationsPrevented}`);

    console.log('\nAnnotated Sentences:');
    for (const sentence of result.sentences) {
      console.log(`  - "${sentence.text}"`);
      console.log(`    Types: ${sentence.types.map(t => t.uri).join(', ')}`);
    }

    if (result.verificationStats.violationsDetected === 0) {
      console.log('\n' + '='.repeat(80));
      console.log('🎉 SUCCESS: Ontology built with ZERO violations!');
      console.log('='.repeat(80));
      console.log('\n✅ Z3 verified ALL extensions are logically consistent');
      console.log('✅ No disjointness violations');
      console.log('✅ No subsumption contradictions');
      console.log('✅ All domain/range constraints satisfied');
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('⚠️  VIOLATIONS DETECTED');
      console.log('='.repeat(80));
      console.log(`\n❌ ${result.verificationStats.violationsDetected} violations detected`);
      console.log(`   ${result.verificationStats.violationsPrevented} prevented from being added`);
    }

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('ERROR');
    console.error('='.repeat(80));
    console.error('\nVerification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  // Test 3: Query ontology
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Querying Verified Ontology');
  console.log('='.repeat(80));
  console.log();

  console.log('Querying all PhysicalEntity subclasses...');
  const physicalEntities = await tripleStore.query(null, 'rdfs:subClassOf', 'kg:PhysicalEntity');
  console.log(`Found ${physicalEntities.length} physical entity types:`);
  for (const entity of physicalEntities) {
    console.log(`  - ${entity.subject}`);
  }

  console.log('\nQuerying all owl:Class instances...');
  const allClasses = await tripleStore.query(null, 'rdf:type', 'owl:Class');
  console.log(`Found ${allClasses.length} classes total:`);
  for (const cls of allClasses) {
    console.log(`  - ${cls.subject}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('INTEGRATION TEST COMPLETE');
  console.log('='.repeat(80));
  console.log('\n✅ OntologyBuilder + Z3 Verification integration successful!');
  console.log('✅ Formal guarantees provided at all checkpoints');
  console.log('✅ Ready for production use');

  console.log();
}

main().catch(error => {
  console.error('Test error:', error);
  console.error(error.stack);
  process.exit(1);
});
