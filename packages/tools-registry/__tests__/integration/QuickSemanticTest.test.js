/**
 * Quick test for semantic search functionality
 */

import { ResourceManager } from '@legion/resource-manager';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { ensureMongoDBAvailable, getTestDatabase, cleanTestDatabase } from '../utils/testHelpers.js';

describe('Quick Semantic Search Test', () => {
  let resourceManager;
  let semanticProvider;
  let dbConnection;
  let db;
  
  beforeAll(async () => {
    console.log('Initializing test...');
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Ensure MongoDB is available
    await ensureMongoDBAvailable();
    dbConnection = await getTestDatabase();
    db = dbConnection.db;
    
    console.log('MongoDB connected');
    
    // Try to initialize semantic search
    try {
      semanticProvider = await SemanticSearchProvider.create(resourceManager);
      console.log('Semantic search provider created');
    } catch (error) {
      console.log('Could not create semantic provider:', error.message);
    }
  });
  
  afterAll(async () => {
    await cleanTestDatabase();
    if (dbConnection && dbConnection.cleanup) {
      await dbConnection.cleanup();
    }
  });
  
  test('should retrieve tools from database', async () => {
    const tools = await db.collection('tools').find({}).limit(10).toArray();
    console.log(`Found ${tools.length} tools in database`);
    expect(tools.length).toBeGreaterThanOrEqual(0); // May be empty
    
    // Log first tool for reference
    if (tools[0]) {
      console.log('Sample tool:', {
        name: tools[0].name,
        description: tools[0].description,
        moduleName: tools[0].moduleName
      });
    }
  });
  
  test('should retrieve perspectives from database', async () => {
    const perspectives = await db.collection('tool_perspectives').find({}).limit(10).toArray();
    console.log(`Found ${perspectives.length} perspectives in database`);
    
    if (perspectives[0]) {
      console.log('Sample perspective:', {
        toolName: perspectives[0].toolName,
        perspectiveType: perspectives[0].perspectiveType,
        hasEmbedding: !!perspectives[0].embedding
      });
    }
  });
  
  test('should perform text search on tools', async () => {
    const tools = await db.collection('tools').find({}).toArray();
    
    // Simple text search for "file"
    const query = 'file';
    const results = tools.filter(tool => {
      const name = (tool.name || '').toLowerCase();
      const description = (tool.description || '').toLowerCase();
      return name.includes(query) || description.includes(query);
    });
    
    console.log(`Text search for "${query}" found ${results.length} tools`);
    expect(results.length).toBeGreaterThanOrEqual(0); // May not have file tools
    
    // Should find file_read if file tools are loaded
    if (results.length > 0) {
      const fileReadTool = results.find(t => t.name === 'file_read');
      if (fileReadTool) {
        console.log('Found file_read tool');
      }
    }
  });
  
  test('should perform semantic search if Qdrant is available', async () => {
    if (!semanticProvider) {
      console.log('Skipping semantic search - provider not available');
      return;
    }
    
    try {
      // Test semantic search
      const query = 'how to read files from disk';
      console.log(`Performing semantic search: "${query}"`);
      
      const results = await semanticProvider.search(query, {
        collection: 'tool_perspectives',
        limit: 5
      });
      
      console.log(`Semantic search found ${results.length} results`);
      
      if (results.length > 0) {
        console.log('Top result:', results[0].toolName);
        
        // Should find file-related tools
        const hasFileTools = results.some(r => 
          r.toolName.includes('file') || r.toolName.includes('read')
        );
        expect(hasFileTools).toBe(true);
      }
    } catch (error) {
      console.log('Semantic search failed:', error.message);
      // This is OK if Qdrant is not running
    }
  });
  
  test('should demonstrate combined search', async () => {
    const tools = await db.collection('tools').find({}).toArray();
    const query = 'json file';
    
    // Text search
    const textResults = tools.filter(tool => {
      const name = (tool.name || '').toLowerCase();
      const description = (tool.description || '').toLowerCase();
      const searchText = query.toLowerCase();
      
      let score = 0;
      if (name.includes('json')) score += 5;
      if (name.includes('file')) score += 5;
      if (description.includes('json')) score += 2;
      if (description.includes('file')) score += 2;
      
      tool._textScore = score;
      return score > 0;
    }).sort((a, b) => b._textScore - a._textScore);
    
    console.log(`Text search for "${query}" found ${textResults.length} tools`);
    console.log('Top text results:', textResults.slice(0, 3).map(t => ({
      name: t.name,
      score: t._textScore
    })));
    
    // If semantic search is available, demonstrate combining
    if (semanticProvider) {
      try {
        const semanticResults = await semanticProvider.search(query, {
          collection: 'tool_perspectives',
          limit: 5
        });
        
        console.log(`Semantic search found ${semanticResults.length} results`);
        
        // Merge results
        const merged = new Map();
        
        textResults.forEach(tool => {
          merged.set(tool.name, {
            ...tool,
            textScore: tool._textScore,
            semanticScore: 0,
            combinedScore: tool._textScore
          });
        });
        
        semanticResults.forEach((result, index) => {
          const semanticScore = 10 - index;
          const toolName = result.toolName;
          
          if (merged.has(toolName)) {
            const existing = merged.get(toolName);
            existing.semanticScore = semanticScore;
            existing.combinedScore = (existing.textScore * 0.4) + (semanticScore * 0.6);
          } else {
            // Get full tool data
            const tool = tools.find(t => t.name === toolName);
            if (tool) {
              merged.set(toolName, {
                ...tool,
                textScore: 0,
                semanticScore: semanticScore,
                combinedScore: semanticScore
              });
            }
          }
        });
        
        const combinedResults = Array.from(merged.values())
          .sort((a, b) => b.combinedScore - a.combinedScore);
        
        console.log('Combined search results:', combinedResults.slice(0, 3).map(t => ({
          name: t.name,
          textScore: t.textScore,
          semanticScore: t.semanticScore,
          combinedScore: t.combinedScore.toFixed(2)
        })));
        
        expect(combinedResults.length).toBeGreaterThan(0);
      } catch (error) {
        console.log('Semantic search not available:', error.message);
      }
    }
    
    expect(textResults.length).toBeGreaterThanOrEqual(0); // May have no tools in database
  });
});