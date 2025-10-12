/**
 * Index Wikidata properties and entities in Qdrant
 *
 * This creates the semantic index needed for Phase 3 semantic mapping:
 * - Maps natural language ("director", "occupation") to Wikidata properties (P57, P106)
 * - Maps entity mentions to Wikidata Q-numbers
 */

import { WikidataDataSource } from './WikidataDataSource.js';
import { ResourceManager } from '@legion/resource-manager';
import { OntologyIndexer } from '../../src/phase3/OntologyIndexer.js';

// Common Wikidata properties used in CSQA
const WIKIDATA_PROPERTIES = {
  // From our sample conversations
  'P106': { label: 'occupation', synonyms: ['job', 'work', 'profession', 'career'] },
  'P57': { label: 'director', synonyms: ['directed', 'direct'] },
  'P58': { label: 'screenwriter', synonyms: ['wrote', 'writer', 'screenplay'] },
  'P674': { label: 'characters', synonyms: [] },
  'P2079': { label: 'fabrication method', synonyms: [] },
  'P1056': { label: 'product or material produced', synonyms: [] },
  'P682': { label: 'biological process', synonyms: [] },
  'P681': { label: 'cell component', synonyms: [] },
  'P361': { label: 'part of', synonyms: [] },
  'P688': { label: 'encodes', synonyms: [] },
  'P702': { label: 'encoded by', synonyms: [] },
  'P703': { label: 'found in taxon', synonyms: [] },
  'P21': { label: 'sex or gender', synonyms: [] },
  'P161': { label: 'cast member', synonyms: [] },
  'P1346': { label: 'winner', synonyms: [] },
  'P1412': { label: 'languages spoken, written or signed', synonyms: [] },

  // Additional common properties
  'P31': { label: 'instance of', synonyms: [] },
  'P279': { label: 'subclass of', synonyms: [] },
  'P19': { label: 'place of birth', synonyms: ['birthplace'] },
  'P20': { label: 'place of death', synonyms: [] },
  'P27': { label: 'country of citizenship', synonyms: ['citizenship', 'nationality'] },
  'P569': { label: 'date of birth', synonyms: ['born', 'birth date'] },
  'P570': { label: 'date of death', synonyms: ['died', 'death date'] },
  'P735': { label: 'given name', synonyms: [] },
  'P734': { label: 'family name', synonyms: [] },
  'P26': { label: 'spouse', synonyms: ['married', 'partner'] },
  'P40': { label: 'child', synonyms: ['children'] },
  'P22': { label: 'father', synonyms: [] },
  'P25': { label: 'mother', synonyms: [] },
  'P495': { label: 'country of origin', synonyms: [] },
  'P577': { label: 'publication date', synonyms: ['published'] },
  'P571': { label: 'inception', synonyms: [] },
  'P580': { label: 'start time', synonyms: [] },
  'P582': { label: 'end time', synonyms: [] },
  'P276': { label: 'location', synonyms: [] },
  'P17': { label: 'country', synonyms: [] },
  'P131': { label: 'located in', synonyms: [] },
  'P150': { label: 'contains', synonyms: [] },
  'P36': { label: 'capital', synonyms: [] },
  'P47': { label: 'shares border with', synonyms: ['borders', 'border'] },
  'P1082': { label: 'population', synonyms: [] },
  'P2046': { label: 'area', synonyms: [] }
};

// Common entity types
const WIKIDATA_TYPES = {
  'Q5': { label: 'human', synonyms: ['person', 'people'] },
  'Q6256': { label: 'country', synonyms: ['nation'] },
  'Q515': { label: 'city', synonyms: [] },
  'Q11424': { label: 'film', synonyms: ['movie'] },
  'Q5398426': { label: 'television series', synonyms: ['tv show'] },
  'Q7725634': { label: 'literary work', synonyms: ['book'] },
  'Q7889': { label: 'video game', synonyms: ['game'] },
  'Q482994': { label: 'album', synonyms: [] },
  'Q134556': { label: 'single', synonyms: [] },
  'Q215380': { label: 'musical group', synonyms: ['band'] },
  'Q7278': { label: 'political party', synonyms: [] },
  'Q4830453': { label: 'business', synonyms: ['company'] },
  'Q43229': { label: 'organization', synonyms: [] },
  'Q3455803': { label: 'director', synonyms: [] },
  'Q33999': { label: 'actor', synonyms: [] },
  'Q36180': { label: 'writer', synonyms: [] },
  'Q639669': { label: 'musician', synonyms: [] },
  'Q13219637': { label: 'calendar year', synonyms: ['year'] }
};

async function createWikidataOntology() {
  console.log('\n📦 Creating Wikidata Ontology for Indexing...');

  const ontology = {
    classes: [],
    properties: [],
    individuals: []
  };

  // Add properties
  for (const [propId, propData] of Object.entries(WIKIDATA_PROPERTIES)) {
    const label = typeof propData === 'string' ? propData : propData.label;
    const synonyms = typeof propData === 'object' ? propData.synonyms : [];

    ontology.properties.push({
      iri: propId,
      label: label,
      synonyms: synonyms,
      domain: ':Entity',
      range: ':Entity',
      description: `Wikidata property: ${label}`
    });
  }

  // Add types/classes
  for (const [typeId, typeData] of Object.entries(WIKIDATA_TYPES)) {
    const label = typeof typeData === 'string' ? typeData : typeData.label;
    const synonyms = typeof typeData === 'object' ? typeData.synonyms : [];

    ontology.classes.push({
      iri: typeId,
      label: label,
      synonyms: synonyms,
      superclass: ':Entity',
      description: `Wikidata type: ${label}`
    });
  }

  console.log(`   ✓ Created ${ontology.properties.length} properties`);
  console.log(`   ✓ Created ${ontology.classes.length} classes`);

  return ontology;
}

async function main() {
  console.log('='.repeat(80));
  console.log('Wikidata Semantic Indexing for CSQA Benchmark');
  console.log('='.repeat(80));

  // Initialize ResourceManager
  console.log('\n🔧 Initializing ResourceManager...');
  const resourceManager = await ResourceManager.getInstance();
  const semanticSearch = await resourceManager.get('semanticSearch');

  if (!semanticSearch) {
    throw new Error('SemanticSearchProvider not available - required for indexing');
  }
  console.log('   ✓ SemanticSearch available');

  // Create indexer with dedicated collection
  const indexer = new OntologyIndexer(semanticSearch, {
    collectionName: 'csqa-wikidata-ontology'
  });

  await indexer.initialize();
  console.log('   ✓ Ontology indexer initialized');

  // Create Wikidata ontology
  const wikidataOntology = await createWikidataOntology();

  // Index it
  console.log('\n📊 Indexing Wikidata Ontology in Qdrant...');
  console.log(`   Collection: csqa-wikidata-ontology`);

  await indexer.indexOntology(wikidataOntology);

  console.log('   ✓ Ontology indexed successfully');

  // Test semantic search with SemanticMapper
  console.log('\n🔍 Testing Semantic Mapping...');
  console.log('-'.repeat(80));

  const { SemanticMapper } = await import('../../src/phase3/SemanticMapper.js');
  const mapper = new SemanticMapper(semanticSearch, {
    collectionName: 'csqa-wikidata-ontology',
    confidenceThreshold: 0.6
  });

  const testQueries = [
    'director',
    'occupation',
    'screenwriter',
    'country',
    'human',
    'film',
    'sex',
    'place of birth'
  ];

  for (const query of testQueries) {
    try {
      const results = await mapper.searchConcepts(query, 1);

      if (results.length > 0) {
        const match = results[0];
        console.log(`   "${query}" → ${match.iri} (${match.label}) [confidence: ${match.confidence.toFixed(3)}]`);
      } else {
        console.log(`   "${query}" → No match found`);
      }
    } catch (err) {
      console.log(`   "${query}" → Error: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Wikidata Semantic Index Created Successfully!');
  console.log('='.repeat(80));
  console.log('\nNext steps:');
  console.log('  1. Update SemanticMapper to use collection: "csqa-wikidata-ontology"');
  console.log('  2. Run benchmark with: node run-sample.js');
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
