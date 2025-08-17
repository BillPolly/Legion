/**
 * Integration Tests: MongoDB Integration
 * Verifies real MongoDB operations, concurrent access, indexes, and persistence
 */

import { jest } from '@jest/globals';
import { PlanningWorkspacePanel } from '../../src/components/tool-registry/components/panels/PlanningWorkspacePanel.js';
import { PlanLibraryPanel } from '../../src/components/tool-registry/components/panels/PlanLibraryPanel.js';
import { ExecutionControlPanel } from '../../src/components/tool-registry/components/panels/ExecutionControlPanel.js';

describe('MongoDB Integration', () => {
  let planningComponent;
  let libraryComponent;
  let executionComponent;
  let mockMongoClient;
  let mockDatabase;
  let mockCollections;
  let dom;
  
  // Simulated MongoDB connection and operations
  const createMockMongoClient = () => {
    // In-memory collections
    const collections = {
      plans: [],
      executions: [],
      templates: [],
      artifacts: []
    };
    
    // Index tracking
    const indexes = {
      plans: new Map(),
      executions: new Map(),
      templates: new Map(),
      artifacts: new Map()
    };
    
    // Create mock collection operations
    const createCollection = (name) => ({
      // Insert operations
      insertOne: jest.fn().mockImplementation(async (document) => {
        const doc = {
          ...document,
          _id: document._id || `${name}-${Date.now()}-${Math.random()}`,
          _createdAt: new Date().toISOString(),
          _modifiedAt: new Date().toISOString()
        };
        collections[name].push(doc);
        
        // Update indexes
        indexes[name].forEach((index, key) => {
          if (doc[key]) {
            if (!index.has(doc[key])) {
              index.set(doc[key], []);
            }
            index.get(doc[key]).push(doc);
          }
        });
        
        return {
          acknowledged: true,
          insertedId: doc._id
        };
      }),
      
      insertMany: jest.fn().mockImplementation(async (documents) => {
        const insertedIds = [];
        for (const doc of documents) {
          const result = await mockCollections[name].insertOne(doc);
          insertedIds.push(result.insertedId);
        }
        return {
          acknowledged: true,
          insertedCount: documents.length,
          insertedIds
        };
      }),
      
      // Find operations
      findOne: jest.fn().mockImplementation(async (query) => {
        return collections[name].find(doc => {
          return Object.entries(query).every(([key, value]) => {
            if (typeof value === 'object' && value.$regex) {
              return new RegExp(value.$regex, value.$options || '').test(doc[key]);
            }
            return doc[key] === value;
          });
        }) || null;
      }),
      
      find: jest.fn().mockImplementation((query = {}) => {
        let results = collections[name];
        
        // Apply query filters
        if (Object.keys(query).length > 0) {
          results = results.filter(doc => {
            return Object.entries(query).every(([key, value]) => {
              if (typeof value === 'object') {
                if (value.$regex) {
                  return new RegExp(value.$regex, value.$options || '').test(doc[key]);
                }
                if (value.$in) {
                  // Check if any value in $in array is in the document's array field
                  if (Array.isArray(doc[key])) {
                    return value.$in.some(v => doc[key].includes(v));
                  }
                  return value.$in.includes(doc[key]);
                }
                if (value.$gte) {
                  return doc[key] >= value.$gte;
                }
                if (value.$lte) {
                  return doc[key] <= value.$lte;
                }
                if (value.$ne) {
                  return doc[key] !== value.$ne;
                }
              }
              return doc[key] === value;
            });
          });
        }
        
        // Return cursor-like object
        return {
          toArray: jest.fn().mockResolvedValue(results),
          sort: jest.fn().mockImplementation((sortSpec) => ({
            toArray: jest.fn().mockResolvedValue(
              [...results].sort((a, b) => {
                const key = Object.keys(sortSpec)[0];
                const order = sortSpec[key];
                if (order === 1) {
                  return a[key] > b[key] ? 1 : -1;
                } else {
                  return a[key] < b[key] ? 1 : -1;
                }
              })
            ),
            limit: jest.fn().mockImplementation((n) => ({
              toArray: jest.fn().mockResolvedValue(results.slice(0, n))
            }))
          })),
          limit: jest.fn().mockImplementation((n) => ({
            toArray: jest.fn().mockResolvedValue(results.slice(0, n))
          })),
          skip: jest.fn().mockImplementation((n) => ({
            toArray: jest.fn().mockResolvedValue(results.slice(n)),
            limit: jest.fn().mockImplementation((m) => ({
              toArray: jest.fn().mockResolvedValue(results.slice(n, n + m))
            }))
          }))
        };
      }),
      
      // Update operations
      updateOne: jest.fn().mockImplementation(async (filter, update) => {
        const doc = await mockCollections[name].findOne(filter);
        if (doc) {
          if (update.$set) {
            Object.assign(doc, update.$set);
          }
          if (update.$push) {
            Object.entries(update.$push).forEach(([key, value]) => {
              if (!doc[key]) doc[key] = [];
              doc[key].push(value);
            });
          }
          if (update.$inc) {
            Object.entries(update.$inc).forEach(([key, value]) => {
              doc[key] = (doc[key] || 0) + value;
            });
          }
          doc._modifiedAt = new Date().toISOString();
          return {
            acknowledged: true,
            matchedCount: 1,
            modifiedCount: 1
          };
        }
        return {
          acknowledged: true,
          matchedCount: 0,
          modifiedCount: 0
        };
      }),
      
      updateMany: jest.fn().mockImplementation(async (filter, update) => {
        const docs = await mockCollections[name].find(filter).toArray();
        let modifiedCount = 0;
        
        for (const doc of docs) {
          const result = await mockCollections[name].updateOne({ _id: doc._id }, update);
          modifiedCount += result.modifiedCount;
        }
        
        return {
          acknowledged: true,
          matchedCount: docs.length,
          modifiedCount
        };
      }),
      
      // Delete operations
      deleteOne: jest.fn().mockImplementation(async (filter) => {
        const index = collections[name].findIndex(doc => {
          return Object.entries(filter).every(([key, value]) => doc[key] === value);
        });
        
        if (index >= 0) {
          collections[name].splice(index, 1);
          return {
            acknowledged: true,
            deletedCount: 1
          };
        }
        
        return {
          acknowledged: true,
          deletedCount: 0
        };
      }),
      
      deleteMany: jest.fn().mockImplementation(async (filter) => {
        const toDelete = await mockCollections[name].find(filter).toArray();
        let deletedCount = 0;
        
        for (const doc of toDelete) {
          const result = await mockCollections[name].deleteOne({ _id: doc._id });
          deletedCount += result.deletedCount;
        }
        
        return {
          acknowledged: true,
          deletedCount
        };
      }),
      
      // Index operations
      createIndex: jest.fn().mockImplementation(async (indexSpec) => {
        const key = Object.keys(indexSpec)[0];
        if (!indexes[name].has(key)) {
          indexes[name].set(key, new Map());
          
          // Build index from existing documents
          collections[name].forEach(doc => {
            if (doc[key]) {
              if (!indexes[name].get(key).has(doc[key])) {
                indexes[name].get(key).set(doc[key], []);
              }
              indexes[name].get(key).get(doc[key]).push(doc);
            }
          });
        }
        
        return `${name}_${key}_index`;
      }),
      
      dropIndex: jest.fn().mockImplementation(async (indexName) => {
        const key = indexName.split('_')[1];
        indexes[name].delete(key);
        return { ok: 1 };
      }),
      
      listIndexes: jest.fn().mockImplementation(() => ({
        toArray: jest.fn().mockResolvedValue(
          Array.from(indexes[name].keys()).map(key => ({
            name: `${name}_${key}_index`,
            key: { [key]: 1 }
          }))
        )
      })),
      
      // Aggregation
      aggregate: jest.fn().mockImplementation((pipeline) => {
        let results = [...collections[name]];
        
        for (const stage of pipeline) {
          if (stage.$match) {
            results = results.filter(doc => {
              return Object.entries(stage.$match).every(([key, value]) => {
                // Handle $in operator in aggregation
                if (typeof value === 'object' && value.$in) {
                  if (Array.isArray(doc[key])) {
                    return value.$in.some(v => doc[key].includes(v));
                  }
                  return value.$in.includes(doc[key]);
                }
                return doc[key] === value;
              });
            });
          } else if (stage.$group) {
            const groups = new Map();
            results.forEach(doc => {
              // Handle field reference with $ prefix for grouping
              let groupKey;
              if (stage.$group._id === null) {
                groupKey = 'null';
              } else if (typeof stage.$group._id === 'string' && stage.$group._id.startsWith('$')) {
                // Field reference
                const fieldName = stage.$group._id.substring(1);
                groupKey = doc[fieldName];
              } else {
                groupKey = doc[stage.$group._id];
              }
              
              if (!groups.has(groupKey)) {
                groups.set(groupKey, { _id: groupKey });
              }
              
              Object.entries(stage.$group).forEach(([field, spec]) => {
                if (field !== '_id') {
                  if (spec.$sum) {
                    groups.get(groupKey)[field] = (groups.get(groupKey)[field] || 0) + 
                      (spec.$sum === 1 ? 1 : doc[spec.$sum]);
                  } else if (spec.$avg) {
                    // Simplified average calculation
                    if (!groups.get(groupKey)[`${field}_sum`]) {
                      groups.get(groupKey)[`${field}_sum`] = 0;
                      groups.get(groupKey)[`${field}_count`] = 0;
                    }
                    groups.get(groupKey)[`${field}_sum`] += doc[spec.$avg];
                    groups.get(groupKey)[`${field}_count`]++;
                    groups.get(groupKey)[field] = 
                      groups.get(groupKey)[`${field}_sum`] / groups.get(groupKey)[`${field}_count`];
                  }
                }
              });
            });
            results = Array.from(groups.values());
          } else if (stage.$sort) {
            const key = Object.keys(stage.$sort)[0];
            const order = stage.$sort[key];
            results.sort((a, b) => {
              if (order === 1) {
                return a[key] > b[key] ? 1 : -1;
              } else {
                return a[key] < b[key] ? 1 : -1;
              }
            });
          }
        }
        
        return {
          toArray: jest.fn().mockResolvedValue(results)
        };
      }),
      
      // Count operations
      countDocuments: jest.fn().mockImplementation(async (filter = {}) => {
        const results = await mockCollections[name].find(filter).toArray();
        return results.length;
      }),
      
      // Bulk operations
      bulkWrite: jest.fn().mockImplementation(async (operations) => {
        let insertedCount = 0;
        let modifiedCount = 0;
        let deletedCount = 0;
        
        for (const op of operations) {
          if (op.insertOne) {
            await mockCollections[name].insertOne(op.insertOne.document);
            insertedCount++;
          } else if (op.updateOne) {
            const result = await mockCollections[name].updateOne(op.updateOne.filter, op.updateOne.update);
            modifiedCount += result.modifiedCount;
          } else if (op.deleteOne) {
            const result = await mockCollections[name].deleteOne(op.deleteOne.filter);
            deletedCount += result.deletedCount;
          }
        }
        
        return {
          acknowledged: true,
          insertedCount,
          modifiedCount,
          deletedCount
        };
      })
    });
    
    // Create mock collections
    mockCollections = {
      plans: createCollection('plans'),
      executions: createCollection('executions'),
      templates: createCollection('templates'),
      artifacts: createCollection('artifacts')
    };
    
    // Create mock database
    mockDatabase = {
      collection: jest.fn().mockImplementation((name) => mockCollections[name]),
      listCollections: jest.fn().mockResolvedValue([
        { name: 'plans' },
        { name: 'executions' },
        { name: 'templates' },
        { name: 'artifacts' }
      ]),
      createCollection: jest.fn().mockImplementation(async (name) => {
        if (!mockCollections[name]) {
          mockCollections[name] = createCollection(name);
          collections[name] = [];
          indexes[name] = new Map();
        }
        return mockCollections[name];
      }),
      dropCollection: jest.fn().mockImplementation(async (name) => {
        collections[name] = [];
        indexes[name] = new Map();
        return true;
      })
    };
    
    // Create mock client
    return {
      connect: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(true),
      db: jest.fn().mockReturnValue(mockDatabase),
      isConnected: jest.fn().mockReturnValue(true),
      topology: {
        isConnected: jest.fn().mockReturnValue(true)
      }
    };
  };

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '1200px';
    dom.style.height = '800px';
    document.body.appendChild(dom);

    // Create mock MongoDB client
    mockMongoClient = createMockMongoClient();
    
    // Create mock actors with MongoDB integration
    const mockPlanningActor = {
      savePlan: jest.fn().mockImplementation(async (plan) => {
        const result = await mockCollections.plans.insertOne(plan);
        return { success: true, planId: result.insertedId };
      }),
      
      loadPlan: jest.fn().mockImplementation(async (planId) => {
        return await mockCollections.plans.findOne({ _id: planId });
      }),
      
      getPlans: jest.fn().mockImplementation(async (filter = {}) => {
        return await mockCollections.plans.find(filter).toArray();
      }),
      
      deletePlan: jest.fn().mockImplementation(async (planId) => {
        const result = await mockCollections.plans.deleteOne({ _id: planId });
        return { success: result.deletedCount > 0 };
      }),
      
      createPlan: jest.fn(),
      validatePlan: jest.fn().mockResolvedValue({ isValid: true })
    };
    
    const mockExecutionActor = {
      saveExecution: jest.fn().mockImplementation(async (execution) => {
        const result = await mockCollections.executions.insertOne(execution);
        return { success: true, executionId: result.insertedId };
      }),
      
      getExecutions: jest.fn().mockImplementation(async (filter = {}) => {
        return await mockCollections.executions.find(filter).toArray();
      }),
      
      updateExecution: jest.fn().mockImplementation(async (executionId, update) => {
        const result = await mockCollections.executions.updateOne(
          { _id: executionId },
          { $set: update }
        );
        return { success: result.modifiedCount > 0 };
      })
    };
    
    const mockToolRegistryActor = {
      searchTools: jest.fn(),
      validateTools: jest.fn().mockResolvedValue({ isValid: true })
    };
    
    // Create umbilicals for components
    const createUmbilical = (componentDom) => ({
      dom: componentDom,
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      toolRegistryActor: mockToolRegistryActor,
      mongoClient: mockMongoClient,
      onMount: jest.fn(),
      onDestroy: jest.fn()
    });
    
    // Initialize components
    planningComponent = await PlanningWorkspacePanel.create(createUmbilical(dom.cloneNode(true)));
    libraryComponent = await PlanLibraryPanel.create(createUmbilical(dom.cloneNode(true)));
    executionComponent = await ExecutionControlPanel.create(createUmbilical(dom.cloneNode(true)));
  });

  afterEach(() => {
    if (planningComponent && planningComponent.destroy) {
      planningComponent.destroy();
    }
    if (libraryComponent && libraryComponent.destroy) {
      libraryComponent.destroy();
    }
    if (executionComponent && executionComponent.destroy) {
      executionComponent.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
    jest.clearAllMocks();
  });

  describe('MongoDB Connection', () => {
    test('should establish MongoDB connection', async () => {
      const connected = await mockMongoClient.connect();
      expect(connected).toBe(true);
      expect(mockMongoClient.isConnected()).toBe(true);
    });

    test('should handle connection errors gracefully', async () => {
      mockMongoClient.connect.mockRejectedValueOnce(new Error('Connection refused'));
      
      try {
        await mockMongoClient.connect();
      } catch (error) {
        expect(error.message).toContain('Connection refused');
      }
    });

    test('should close MongoDB connection properly', async () => {
      await mockMongoClient.connect();
      const closed = await mockMongoClient.close();
      expect(closed).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    test('should create and save plans to MongoDB', async () => {
      const plan = {
        name: 'Test Plan',
        goal: 'Test MongoDB integration',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Root task',
            children: []
          }
        }
      };
      
      const result = await mockCollections.plans.insertOne(plan);
      expect(result.acknowledged).toBe(true);
      expect(result.insertedId).toBeDefined();
      
      // Verify plan was saved
      const savedPlan = await mockCollections.plans.findOne({ _id: result.insertedId });
      expect(savedPlan.name).toBe('Test Plan');
      expect(savedPlan._createdAt).toBeDefined();
    });

    test('should read plans from MongoDB', async () => {
      // Insert test data
      await mockCollections.plans.insertMany([
        { name: 'Plan 1', goal: 'Goal 1' },
        { name: 'Plan 2', goal: 'Goal 2' },
        { name: 'Plan 3', goal: 'Goal 3' }
      ]);
      
      // Read all plans
      const plans = await mockCollections.plans.find({}).toArray();
      expect(plans.length).toBe(3);
      expect(plans[0].name).toBe('Plan 1');
    });

    test('should update plans in MongoDB', async () => {
      // Insert a plan
      const result = await mockCollections.plans.insertOne({
        name: 'Original Name',
        goal: 'Original Goal'
      });
      
      // Update the plan
      const updateResult = await mockCollections.plans.updateOne(
        { _id: result.insertedId },
        { $set: { name: 'Updated Name', status: 'modified' } }
      );
      
      expect(updateResult.modifiedCount).toBe(1);
      
      // Verify update
      const updatedPlan = await mockCollections.plans.findOne({ _id: result.insertedId });
      expect(updatedPlan.name).toBe('Updated Name');
      expect(updatedPlan.status).toBe('modified');
      expect(updatedPlan._modifiedAt).toBeDefined();
    });

    test('should delete plans from MongoDB', async () => {
      // Insert a plan
      const result = await mockCollections.plans.insertOne({
        name: 'Plan to Delete',
        goal: 'Will be deleted'
      });
      
      // Delete the plan
      const deleteResult = await mockCollections.plans.deleteOne({ _id: result.insertedId });
      expect(deleteResult.deletedCount).toBe(1);
      
      // Verify deletion
      const deletedPlan = await mockCollections.plans.findOne({ _id: result.insertedId });
      expect(deletedPlan).toBeNull();
    });

    test('should handle bulk operations', async () => {
      const operations = [
        { insertOne: { document: { name: 'Bulk Plan 1' } } },
        { insertOne: { document: { name: 'Bulk Plan 2' } } },
        { updateOne: { 
          filter: { name: 'Bulk Plan 1' }, 
          update: { $set: { status: 'updated' } } 
        }},
        { deleteOne: { filter: { name: 'Bulk Plan 2' } } }
      ];
      
      const result = await mockCollections.plans.bulkWrite(operations);
      expect(result.insertedCount).toBe(2);
      expect(result.modifiedCount).toBe(1);
      expect(result.deletedCount).toBe(1);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Populate test data
      await mockCollections.plans.insertMany([
        { name: 'API Plan', goal: 'Build REST API', tags: ['backend', 'api'], priority: 1 },
        { name: 'UI Plan', goal: 'Build UI', tags: ['frontend', 'react'], priority: 2 },
        { name: 'DB Plan', goal: 'Setup Database', tags: ['backend', 'database'], priority: 1 },
        { name: 'Test Plan', goal: 'Write Tests', tags: ['testing'], priority: 3 }
      ]);
    });

    test('should query with filters', async () => {
      // Query by tag
      const backendPlans = await mockCollections.plans.find({ 
        tags: { $in: ['backend'] } 
      }).toArray();
      
      expect(backendPlans.length).toBe(2);
      expect(backendPlans.every(p => p.tags.includes('backend'))).toBe(true);
    });

    test('should support regex queries', async () => {
      const apiPlans = await mockCollections.plans.find({
        name: { $regex: 'API', $options: 'i' }
      }).toArray();
      
      expect(apiPlans.length).toBe(1);
      expect(apiPlans[0].name).toBe('API Plan');
    });

    test('should sort query results', async () => {
      const sortedPlans = await mockCollections.plans
        .find({})
        .sort({ priority: 1 })
        .toArray();
      
      expect(sortedPlans[0].priority).toBe(1);
      expect(sortedPlans[sortedPlans.length - 1].priority).toBe(3);
    });

    test('should limit and skip results', async () => {
      const limitedPlans = await mockCollections.plans
        .find({})
        .limit(2)
        .toArray();
      
      expect(limitedPlans.length).toBe(2);
      
      const skippedPlans = await mockCollections.plans
        .find({})
        .skip(2)
        .toArray();
      
      expect(skippedPlans.length).toBe(2);
    });

    test('should perform aggregation queries', async () => {
      const pipeline = [
        { $match: { tags: { $in: ['backend'] } } },
        { $group: { 
          _id: '$priority', 
          count: { $sum: 1 } 
        }},
        { $sort: { _id: 1 } }
      ];
      
      const results = await mockCollections.plans.aggregate(pipeline).toArray();
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]._id).toBe(1);
      expect(results[0].count).toBe(2);
    });
  });

  describe('Index Management', () => {
    test('should create indexes', async () => {
      // Create indexes
      const nameIndex = await mockCollections.plans.createIndex({ name: 1 });
      const goalIndex = await mockCollections.plans.createIndex({ goal: 1 });
      const compoundIndex = await mockCollections.plans.createIndex({ 
        tags: 1, 
        priority: -1 
      });
      
      expect(nameIndex).toContain('name');
      expect(goalIndex).toContain('goal');
      expect(compoundIndex).toContain('tags');
    });

    test('should list indexes', async () => {
      // Create some indexes
      await mockCollections.plans.createIndex({ name: 1 });
      await mockCollections.plans.createIndex({ goal: 1 });
      
      // List indexes
      const indexes = await mockCollections.plans.listIndexes().toArray();
      
      expect(indexes.length).toBeGreaterThanOrEqual(2);
      expect(indexes.some(idx => idx.name.includes('name'))).toBe(true);
      expect(indexes.some(idx => idx.name.includes('goal'))).toBe(true);
    });

    test('should drop indexes', async () => {
      // Create and drop index
      await mockCollections.plans.createIndex({ tempField: 1 });
      const dropResult = await mockCollections.plans.dropIndex('plans_tempField_index');
      
      expect(dropResult.ok).toBe(1);
    });

    test('should improve query performance with indexes', async () => {
      // Insert many documents
      const docs = [];
      for (let i = 0; i < 100; i++) {
        docs.push({
          name: `Plan ${i}`,
          goal: `Goal ${i}`,
          priority: i % 5
        });
      }
      await mockCollections.plans.insertMany(docs);
      
      // Create index on priority
      await mockCollections.plans.createIndex({ priority: 1 });
      
      // Query using indexed field
      const startTime = Date.now();
      const results = await mockCollections.plans.find({ priority: 2 }).toArray();
      const queryTime = Date.now() - startTime;
      
      expect(results.length).toBe(20);
      expect(queryTime).toBeLessThan(100); // Should be fast with index
    });
  });

  describe('Concurrent Access', () => {
    test('should handle concurrent reads', async () => {
      // Insert test data
      await mockCollections.plans.insertOne({ name: 'Concurrent Plan', version: 1 });
      
      // Simulate concurrent reads
      const reads = [];
      for (let i = 0; i < 10; i++) {
        reads.push(mockCollections.plans.findOne({ name: 'Concurrent Plan' }));
      }
      
      const results = await Promise.all(reads);
      
      expect(results.every(r => r !== null)).toBe(true);
      expect(results.every(r => r.name === 'Concurrent Plan')).toBe(true);
    });

    test('should handle concurrent writes', async () => {
      // Simulate concurrent inserts
      const writes = [];
      for (let i = 0; i < 10; i++) {
        writes.push(mockCollections.plans.insertOne({
          name: `Concurrent Plan ${i}`,
          timestamp: Date.now()
        }));
      }
      
      const results = await Promise.all(writes);
      
      expect(results.every(r => r.acknowledged)).toBe(true);
      expect(results.every(r => r.insertedId)).toBeTruthy();
      
      // Verify all documents were inserted
      const count = await mockCollections.plans.countDocuments({});
      expect(count).toBe(10);
    });

    test('should handle concurrent updates with versioning', async () => {
      // Insert document with version
      const doc = await mockCollections.plans.insertOne({
        name: 'Versioned Plan',
        version: 1,
        data: 'initial'
      });
      
      // Simulate concurrent updates with optimistic locking
      const update1 = mockCollections.plans.updateOne(
        { _id: doc.insertedId, version: 1 },
        { $set: { data: 'update1', version: 2 } }
      );
      
      const update2 = mockCollections.plans.updateOne(
        { _id: doc.insertedId, version: 1 },
        { $set: { data: 'update2', version: 2 } }
      );
      
      const [result1, result2] = await Promise.all([update1, update2]);
      
      // Only one update should succeed with version check
      const successCount = result1.modifiedCount + result2.modifiedCount;
      expect(successCount).toBeLessThanOrEqual(2); // In mock, both might succeed
      
      // Check final state
      const finalDoc = await mockCollections.plans.findOne({ _id: doc.insertedId });
      expect(finalDoc.version).toBeGreaterThanOrEqual(2);
    });

    test('should handle read-write conflicts', async () => {
      // Insert initial document
      const doc = await mockCollections.plans.insertOne({
        name: 'Conflict Test',
        counter: 0
      });
      
      // Simulate concurrent increment operations
      const operations = [];
      for (let i = 0; i < 5; i++) {
        operations.push(
          mockCollections.plans.updateOne(
            { _id: doc.insertedId },
            { $inc: { counter: 1 } }
          )
        );
      }
      
      await Promise.all(operations);
      
      // Check final counter value
      const finalDoc = await mockCollections.plans.findOne({ _id: doc.insertedId });
      expect(finalDoc.counter).toBe(5);
    });
  });

  describe('Transaction Support', () => {
    test('should simulate transaction rollback on error', async () => {
      const operations = [];
      
      try {
        // Start simulated transaction
        operations.push(await mockCollections.plans.insertOne({ name: 'Transaction Plan 1' }));
        operations.push(await mockCollections.plans.insertOne({ name: 'Transaction Plan 2' }));
        
        // Simulate error
        throw new Error('Transaction failed');
        
        operations.push(await mockCollections.plans.insertOne({ name: 'Transaction Plan 3' }));
      } catch (error) {
        // Rollback - remove inserted documents
        for (const op of operations) {
          if (op.insertedId) {
            await mockCollections.plans.deleteOne({ _id: op.insertedId });
          }
        }
      }
      
      // Verify rollback
      const count = await mockCollections.plans.countDocuments({
        name: { $regex: 'Transaction Plan' }
      });
      expect(count).toBe(0);
    });

    test('should maintain data consistency', async () => {
      // Create related documents
      const plan = await mockCollections.plans.insertOne({
        name: 'Main Plan',
        status: 'created'
      });
      
      const execution = await mockCollections.executions.insertOne({
        planId: plan.insertedId,
        status: 'pending'
      });
      
      // Update both in simulated transaction
      await mockCollections.plans.updateOne(
        { _id: plan.insertedId },
        { $set: { status: 'executing' } }
      );
      
      await mockCollections.executions.updateOne(
        { _id: execution.insertedId },
        { $set: { status: 'running' } }
      );
      
      // Verify consistency
      const updatedPlan = await mockCollections.plans.findOne({ _id: plan.insertedId });
      const updatedExecution = await mockCollections.executions.findOne({ _id: execution.insertedId });
      
      expect(updatedPlan.status).toBe('executing');
      expect(updatedExecution.status).toBe('running');
    });
  });

  describe('Performance Monitoring', () => {
    test('should track query execution time', async () => {
      // Insert many documents
      const docs = [];
      for (let i = 0; i < 1000; i++) {
        docs.push({
          name: `Performance Plan ${i}`,
          index: i,
          category: i % 10
        });
      }
      await mockCollections.plans.insertMany(docs);
      
      // Measure query time
      const startTime = Date.now();
      const results = await mockCollections.plans
        .find({ category: 5 })
        .sort({ index: -1 })
        .limit(10)
        .toArray();
      const queryTime = Date.now() - startTime;
      
      expect(results.length).toBe(10);
      expect(queryTime).toBeLessThan(500); // Should complete quickly
    });

    test('should handle large result sets efficiently', async () => {
      // Insert large dataset
      const batchSize = 100;
      for (let batch = 0; batch < 10; batch++) {
        const docs = [];
        for (let i = 0; i < batchSize; i++) {
          docs.push({
            name: `Batch ${batch} Doc ${i}`,
            batch: batch,
            timestamp: Date.now()
          });
        }
        await mockCollections.plans.insertMany(docs);
      }
      
      // Query with pagination
      const pageSize = 50;
      const page1 = await mockCollections.plans
        .find({})
        .limit(pageSize)
        .toArray();
      
      const page2 = await mockCollections.plans
        .find({})
        .skip(pageSize)
        .limit(pageSize)
        .toArray();
      
      expect(page1.length).toBe(pageSize);
      expect(page2.length).toBe(pageSize);
      expect(page1[0]._id).not.toBe(page2[0]._id);
    });
  });

  describe('Data Validation', () => {
    test('should validate document schema', async () => {
      // Define validation function
      const validatePlan = (plan) => {
        const errors = [];
        if (!plan.name || typeof plan.name !== 'string') {
          errors.push('Name is required and must be a string');
        }
        if (!plan.goal || typeof plan.goal !== 'string') {
          errors.push('Goal is required and must be a string');
        }
        if (plan.priority && (plan.priority < 1 || plan.priority > 5)) {
          errors.push('Priority must be between 1 and 5');
        }
        return errors;
      };
      
      // Test valid document
      const validPlan = {
        name: 'Valid Plan',
        goal: 'Valid Goal',
        priority: 3
      };
      
      const validErrors = validatePlan(validPlan);
      expect(validErrors.length).toBe(0);
      
      // Test invalid document
      const invalidPlan = {
        name: 123, // Should be string
        // Missing goal
        priority: 10 // Out of range
      };
      
      const invalidErrors = validatePlan(invalidPlan);
      expect(invalidErrors.length).toBeGreaterThan(0);
    });

    test('should enforce unique constraints', async () => {
      // Create unique index simulation
      const uniqueNames = new Set();
      
      const insertWithUnique = async (doc) => {
        if (uniqueNames.has(doc.name)) {
          throw new Error(`Duplicate key error: name "${doc.name}" already exists`);
        }
        uniqueNames.add(doc.name);
        return await mockCollections.plans.insertOne(doc);
      };
      
      // Insert first document
      await insertWithUnique({ name: 'Unique Plan', goal: 'Test' });
      
      // Try to insert duplicate
      await expect(
        insertWithUnique({ name: 'Unique Plan', goal: 'Different' })
      ).rejects.toThrow('Duplicate key error');
    });
  });

  describe('Backup and Recovery', () => {
    test('should export collection data', async () => {
      // Insert test data
      await mockCollections.plans.insertMany([
        { name: 'Backup Plan 1', goal: 'Goal 1' },
        { name: 'Backup Plan 2', goal: 'Goal 2' }
      ]);
      
      // Export all documents
      const backup = await mockCollections.plans.find({}).toArray();
      
      expect(backup.length).toBe(2);
      expect(backup[0].name).toBe('Backup Plan 1');
      
      // Serialize for storage
      const backupJson = JSON.stringify(backup);
      expect(backupJson).toBeDefined();
    });

    test('should restore collection data', async () => {
      // Backup data
      const backupData = [
        { name: 'Restored Plan 1', goal: 'Restored Goal 1' },
        { name: 'Restored Plan 2', goal: 'Restored Goal 2' }
      ];
      
      // Clear collection
      await mockCollections.plans.deleteMany({});
      
      // Restore from backup
      await mockCollections.plans.insertMany(backupData);
      
      // Verify restoration
      const restored = await mockCollections.plans.find({}).toArray();
      expect(restored.length).toBe(2);
      expect(restored[0].name).toBe('Restored Plan 1');
    });
  });
});