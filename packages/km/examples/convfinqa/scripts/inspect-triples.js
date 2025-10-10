/**
 * Inspect Triple Store Structure and Ontology Linkage
 */

import { InstanceBuilder } from '../../semantic-financial-kg/src/kg/InstanceBuilder.js';
import { OntologyBuilder } from '@legion/ontology';
import { TripleStore } from '../../semantic-financial-kg/src/storage/TripleStore.js';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('='.repeat(80));
  console.log('Inspecting Triple Store Structure and Ontology Linkage');
  console.log('='.repeat(80));
  console.log();

  // Load dataset
  const dataPath = path.join(import.meta.dirname, '../data/convfinqa_dataset.json');
  const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const example = dataset.train[1]; // Single_RSG

  console.log(`Example: ${example.id}\n`);

  // Initialize
  const resourceManager = await ResourceManager.getInstance();
  const llmClient = await resourceManager.get('llmClient');
  const tripleStore = new TripleStore();
  const semanticSearch = await SemanticSearchProvider.create(resourceManager);

  // Create ontology builder
  const ontologyBuilder = new OntologyBuilder({
    tripleStore,
    semanticSearch,
    llmClient,
    verification: { enabled: false }
  });
  await ontologyBuilder.ensureBootstrapLoaded();

  // Create instance builder
  const instanceBuilder = new InstanceBuilder({
    tripleStore,
    ontologyBuilder,
    llmClient,
    semanticSearch
  });

  // Build KG
  console.log('Building KG...');
  const companyMatch = example.id.match(/Single_([^/]+)\//);
  const company = companyMatch ? companyMatch[1] : 'Unknown';

  const data = {
    table: example.doc.table,
    metadata: {
      sourceDocument: example.id,
      documentId: example.id,
      scale: 'thousands',
      currency: 'USD',
      company: company,
      organizationUri: `data:${company}`
    }
  };

  instanceBuilder.validator.validateCoverage = async () => ({ similarity: 1.0, complete: true });
  await instanceBuilder.createInstances(data);

  console.log('✓ KG built\n');

  // Now inspect the triples
  console.log('='.repeat(80));
  console.log('ONTOLOGY CLASSES');
  console.log('='.repeat(80));
  console.log();

  // Show ontology classes
  const classes = await tripleStore.query(null, 'rdf:type', 'owl:Class');
  console.log(`Total ontology classes: ${classes.length}\n`);

  for (const [classUri] of classes) {
    // Get class label
    const labels = await tripleStore.query(classUri, 'rdfs:label', null);
    const label = labels.length > 0 ? labels[0][2].replace(/"/g, '') : '(no label)';

    // Get superclass
    const supers = await tripleStore.query(classUri, 'rdfs:subClassOf', null);
    const superclass = supers.length > 0 ? supers[0][2] : '(none)';

    // Count instances of this class
    const instances = await tripleStore.query(null, 'rdf:type', classUri);

    console.log(`${classUri}`);
    console.log(`  Label: ${label}`);
    console.log(`  Superclass: ${superclass}`);
    console.log(`  Instances: ${instances.length}`);
    console.log();
  }

  console.log('='.repeat(80));
  console.log('ONTOLOGY PROPERTIES');
  console.log('='.repeat(80));
  console.log();

  // Show object properties
  const objectProps = await tripleStore.query(null, 'rdf:type', 'owl:ObjectProperty');
  console.log(`Object Properties: ${objectProps.length}\n`);

  for (const [propUri] of objectProps.slice(0, 10)) { // Show first 10
    const labels = await tripleStore.query(propUri, 'rdfs:label', null);
    const label = labels.length > 0 ? labels[0][2].replace(/"/g, '') : '(no label)';

    const domains = await tripleStore.query(propUri, 'rdfs:domain', null);
    const domain = domains.length > 0 ? domains[0][2] : '(none)';

    const ranges = await tripleStore.query(propUri, 'rdfs:range', null);
    const range = ranges.length > 0 ? ranges[0][2] : '(none)';

    console.log(`${propUri}`);
    console.log(`  Label: ${label}`);
    console.log(`  Domain: ${domain}`);
    console.log(`  Range: ${range}`);
    console.log();
  }

  // Show datatype properties
  const datatypeProps = await tripleStore.query(null, 'rdf:type', 'owl:DatatypeProperty');
  console.log(`Datatype Properties: ${datatypeProps.length}\n`);

  for (const [propUri] of datatypeProps.slice(0, 10)) { // Show first 10
    const labels = await tripleStore.query(propUri, 'rdfs:label', null);
    const label = labels.length > 0 ? labels[0][2].replace(/"/g, '') : '(no label)';

    const domains = await tripleStore.query(propUri, 'rdfs:domain', null);
    const domain = domains.length > 0 ? domains[0][2] : '(none)';

    const ranges = await tripleStore.query(propUri, 'rdfs:range', null);
    const range = ranges.length > 0 ? ranges[0][2] : '(none)';

    console.log(`${propUri}`);
    console.log(`  Label: ${label}`);
    console.log(`  Domain: ${domain}`);
    console.log(`  Range: ${range}`);
    console.log();
  }

  console.log('='.repeat(80));
  console.log('INSTANCE EXAMPLES');
  console.log('='.repeat(80));
  console.log();

  // Show sample instances and their types
  console.log('FinancialMetric Instance:\n');
  const metricInstances = await tripleStore.query(null, 'rdf:type', 'kg:FinancialMetric');
  if (metricInstances.length > 0) {
    const metricUri = metricInstances[0][0];
    const allTriples = await tripleStore.query(metricUri, null, null);
    for (const [s, p, o] of allTriples) {
      console.log(`  ${s} ${p} ${o}`);
    }
  }

  console.log('\nFinancialValue Instance:\n');
  const valueInstances = await tripleStore.query(null, 'rdf:type', 'kg:FinancialValue');
  if (valueInstances.length > 0) {
    const valueUri = valueInstances[0][0];
    const allTriples = await tripleStore.query(valueUri, null, null);
    for (const [s, p, o] of allTriples) {
      console.log(`  ${s} ${p} ${o}`);
    }
  }

  console.log('\nObservation Instance:\n');
  const obsInstances = await tripleStore.query(null, 'rdf:type', 'kg:Observation');
  if (obsInstances.length > 0) {
    const obsUri = obsInstances[0][0];
    const allTriples = await tripleStore.query(obsUri, null, null);
    for (const [s, p, o] of allTriples) {
      console.log(`  ${s} ${p} ${o}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();

  const allTriples = await tripleStore.query(null, null, null);
  console.log(`Total triples: ${allTriples.length}`);

  const typeTriples = await tripleStore.query(null, 'rdf:type', null);
  console.log(`Type assertions: ${typeTriples.length}`);

  const labelTriples = await tripleStore.query(null, 'rdfs:label', null);
  console.log(`Labels: ${labelTriples.length}`);

  // Check if instances link to ontology classes
  console.log('\nOntology Linkage Check:');
  const hasMetricTriples = await tripleStore.query(null, 'kg:hasMetric', null);
  const hasMetricPropDef = await tripleStore.query('kg:hasMetric', 'rdf:type', 'owl:ObjectProperty');
  console.log(`  kg:hasMetric used ${hasMetricTriples.length} times`);
  console.log(`  kg:hasMetric defined in ontology: ${hasMetricPropDef.length > 0 ? 'YES' : 'NO'}`);

  const numericValueTriples = await tripleStore.query(null, 'kg:numericValue', null);
  const numericValuePropDef = await tripleStore.query('kg:numericValue', 'rdf:type', 'owl:DatatypeProperty');
  console.log(`  kg:numericValue used ${numericValueTriples.length} times`);
  console.log(`  kg:numericValue defined in ontology: ${numericValuePropDef.length > 0 ? 'YES' : 'NO'}`);

  console.log();
}

main().catch(error => {
  console.error('Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
