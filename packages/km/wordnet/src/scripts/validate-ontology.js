/**
 * Ontology Validation Script
 * Validates the loaded WordNet foundational ontology
 */

import { KGEngine } from '@legion/kg';
import { MongoTripleStore } from '@legion/kg';
import { DEFAULT_CONFIG } from '../config/default.js';

async function validateOntology(config = DEFAULT_CONFIG) {
  console.log('Starting ontology validation...');

  const store = new MongoTripleStore(
    config.mongodb.connectionString,
    config.mongodb.dbName,
    config.mongodb.collectionName
  );

  const kg = new KGEngine(store);

  try {
    // Count entities by type
    const concepts = await kg.queryAsync(null, 'rdf:type', 'kg:Concept');
    const words = await kg.queryAsync(null, 'rdf:type', 'kg:Word');
    const hasLabelRels = await kg.queryAsync(null, 'rdf:type', 'kg:HasLabel');
    const expressesRels = await kg.queryAsync(null, 'rdf:type', 'kg:Expresses');
    const isARels = await kg.queryAsync(null, 'rdf:type', 'kg:IsA');

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
      const linkedConcepts = await kg.queryAsync(null, null, category);
      console.log(`- ${category}: ${linkedConcepts.length} linked concepts`);
    }

    // Check for polysemy examples
    const bankWords = await kg.queryAsync(null, 'kg:wordText', 'bank');
    if (bankWords.length > 0) {
      const bankWordId = bankWords[0][0];
      const bankConcepts = await kg.queryAsync(bankWordId, null, null);
      const conceptCount = bankConcepts.filter(([,p,]) => p.includes('expresses')).length;
      console.log(`\nPolysemy example: "Bank" has ${conceptCount} different meanings`);
    }

    // Sample concept details
    const dogWords = await kg.queryAsync(null, 'kg:wordText', 'dog');
    if (dogWords.length > 0) {
      console.log('\nSample concept analysis for "dog":');
      const dogWordId = dogWords[0][0];
      const dogRelations = await kg.queryAsync(dogWordId, null, null);
      console.log(`- Word node has ${dogRelations.length} relationships`);
      
      const expressesConcepts = dogRelations.filter(([,p,]) => p.includes('expresses'));
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
    await store.disconnect();
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateOntology().catch(console.error);
}

export { validateOntology };
