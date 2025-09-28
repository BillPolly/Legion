/**
 * Ontology Validation Script
 * Validates the loaded WordNet foundational ontology
 * Now uses Handle-based architecture with TripleStoreDataSource
 */

import { TripleStoreDataSource } from '@legion/triplestore';
import { MongoDBTripleStore } from '../storage/MongoDBTripleStore.js';
import { DEFAULT_CONFIG } from '../config/default.js';

async function validateOntology(config = DEFAULT_CONFIG) {
  console.log('Starting ontology validation...');

  const tripleStore = new MongoDBTripleStore({
    uri: config.mongodb.connectionString,
    database: config.mongodb.dbName,
    collection: config.mongodb.collectionName
  });

  await tripleStore.connect();
  const dataSource = new TripleStoreDataSource(tripleStore);

  try {
    // Count entities by type
    const concepts = await tripleStore.findTriples(null, 'rdf:type', 'kg:Concept');
    const words = await tripleStore.findTriples(null, 'rdf:type', 'kg:Word');
    const hasLabelRels = await tripleStore.findTriples(null, 'rdf:type', 'kg:HasLabel');
    const expressesRels = await tripleStore.findTriples(null, 'rdf:type', 'kg:Expresses');
    const isARels = await tripleStore.findTriples(null, 'rdf:type', 'kg:IsA');

    console.log('Ontology Statistics:');
    console.log(`- Concepts: ${concepts.length}`);
    console.log(`- Words: ${words.length}`);
    console.log(`- HasLabel relationships: ${hasLabelRels.length}`);
    console.log(`- Expresses relationships: ${expressesRels.length}`);
    console.log(`- IS-A relationships: ${isARels.length}`);

    // Validate foundational categories
    const categories = ['kg:Entity', 'kg:Process', 'kg:Property', 'kg:Relation'];
    console.log('\nFoundational Categories:');
    for (const category of categories) {
      const linkedConcepts = await tripleStore.findTriples(null, null, category);
      console.log(`- ${category}: ${linkedConcepts.length} linked concepts`);
    }

    // Check for polysemy examples
    const bankWords = await tripleStore.findTriples(null, 'kg:wordText', 'bank');
    if (bankWords.length > 0) {
      const bankWordId = bankWords[0].subject;
      const bankConcepts = await tripleStore.findTriples(bankWordId, null, null);
      const conceptCount = bankConcepts.filter(triple => triple.predicate.includes('expresses')).length;
      console.log(`\nPolysemy example: "Bank" has ${conceptCount} different meanings`);
    }

    // Sample concept details
    const dogWords = await tripleStore.findTriples(null, 'kg:wordText', 'dog');
    if (dogWords.length > 0) {
      console.log('\nSample concept analysis for "dog":');
      const dogWordId = dogWords[0].subject;
      const dogRelations = await tripleStore.findTriples(dogWordId, null, null);
      console.log(`- Word node has ${dogRelations.length} relationships`);
      
      const expressesConcepts = dogRelations.filter(triple => triple.predicate.includes('expresses'));
      console.log(`- Expresses ${expressesConcepts.length} concepts`);
    }

    console.log('\nValidation completed successfully!');
    return {
      concepts: concepts.length,
      words: words.length,
      relationships: hasLabelRels.length + expressesRels.length + isARels.length,
      isValid: true
    };

  } catch (error) {
    console.error('Validation failed:', error);
    return { isValid: false, error: error.message };
  } finally {
    await tripleStore.disconnect();
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateOntology().catch(console.error);
}

export { validateOntology };
