/**
 * Load Wikidata subset into MongoDB for CSQA benchmark
 *
 * This script streams large JSON files (600MB+) line-by-line to avoid memory issues
 * and loads data into MongoDB collections for efficient querying.
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source data directory (adjust path as needed)
const DATA_DIR = '/private/tmp/convquestions/wikidata_proc_json 2';
const ITEMS_FILE = path.join(DATA_DIR, 'items_wikidata_n.json');
const PROPERTIES_FILE = path.join(DATA_DIR, 'filtered_property_wikidata4.json');
const FACTS_FILE = path.join(DATA_DIR, 'comp_wikidata_rev.json');

// MongoDB configuration
const MONGO_URL = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'wikidata_csqa';

/**
 * Stream a large JSON file line-by-line
 */
async function* streamJsonLines(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let buffer = '';
  let inObject = false;
  let braceCount = 0;

  for await (const line of rl) {
    buffer += line;

    // Track brace depth to detect complete objects
    for (const char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }

    // When braces balance, we have a complete object
    if (braceCount === 0 && buffer.trim().length > 0) {
      // Remove trailing comma and parse
      const cleaned = buffer.trim().replace(/,\s*$/, '');

      if (cleaned && cleaned !== '{' && cleaned !== '}') {
        try {
          // Extract key-value pair from format: "Q123": {...}
          const match = cleaned.match(/"([^"]+)":\s*(\{.*\})/);
          if (match) {
            const [, key, value] = match;
            yield { key, data: JSON.parse(value) };
          }
        } catch (err) {
          console.error('Parse error:', err.message, 'Line:', cleaned.substring(0, 100));
        }
      }

      buffer = '';
    }
  }
}

/**
 * Load entities from items_wikidata_n.json
 */
async function loadEntities(db) {
  console.log('\n📖 Loading entities from items_wikidata_n.json...');

  const collection = db.collection('entities');
  await collection.deleteMany({}); // Clear existing data

  let count = 0;
  let batch = [];
  const BATCH_SIZE = 1000;

  for await (const { key, data } of streamJsonLines(ITEMS_FILE)) {
    batch.push({
      _id: key,
      label: data.label || key,
      aliases: data.aliases || []
    });

    if (batch.length >= BATCH_SIZE) {
      await collection.insertMany(batch, { ordered: false });
      count += batch.length;
      process.stdout.write(`\r   Loaded ${count} entities...`);
      batch = [];
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    await collection.insertMany(batch, { ordered: false });
    count += batch.length;
  }

  console.log(`\n   ✓ Loaded ${count} entities`);

  // Create index
  await collection.createIndex({ label: 1 });
  console.log('   ✓ Created label index');
}

/**
 * Load properties from filtered_property_wikidata4.json
 */
async function loadProperties(db) {
  console.log('\n📖 Loading properties from filtered_property_wikidata4.json...');

  const collection = db.collection('properties');
  await collection.deleteMany({}); // Clear existing data

  let count = 0;
  let batch = [];
  const BATCH_SIZE = 1000;

  for await (const { key, data } of streamJsonLines(PROPERTIES_FILE)) {
    batch.push({
      _id: key,
      label: data.label || key
    });

    if (batch.length >= BATCH_SIZE) {
      await collection.insertMany(batch, { ordered: false });
      count += batch.length;
      process.stdout.write(`\r   Loaded ${count} properties...`);
      batch = [];
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    await collection.insertMany(batch, { ordered: false });
    count += batch.length;
  }

  console.log(`\n   ✓ Loaded ${count} properties`);

  // Create index
  await collection.createIndex({ label: 1 });
  console.log('   ✓ Created label index');
}

/**
 * Load facts from comp_wikidata_rev.json
 * Format: { "Q123": { "P106": ["Q3455803", "Q57"], ... }, ... }
 */
async function loadFacts(db) {
  console.log('\n📖 Loading facts from comp_wikidata_rev.json...');

  const collection = db.collection('facts');
  await collection.deleteMany({}); // Clear existing data

  let count = 0;
  let batch = [];
  const BATCH_SIZE = 1000;

  for await (const { key: subject, data } of streamJsonLines(FACTS_FILE)) {
    // data is { "P106": ["Q3455803", ...], "P57": [...], ... }
    for (const [predicate, objects] of Object.entries(data)) {
      if (Array.isArray(objects)) {
        for (const object of objects) {
          batch.push({
            subject,
            predicate,
            object
          });

          if (batch.length >= BATCH_SIZE) {
            await collection.insertMany(batch, { ordered: false });
            count += batch.length;
            process.stdout.write(`\r   Loaded ${count} facts...`);
            batch = [];
          }
        }
      }
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    await collection.insertMany(batch, { ordered: false });
    count += batch.length;
  }

  console.log(`\n   ✓ Loaded ${count} facts`);

  // Create indexes for efficient querying
  await collection.createIndex({ subject: 1 });
  await collection.createIndex({ predicate: 1, object: 1 });
  await collection.createIndex({ subject: 1, predicate: 1 });
  console.log('   ✓ Created query indexes');
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Loading Wikidata subset into MongoDB...');
  console.log(`   Database: ${MONGO_URL}/${DB_NAME}`);

  // Verify files exist
  if (!fs.existsSync(ITEMS_FILE)) {
    throw new Error(`Items file not found: ${ITEMS_FILE}`);
  }
  if (!fs.existsSync(PROPERTIES_FILE)) {
    throw new Error(`Properties file not found: ${PROPERTIES_FILE}`);
  }
  if (!fs.existsSync(FACTS_FILE)) {
    throw new Error(`Facts file not found: ${FACTS_FILE}`);
  }

  // Connect to MongoDB
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  console.log('✓ Connected to MongoDB');

  try {
    const db = client.db(DB_NAME);

    // Load all data
    await loadEntities(db);
    await loadProperties(db);
    await loadFacts(db);

    // Show summary
    const entityCount = await db.collection('entities').countDocuments();
    const propertyCount = await db.collection('properties').countDocuments();
    const factCount = await db.collection('facts').countDocuments();

    console.log('\n✅ Loading complete!');
    console.log(`   Entities:   ${entityCount.toLocaleString()}`);
    console.log(`   Properties: ${propertyCount.toLocaleString()}`);
    console.log(`   Facts:      ${factCount.toLocaleString()}`);

  } finally {
    await client.close();
    console.log('\n✓ MongoDB connection closed');
  }
}

// Run
main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
