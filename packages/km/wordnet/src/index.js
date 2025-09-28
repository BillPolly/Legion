/**
 * WordNet Foundational Ontology Loader - Main Entry Point
 * Minimal index file that orchestrates the loading process
 */

import { WordNetFoundationalLoader } from './loader/WordNetFoundationalLoader.js';
import { DEFAULT_CONFIG, TEST_CONFIG } from './config/default.js';
import { validateOntology } from './scripts/validate-ontology.js';

// Main execution function
async function main() {
  const args = process.argv.slice(2);
  const isTestMode = args.includes('--test');
  const shouldValidate = args.includes('--validate');
  
  // Select configuration based on mode
  const config = isTestMode ? TEST_CONFIG : DEFAULT_CONFIG;
  
  console.log(`Starting WordNet Foundational Ontology Loader in ${isTestMode ? 'TEST' : 'PRODUCTION'} mode`);
  console.log('Configuration:', JSON.stringify(config, null, 2));

  try {
    if (shouldValidate) {
      // Run validation only
      console.log('Running validation...');
      const validationResult = await validateOntology(config);
      console.log('Validation result:', validationResult);
      return validationResult;
    } else {
      // Run full loading process
      const loader = new WordNetFoundationalLoader(config);
      const results = await loader.loadFoundationalOntology();
      
      console.log('\n=== LOADING SUMMARY ===');
      console.log(`Concepts loaded: ${results.conceptsLoaded}`);
      console.log(`Words created: ${results.wordsCreated}`);
      console.log(`Relationships created: ${results.relationshipsCreated}`);
      console.log(`Total triples: ${results.totalTriples}`);
      console.log(`Loading time: ${results.loadingTimeSeconds} seconds`);
      console.log('========================\n');
      
      return results;
    }
  } catch (error) {
    console.error('Process failed:', error);
    process.exit(1);
  }
}

// Export main components for programmatic use
export { WordNetFoundationalLoader } from './loader/WordNetFoundationalLoader.js';
export { DEFAULT_CONFIG, TEST_CONFIG } from './config/default.js';
export { validateOntology } from './scripts/validate-ontology.js';

// Export processors for advanced usage
export { SynsetProcessor } from './processors/SynsetProcessor.js';
export { RelationshipProcessor } from './processors/RelationshipProcessor.js';
export { HierarchyBuilder } from './hierarchy/HierarchyBuilder.js';
export { WordNetAccess } from './wordnet/WordNetAccess.js';
export { idGenerator } from './utils/idGenerator.js';

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
