import { MongoClient } from 'mongodb';
import { QdrantClient } from '@qdrant/js-client-rest';

console.log('🔧 Indexing perspectives to Qdrant tool_perspectives collection...');

// Connect to MongoDB  
const mongoClient = new MongoClient('mongodb://localhost:27017');
await mongoClient.connect();
const db = mongoClient.db('legion_tools');

// Connect to Qdrant
const qdrant = new QdrantClient({ url: 'http://localhost:6333' });

// Get all perspectives with embeddings
console.log('📋 Fetching perspectives from MongoDB...');
const perspectives = await db.collection('tool_perspectives').find({
  embedding: { $exists: true, $ne: null }
}).toArray();

console.log(`Found ${perspectives.length} perspectives with embeddings`);

if (perspectives.length === 0) {
  console.log('❌ No perspectives with embeddings found');
  await mongoClient.close();
  process.exit(1);
}

// Ensure tool_perspectives collection exists in Qdrant
try {
  const collectionInfo = await qdrant.getCollection('tool_perspectives');
  console.log(`✅ tool_perspectives collection exists with ${collectionInfo.points_count} points`);
} catch (error) {
  console.log('📝 Creating tool_perspectives collection...');
  await qdrant.createCollection('tool_perspectives', {
    vectors: {
      size: 768, // Nomic embeddings dimension
      distance: 'Cosine'
    }
  });
  console.log('✅ Created tool_perspectives collection');
}

/**
 * Generate numeric ID from MongoDB ObjectId
 */
function generateNumericId(objectId) {
  // Convert ObjectId to a numeric hash
  const str = objectId.toString();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Prepare points for Qdrant
const points = perspectives.map((perspective) => ({
  id: generateNumericId(perspective._id), // Use numeric hash of MongoDB _id
  vector: perspective.embedding,
  payload: {
    perspectiveId: perspective._id.toString(),
    toolId: perspective.toolId?.toString() || null,
    toolName: perspective.toolName,
    perspectiveType: perspective.perspectiveType,
    perspectiveText: perspective.perspectiveText,
    priority: perspective.priority || 100
  }
}));

console.log(`📋 Indexing ${points.length} vectors to Qdrant...`);

// Clear existing vectors first
try {
  await qdrant.deleteCollection('tool_perspectives');
  console.log('🧹 Cleared existing tool_perspectives collection');
} catch (error) {
  console.log('ℹ️ No existing collection to clear');
}

// Recreate collection
await qdrant.createCollection('tool_perspectives', {
  vectors: {
    size: 768,
    distance: 'Cosine'
  }
});

// Index vectors in batches
const batchSize = 100;
let indexed = 0;

for (let i = 0; i < points.length; i += batchSize) {
  const batch = points.slice(i, i + batchSize);
  
  await qdrant.upsert('tool_perspectives', {
    wait: true,
    points: batch
  });
  
  indexed += batch.length;
  console.log(`  ✅ Indexed ${indexed}/${points.length} vectors`);
}

// Verify
const finalInfo = await qdrant.getCollection('tool_perspectives');
console.log(`✅ Indexing complete!`);
console.log(`  Points: ${finalInfo.points_count}`);
console.log(`  Indexed: ${finalInfo.indexed_vectors_count}`);
console.log(`  Status: ${finalInfo.status}`);

await mongoClient.close();
console.log('✅ Indexing completed successfully!');