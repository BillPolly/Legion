/**
 * Load Wikidata subset for sample CSQA conversations
 *
 * This script:
 * 1. Reads sample-entities.json (1,062 entities + 16 relations)
 * 2. Loads entity labels from items_wikidata_n.json
 * 3. Loads relation labels from filtered_property_wikidata4.json
 * 4. Loads facts from comp_wikidata_rev.json
 * 5. Creates wikidata-subset.json for use in benchmark
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to full Wikidata files
const WIKIDATA_DIR = '/private/tmp/convquestions/wikidata_proc_json 2';
const ITEMS_FILE = path.join(WIKIDATA_DIR, 'items_wikidata_n.json');
const PROPERTIES_FILE = path.join(WIKIDATA_DIR, 'filtered_property_wikidata4.json');
const FACTS_FILE = path.join(WIKIDATA_DIR, 'comp_wikidata_rev.json');

async function loadEntityLabels(entityIds) {
  console.log(`\n📖 Loading entity labels from ${path.basename(ITEMS_FILE)}...`);
  console.log(`   Looking for ${entityIds.size} entities`);
  console.log(`   (This may take a minute - file is 614MB)...`);

  const entityLabels = {};

  // The file is a single large JSON object: {"Q123": "label", ...}
  const allItems = JSON.parse(fs.readFileSync(ITEMS_FILE, 'utf8'));

  let found = 0;
  for (const entityId of entityIds) {
    if (allItems[entityId]) {
      entityLabels[entityId] = allItems[entityId];
      found++;
    }
  }

  console.log(`   Found: ${found}/${entityIds.size} entity labels ✓`);
  return entityLabels;
}

async function loadPropertyLabels(propertyIds) {
  console.log(`\n📖 Loading property labels from ${path.basename(PROPERTIES_FILE)}...`);
  console.log(`   Looking for ${propertyIds.size} properties`);

  const propertyLabels = {};

  // The file is a single JSON object: {"P123": "label", ...}
  const allProperties = JSON.parse(fs.readFileSync(PROPERTIES_FILE, 'utf8'));

  for (const propId of propertyIds) {
    if (allProperties[propId]) {
      propertyLabels[propId] = allProperties[propId];
    }
  }

  console.log(`   Found: ${Object.keys(propertyLabels).length}/${propertyIds.size} property labels ✓`);
  return propertyLabels;
}

async function loadFacts(entityIds) {
  console.log(`\n📖 Loading facts from ${path.basename(FACTS_FILE)}...`);
  console.log(`   Looking for facts about ${entityIds.size} entities`);
  console.log(`   (This may take 1-2 minutes - file is 591MB)...`);

  const facts = {};

  // Format: {"Q123": {"P31": ["Q456", "Q789"], "P21": ["Q6581097"]}, ...}
  const allFacts = JSON.parse(fs.readFileSync(FACTS_FILE, 'utf8'));

  let factCount = 0;
  for (const entityId of entityIds) {
    if (allFacts[entityId]) {
      facts[entityId] = [];
      for (const [predicate, objects] of Object.entries(allFacts[entityId])) {
        for (const obj of objects) {
          facts[entityId].push({
            predicate,
            object: obj
          });
          factCount++;
        }
      }
    }
  }

  console.log(`   Loaded: ${factCount} facts ✓`);
  return facts;
}

async function main() {
  console.log('='.repeat(80));
  console.log('Wikidata Subset Loader for CSQA Benchmark');
  console.log('='.repeat(80));

  // Load sample entities
  const sampleEntitiesPath = path.join(__dirname, 'sample-entities.json');
  const sampleData = JSON.parse(fs.readFileSync(sampleEntitiesPath, 'utf8'));

  const entityIds = new Set(sampleData.allEntities);
  const propertyIds = new Set(sampleData.allRelations);

  console.log(`\n📊 Sample data loaded:`);
  console.log(`   Entities: ${entityIds.size}`);
  console.log(`   Properties: ${propertyIds.size}`);

  // Load entity labels
  const entityLabels = await loadEntityLabels(entityIds);

  // Load property labels
  const propertyLabels = await loadPropertyLabels(propertyIds);

  // Load facts (this may take a while - 591MB file)
  const facts = await loadFacts(entityIds);

  // Build final subset
  const subset = {
    entities: {},
    properties: propertyLabels,
    metadata: {
      totalEntities: entityIds.size,
      totalProperties: propertyIds.size,
      loadedEntities: Object.keys(entityLabels).length,
      loadedProperties: Object.keys(propertyLabels).length,
      totalFacts: Object.values(facts).reduce((sum, f) => sum + f.length, 0),
      createdAt: new Date().toISOString()
    }
  };

  // Combine labels and facts
  for (const entityId of entityIds) {
    subset.entities[entityId] = {
      id: entityId,
      label: entityLabels[entityId] || entityId,
      facts: facts[entityId] || []
    };
  }

  // Save subset
  const outputPath = path.join(__dirname, 'wikidata-subset.json');
  fs.writeFileSync(outputPath, JSON.stringify(subset, null, 2));

  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Loaded ${subset.metadata.loadedEntities} entity labels`);
  console.log(`✅ Loaded ${subset.metadata.loadedProperties} property labels`);
  console.log(`✅ Loaded ${subset.metadata.totalFacts} facts`);
  console.log(`✅ Saved to ${outputPath}`);
  console.log('='.repeat(80));

  // Show sample entities
  console.log(`\n📝 Sample entities:`);
  const sampleEntityIds = Array.from(entityIds).slice(0, 5);
  for (const entityId of sampleEntityIds) {
    const entity = subset.entities[entityId];
    console.log(`   ${entityId}: "${entity.label}" (${entity.facts.length} facts)`);
  }

  console.log(`\n📝 Sample properties:`);
  for (const [propId, label] of Object.entries(propertyLabels).slice(0, 5)) {
    console.log(`   ${propId}: "${label}"`);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
