/**
 * Index management for the Optimal 3-Field Capability Model
 * Optimized for 3-field structure: _id, subtypeOf, kind, attributes
 */

import { Collection, Db } from 'mongodb';

export class IndexManager {
  /**
   * Create all indexes for the minimal capability model
   * Optimized for the 3-field structure
   */
  static async createIndexes(db: Db, collectionName: string = 'capabilities'): Promise<void> {
    const collection = db.collection(collectionName);
    
    console.log('Creating indexes for minimal capability model...');

    // Essential indexes for minimal model (only 3 core fields)
    await this.createCoreIndexes(collection);
    
    // Attribute-based indexes (everything else is in attributes)
    await this.createAttributeIndexes(collection);
    
    // Performance indexes for common queries
    await this.createPerformanceIndexes(collection);
    
    console.log('All indexes created successfully');
  }

  /**
   * Create core indexes for the optimal 3-field model
   */
  private static async createCoreIndexes(collection: Collection): Promise<void> {
    // 1. _id is automatically indexed by MongoDB (unique, business identity)
    // No need to create explicit index for _id
    
    // 2. Index on subtypeOf (universal inheritance - core field)
    await collection.createIndex(
      { subtypeOf: 1 }, 
      { 
        name: 'idx_subtypeOf',
        background: true 
      }
    );

    // 3. Index on kind (performance classification)
    await collection.createIndex(
      { kind: 1 }, 
      { 
        name: 'idx_kind',
        background: true 
      }
    );

    // 4. Compound index for subtypeOf + kind (inheritance + classification)
    await collection.createIndex(
      { subtypeOf: 1, kind: 1 }, 
      { 
        name: 'idx_subtypeOf_kind',
        background: true 
      }
    );

    // 5. Compound index for kind + subtypeOf (classification + inheritance)
    await collection.createIndex(
      { kind: 1, subtypeOf: 1 }, 
      { 
        name: 'idx_kind_subtypeOf',
        background: true 
      }
    );

    console.log('✓ Core indexes created (optimal 3-field model)');
  }

  /**
   * Create attribute-based indexes (everything else is in attributes)
   */
  private static async createAttributeIndexes(collection: Collection): Promise<void> {
    // Combined text search index (MongoDB allows only one text index per collection)
    await collection.createIndex(
      { 
        'attributes.name': 'text',
        'attributes.description': 'text'
      }, 
      { 
        name: 'idx_attr_text_search',
        background: true 
      }
    );

    // Timestamp attributes (now in attributes!)
    await collection.createIndex(
      { 'attributes.createdAt': 1 }, 
      { 
        name: 'idx_attr_created_at',
        background: true 
      }
    );

    await collection.createIndex(
      { 'attributes.updatedAt': 1 }, 
      { 
        name: 'idx_attr_updated_at',
        background: true 
      }
    );

    // Relationship attributes (subtypeOf is now a core field, not an attribute)

    await collection.createIndex(
      { 'attributes.parts': 1 }, 
      { 
        name: 'idx_attr_parts',
        background: true 
      }
    );

    await collection.createIndex(
      { 'attributes.partOf': 1 }, 
      { 
        name: 'idx_attr_part_of',
        background: true 
      }
    );

    await collection.createIndex(
      { 'attributes.uses': 1 }, 
      { 
        name: 'idx_attr_uses',
        background: true 
      }
    );

    await collection.createIndex(
      { 'attributes.requires': 1 }, 
      { 
        name: 'idx_attr_requires',
        background: true 
      }
    );

    // Value-based attributes
    await collection.createIndex(
      { 'attributes.cost': 1 }, 
      { 
        name: 'idx_attr_cost',
        background: true 
      }
    );

    await collection.createIndex(
      { 'attributes.duration': 1 }, 
      { 
        name: 'idx_attr_duration',
        background: true 
      }
    );

    await collection.createIndex(
      { 'attributes.difficulty': 1 }, 
      { 
        name: 'idx_attr_difficulty',
        background: true 
      }
    );

    console.log('✓ Attribute indexes created (everything in attributes)');
  }

  /**
   * Create compound indexes for common query patterns
   */
  private static async createPerformanceIndexes(collection: Collection): Promise<void> {
    // Kind + cost range queries
    await collection.createIndex(
      { kind: 1, 'attributes.cost': 1 }, 
      { 
        name: 'idx_kind_cost',
        background: true 
      }
    );

    // Part-of relationship + kind (common traversal)
    await collection.createIndex(
      { 'attributes.partOf': 1, kind: 1 }, 
      { 
        name: 'idx_part_of_kind',
        background: true 
      }
    );

    // Note: subtypeOf + kind index already created in core indexes as 'idx_subtypeOf_kind'

    // Uses relationship + kind (usage queries)
    await collection.createIndex(
      { 'attributes.uses': 1, kind: 1 }, 
      { 
        name: 'idx_uses_kind',
        background: true 
      }
    );

    // Created date + kind (temporal queries)
    await collection.createIndex(
      { 'attributes.createdAt': 1, kind: 1 }, 
      { 
        name: 'idx_created_at_kind',
        background: true 
      }
    );


    console.log('✓ Performance indexes created (optimized for minimal model)');
  }

  /**
   * Drop all indexes (for testing or rebuilding)
   */
  static async dropAllIndexes(db: Db, collectionName: string = 'capabilities'): Promise<void> {
    const collection = db.collection(collectionName);
    
    try {
      await collection.dropIndexes();
      console.log('All indexes dropped');
    } catch (error) {
      console.error('Error dropping indexes:', error);
      throw error;
    }
  }

  /**
   * List all indexes
   */
  static async listIndexes(db: Db, collectionName: string = 'capabilities'): Promise<any[]> {
    const collection = db.collection(collectionName);
    return await collection.listIndexes().toArray();
  }

  /**
   * Get index statistics
   */
  static async getIndexStats(db: Db, collectionName: string = 'capabilities'): Promise<any> {
    const collection = db.collection(collectionName);
    
    try {
      const stats = await collection.aggregate([
        { $indexStats: {} }
      ]).toArray();
      
      return stats;
    } catch (error) {
      console.error('Error getting index stats:', error);
      return [];
    }
  }

  /**
   * Analyze query performance for common patterns
   */
  static async analyzeQueryPerformance(db: Db, collectionName: string = 'capabilities'): Promise<any> {
    const collection = db.collection(collectionName);
    
    const analyses = [];
    
    // Test common query patterns
    const testQueries = [
      // Kind-based queries
      { kind: 'action.task' },
      { kind: /^action\./ },
      
      // Attribute-based queries
      { 'attributes.subtypeOf': 'install_sink' },
      { 'attributes.partOf': 'bathroom_renovation' },
      { 'attributes.cost': { $lt: 100 } },
      
      // Compound queries
      { kind: 'action.task', 'attributes.cost': { $lt: 50 } },
      { 'attributes.partOf': 'package_id', kind: 'action.use' },
    ];

    for (const query of testQueries) {
      try {
        const explanation = await collection.find(query).explain('executionStats');
        analyses.push({
          query,
          executionStats: explanation.executionStats,
          indexUsed: explanation.queryPlanner?.winningPlan?.inputStage?.indexName || 'none'
        });
      } catch (error) {
        console.error('Error analyzing query:', query, error);
      }
    }
    
    return analyses;
  }

  /**
   * Optimize indexes based on usage patterns
   */
  static async optimizeIndexes(db: Db, collectionName: string = 'capabilities'): Promise<void> {
    console.log('Analyzing index usage patterns...');
    
    const stats = await this.getIndexStats(db, collectionName);
    const performance = await this.analyzeQueryPerformance(db, collectionName);
    
    // Log recommendations
    console.log('Index optimization recommendations:');
    
    stats.forEach((stat: any) => {
      if (stat.accesses?.ops === 0) {
        console.log(`⚠️  Index "${stat.name}" is unused - consider dropping`);
      } else if (stat.accesses?.ops > 1000) {
        console.log(`✓ Index "${stat.name}" is heavily used (${stat.accesses.ops} ops)`);
      }
    });
    
    performance.forEach((perf: any) => {
      if (perf.indexUsed === 'none') {
        console.log(`⚠️  Query needs index:`, perf.query);
      }
    });
  }
}

/**
 * Setup script for creating all indexes
 */
export async function setupIndexes(db: Db, collectionName: string = 'capabilities'): Promise<void> {
  try {
    await IndexManager.createIndexes(db, collectionName);
    console.log('✅ Index setup complete for minimal capability model');
  } catch (error) {
    console.error('❌ Index setup failed:', error);
    throw error;
  }
}
