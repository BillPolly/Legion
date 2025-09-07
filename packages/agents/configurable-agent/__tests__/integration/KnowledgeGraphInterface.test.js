/**
 * Integration tests for KnowledgeGraphInterface with real Legion KG components
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { KnowledgeGraphInterface } from '../../src/knowledge/KnowledgeGraphInterface.js';
import { getResourceManager } from '../../src/utils/ResourceAccess.js';
import { InMemoryTripleStore } from '@legion/kg-storage-memory';
import { MongoTripleStore } from '@legion/kg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('KnowledgeGraphInterface Integration', () => {
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    resourceManager = await getResourceManager();
    testDir = path.join(__dirname, '../tmp/kg-tests');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test files
    const files = await fs.readdir(testDir).catch(() => []);
    for (const file of files) {
      await fs.unlink(path.join(testDir, file)).catch(() => {});
    }
  });

  describe('In-Memory Triple Store Integration', () => {
    let kgInterface;

    beforeEach(async () => {
      kgInterface = new KnowledgeGraphInterface({
        namespace: 'test',
        storageMode: 'session'
      });
      await kgInterface.initialize();
    });

    afterEach(async () => {
      await kgInterface.cleanup();
    });

    it('should store and retrieve complex entity graph', async () => {
      // Store user entity
      await kgInterface.storeEntity({
        id: 'user-1',
        type: 'User',
        properties: {
          name: 'Alice Smith',
          email: 'alice@example.com',
          role: 'developer',
          level: 5
        }
      });

      // Store project entity
      await kgInterface.storeEntity({
        id: 'project-1',
        type: 'Project',
        properties: {
          name: 'AI Assistant',
          status: 'active',
          priority: 'high'
        }
      });

      // Store task entities
      await kgInterface.storeEntity({
        id: 'task-1',
        type: 'Task',
        properties: {
          title: 'Implement KG interface',
          status: 'completed'
        }
      });

      await kgInterface.storeEntity({
        id: 'task-2',
        type: 'Task',
        properties: {
          title: 'Write tests',
          status: 'in-progress'
        }
      });

      // Add relationships
      await kgInterface.addRelationship('user-1', 'worksOn', 'project-1');
      await kgInterface.addRelationship('project-1', 'hasTask', 'task-1');
      await kgInterface.addRelationship('project-1', 'hasTask', 'task-2');
      await kgInterface.addRelationship('user-1', 'assigned', 'task-1');
      await kgInterface.addRelationship('user-1', 'assigned', 'task-2');

      // Retrieve and verify user
      const user = await kgInterface.getEntity('user-1');
      expect(user).toEqual({
        id: 'user-1',
        type: 'User',
        properties: {
          name: 'Alice Smith',
          email: 'alice@example.com',
          role: 'developer',
          level: 5
        }
      });

      // Retrieve and verify project
      const project = await kgInterface.getEntity('project-1');
      expect(project.type).toBe('Project');
      expect(project.properties.name).toBe('AI Assistant');

      // Check relationships
      const userRels = await kgInterface.getRelationships('user-1');
      expect(userRels).toHaveLength(3); // worksOn, assigned x2
      expect(userRels).toContainEqual({ predicate: 'worksOn', object: 'project-1' });

      const projectRels = await kgInterface.getRelationships('project-1', 'hasTask');
      expect(projectRels).toHaveLength(2);
      expect(projectRels).toContainEqual({ predicate: 'hasTask', object: 'task-1' });
      expect(projectRels).toContainEqual({ predicate: 'hasTask', object: 'task-2' });

      // Find connected entities
      const connected = await kgInterface.findConnectedEntities('project-1');
      expect(connected).toContain('task-1');
      expect(connected).toContain('task-2');
      expect(connected).toContain('user-1'); // via incoming worksOn relationship

      // Get statistics
      const stats = await kgInterface.getStatistics();
      expect(stats.entityCount).toBe(4);
      expect(stats.entityTypes).toEqual({
        User: 1,
        Project: 1,
        Task: 2
      });
    });

    it('should handle entity updates and deletions', async () => {
      // Store initial entity
      await kgInterface.storeEntity({
        id: 'doc-1',
        type: 'Document',
        properties: {
          title: 'Draft',
          version: 1,
          author: 'Bob'
        }
      });

      // Update entity
      await kgInterface.updateEntity('doc-1', {
        title: 'Final Draft',
        version: 2,
        reviewedBy: 'Alice'
      });

      // Verify updates
      const updated = await kgInterface.getEntity('doc-1');
      expect(updated.properties.title).toBe('Final Draft');
      expect(updated.properties.version).toBe(2);
      expect(updated.properties.author).toBe('Bob'); // Unchanged
      expect(updated.properties.reviewedBy).toBe('Alice'); // New property

      // Delete entity
      await kgInterface.deleteEntity('doc-1');
      
      // Verify deletion
      const deleted = await kgInterface.getEntity('doc-1');
      expect(deleted).toBeNull();
    });

    it('should support complex queries', async () => {
      // Create a knowledge base
      await kgInterface.storeEntity({
        id: 'course-1',
        type: 'Course',
        properties: {
          name: 'Machine Learning',
          level: 'advanced'
        }
      });

      await kgInterface.storeEntity({
        id: 'course-2',
        type: 'Course',
        properties: {
          name: 'Data Science',
          level: 'intermediate'
        }
      });

      await kgInterface.storeEntity({
        id: 'student-1',
        type: 'Student',
        properties: {
          name: 'Charlie',
          year: 3
        }
      });

      await kgInterface.storeEntity({
        id: 'student-2',
        type: 'Student',
        properties: {
          name: 'Diana',
          year: 2
        }
      });

      // Add enrollments
      await kgInterface.addRelationship('student-1', 'enrolledIn', 'course-1');
      await kgInterface.addRelationship('student-1', 'enrolledIn', 'course-2');
      await kgInterface.addRelationship('student-2', 'enrolledIn', 'course-2');

      // List all students
      const students = await kgInterface.listEntitiesByType('Student');
      expect(students).toHaveLength(2);
      expect(students).toContain('student-1');
      expect(students).toContain('student-2');

      // Find courses with specific level
      const advancedCourses = await kgInterface.findEntitiesWithProperty('level', 'advanced');
      expect(advancedCourses).toEqual(['course-1']);

      // Find all courses a student is enrolled in
      const charliesCourses = await kgInterface.getRelationships('student-1', 'enrolledIn');
      expect(charliesCourses).toHaveLength(2);
    });
  });

  describe('Persistent Storage Mode', () => {
    it('should support persistent storage configuration', async () => {
      const kgInterface = new KnowledgeGraphInterface({
        namespace: 'persistent',
        storageMode: 'persistent'
      });

      await kgInterface.initialize();
      expect(kgInterface.storageMode).toBe('persistent');
      
      // In real implementation, this would use MongoDB or file storage
      // For now, it still uses in-memory but the configuration is set
      expect(kgInterface.tripleStore).toBeDefined();
      
      await kgInterface.cleanup();
    });
  });

  describe('Context Extraction and Inference', () => {
    let kgInterface;

    beforeEach(async () => {
      kgInterface = new KnowledgeGraphInterface();
      await kgInterface.initialize();
    });

    afterEach(async () => {
      await kgInterface.cleanup();
    });

    it('should extract and store context from conversation', async () => {
      const conversation = [
        { role: 'user', content: 'My name is Eve and I work at TechCorp' },
        { role: 'assistant', content: 'Hello Eve! How can I help you at TechCorp today?' },
        { role: 'user', content: 'I need help with project Quantum. It\'s urgent!' },
        { role: 'assistant', content: 'I\'ll help you with project Quantum right away.' },
        { role: 'user', content: 'Also, I\'m working with Frank on this project' }
      ];

      // Extract context
      const context = await kgInterface.extractContext(conversation);
      
      expect(context.entities).toContainEqual({ type: 'Person', value: 'Eve' });
      expect(context.entities).toContainEqual({ type: 'Organization', value: 'TechCorp' });
      expect(context.entities).toContainEqual({ type: 'Project', value: 'Quantum' });
      
      expect(context.relationships).toContainEqual({
        subject: 'Eve',
        predicate: 'worksAt',
        object: 'TechCorp'
      });
      expect(context.relationships).toContainEqual({
        subject: 'Eve',
        predicate: 'needsHelpWith',
        object: 'Quantum'
      });

      // Store extracted entities
      for (const entity of context.entities) {
        await kgInterface.storeEntity({
          id: entity.value.toLowerCase(),
          type: entity.type,
          properties: { name: entity.value }
        });
      }

      // Store relationships
      for (const rel of context.relationships) {
        await kgInterface.addRelationship(
          rel.subject.toLowerCase(),
          rel.predicate,
          rel.object.toLowerCase()
        );
      }

      // Verify storage
      const eve = await kgInterface.getEntity('eve');
      expect(eve).toBeDefined();
      expect(eve.type).toBe('Person');

      const eveRels = await kgInterface.getRelationships('eve');
      expect(eveRels).toContainEqual({
        predicate: 'worksAt',
        object: 'techcorp'
      });
    });

    it('should infer transitive relationships', async () => {
      // Set up organizational hierarchy
      await kgInterface.storeEntity({
        id: 'manager-1',
        type: 'Person',
        properties: { name: 'Grace', role: 'manager' }
      });

      await kgInterface.storeEntity({
        id: 'team-1',
        type: 'Team',
        properties: { name: 'AI Research' }
      });

      await kgInterface.storeEntity({
        id: 'project-alpha',
        type: 'Project',
        properties: { name: 'Alpha', classification: 'confidential' }
      });

      await kgInterface.storeEntity({
        id: 'resource-1',
        type: 'Resource',
        properties: { name: 'GPU Cluster', type: 'compute' }
      });

      // Set up relationships
      await kgInterface.addRelationship('manager-1', 'manages', 'team-1');
      await kgInterface.addRelationship('team-1', 'owns', 'project-alpha');
      await kgInterface.addRelationship('project-alpha', 'uses', 'resource-1');

      // Infer facts
      const inferred = await kgInterface.inferFacts('manager-1');
      
      // Manager should have access to team's projects
      expect(inferred).toContainEqual({
        subject: 'manager-1',
        predicate: 'hasAccessTo',
        object: 'project-alpha',
        confidence: 0.8
      });
    });
  });

  describe('Import/Export Operations', () => {
    it('should export and import knowledge graph correctly', async () => {
      const kgInterface1 = new KnowledgeGraphInterface({ namespace: 'export-test' });
      await kgInterface1.initialize();

      // Build a knowledge graph
      await kgInterface1.storeEntity({
        id: 'item-1',
        type: 'Item',
        properties: {
          name: 'Test Item',
          value: 100,
          tags: 'important'
        }
      });

      await kgInterface1.storeEntity({
        id: 'category-1',
        type: 'Category',
        properties: {
          name: 'Electronics'
        }
      });

      await kgInterface1.addRelationship('item-1', 'belongsTo', 'category-1');

      // Export
      const exported = await kgInterface1.exportToJSON();
      
      expect(exported.namespace).toBe('export-test');
      expect(exported.triples).toBeDefined();
      expect(exported.triples.length).toBeGreaterThan(0);
      expect(exported.metadata.tripleCount).toBe(exported.triples.length);

      // Save to file
      const exportFile = path.join(testDir, 'kg-export.json');
      await fs.writeFile(exportFile, JSON.stringify(exported, null, 2));

      // Create new interface and import
      const kgInterface2 = new KnowledgeGraphInterface({ namespace: 'export-test' });
      await kgInterface2.initialize();
      
      await kgInterface2.importFromJSON(exported);

      // Verify imported data
      const item = await kgInterface2.getEntity('item-1');
      expect(item).toEqual({
        id: 'item-1',
        type: 'Item',
        properties: {
          name: 'Test Item',
          value: 100,
          tags: 'important'
        }
      });

      const category = await kgInterface2.getEntity('category-1');
      expect(category.type).toBe('Category');

      const relationships = await kgInterface2.getRelationships('item-1');
      expect(relationships).toContainEqual({
        predicate: 'belongsTo',
        object: 'category-1'
      });

      // Clean up
      await kgInterface1.cleanup();
      await kgInterface2.cleanup();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let kgInterface;

    beforeEach(async () => {
      kgInterface = new KnowledgeGraphInterface();
      await kgInterface.initialize();
    });

    afterEach(async () => {
      await kgInterface.cleanup();
    });

    it('should handle circular relationships gracefully', async () => {
      // Create entities
      await kgInterface.storeEntity({
        id: 'node-a',
        type: 'Node',
        properties: { name: 'A' }
      });

      await kgInterface.storeEntity({
        id: 'node-b',
        type: 'Node',
        properties: { name: 'B' }
      });

      await kgInterface.storeEntity({
        id: 'node-c',
        type: 'Node',
        properties: { name: 'C' }
      });

      // Create circular relationships
      await kgInterface.addRelationship('node-a', 'linksTo', 'node-b');
      await kgInterface.addRelationship('node-b', 'linksTo', 'node-c');
      await kgInterface.addRelationship('node-c', 'linksTo', 'node-a');

      // Should handle circular traversal
      const connectedToA = await kgInterface.findConnectedEntities('node-a');
      expect(connectedToA).toContain('node-b');
      expect(connectedToA).toContain('node-c');
    });

    it('should handle large property values', async () => {
      const largeText = 'Lorem ipsum '.repeat(1000); // ~12KB of text
      
      await kgInterface.storeEntity({
        id: 'doc-large',
        type: 'Document',
        properties: {
          content: largeText,
          size: largeText.length
        }
      });

      const retrieved = await kgInterface.getEntity('doc-large');
      expect(retrieved.properties.content).toBe(largeText);
      expect(retrieved.properties.size).toBe(largeText.length);
    });

    it('should handle special characters in values', async () => {
      await kgInterface.storeEntity({
        id: 'special-1',
        type: 'SpecialEntity',
        properties: {
          name: 'Test "with" quotes',
          description: "It's got apostrophes",
          code: '<script>alert("XSS")</script>',
          unicode: '你好世界 🌍'
        }
      });

      const retrieved = await kgInterface.getEntity('special-1');
      expect(retrieved.properties.name).toBe('Test "with" quotes');
      expect(retrieved.properties.description).toBe("It's got apostrophes");
      expect(retrieved.properties.code).toBe('<script>alert("XSS")</script>');
      expect(retrieved.properties.unicode).toBe('你好世界 🌍');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk operations efficiently', async () => {
      const kgInterface = new KnowledgeGraphInterface();
      await kgInterface.initialize();

      const startTime = Date.now();
      
      // Store 100 entities
      for (let i = 0; i < 100; i++) {
        await kgInterface.storeEntity({
          id: `entity-${i}`,
          type: 'TestEntity',
          properties: {
            index: i,
            name: `Entity ${i}`,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Add 200 relationships
      for (let i = 0; i < 100; i++) {
        if (i > 0) {
          await kgInterface.addRelationship(`entity-${i}`, 'follows', `entity-${i - 1}`);
        }
        if (i < 99) {
          await kgInterface.addRelationship(`entity-${i}`, 'precedes', `entity-${i + 1}`);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 5 seconds for 300 operations)
      expect(duration).toBeLessThan(5000);

      // Verify data integrity
      const stats = await kgInterface.getStatistics();
      expect(stats.entityCount).toBe(100);
      expect(stats.tripleCount).toBeGreaterThan(300); // Entities + relationships

      // Test query performance
      const queryStart = Date.now();
      const entities = await kgInterface.listEntitiesByType('TestEntity');
      const queryEnd = Date.now();

      expect(entities).toHaveLength(100);
      expect(queryEnd - queryStart).toBeLessThan(100); // Should be fast

      await kgInterface.cleanup();
    });
  });
});