/**
 * Integration Tests for Entity Schema System
 * Per implementation plan Phase 4 Step 4.5
 * Tests complete schema definition and validation workflow
 */

import { ImmutableDataStore } from '../../../src/immutable/ImmutableDataStore.js';
import { EntityType } from '../../../src/immutable/schema/EntityType.js';
import { EntityTypeRegistry } from '../../../src/immutable/schema/EntityTypeRegistry.js';
import { SchemaConstraintGenerator } from '../../../src/immutable/schema/SchemaConstraintGenerator.js';
import { CardinalityConstraint } from '../../../src/immutable/constraints/CardinalityConstraint.js';
import { ConstraintViolationError } from '../../../src/immutable/ConstraintViolationError.js';
import { Edge } from '../../../src/Edge.js';
import { RelationshipType } from '../../../src/RelationshipType.js';

describe('Entity Schema System Integration', () => {
  describe('Complete Schema Definition and Validation Workflow', () => {
    test('should handle complete organization hierarchy schema', () => {
      // Define entity types
      const personType = new EntityType('Person', {
        required: ['name', 'email', 'role'],
        optional: ['phone', 'department'],
        types: {
          name: 'string',
          email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
          role: 'string',
          phone: 'string',
          department: 'string'
        },
        constraints: {
          role: {
            enum: ['employee', 'manager', 'director', 'executive']
          }
        }
      });

      const teamType = new EntityType('Team', {
        required: ['name', 'department'],
        types: {
          name: 'string',
          department: 'string'
        }
      });

      const projectType = new EntityType('Project', {
        required: ['title', 'budget', 'status'],
        optional: ['deadline'],
        types: {
          title: 'string',
          budget: 'number',
          status: 'string',
          deadline: 'string'
        },
        constraints: {
          budget: { min: 0, max: 10000000 },
          status: { enum: ['planning', 'active', 'completed', 'cancelled'] }
        }
      });

      // Create registry and relationship schema
      const registry = new EntityTypeRegistry([personType, teamType, projectType]);
      
      const relationshipSchema = {
        'manages': { source: 'Person', target: 'Team' },
        'memberOf': { source: 'Person', target: 'Team' },
        'worksOn': { source: 'Person', target: 'Project' },
        'owns': { source: 'Team', target: 'Project' }
      };

      // Create store with schema and constraints
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        relationshipSchema: relationshipSchema,
        generateSchemaConstraints: true,
        generateAttributeConstraints: true,
        enableSchemaValidation: true,
        constraints: [
          new CardinalityConstraint('one-manager', 'manages', 'target', 1, 1), // Each team has exactly one manager
          new CardinalityConstraint('max-projects', 'worksOn', 'source', 0, 5), // Person can work on max 5 projects
          new CardinalityConstraint('team-size', 'memberOf', 'target', 2, 10) // Teams have 2-10 members
        ]
      });

      // Set up valid entities
      let currentStore = store
        .withEntityType('alice', 'Person', {
          name: 'Alice Smith',
          email: 'alice@company.com',
          role: 'manager',
          department: 'Engineering'
        })
        .withEntityType('bob', 'Person', {
          name: 'Bob Jones',
          email: 'bob@company.com',
          role: 'employee',
          department: 'Engineering'
        })
        .withEntityType('charlie', 'Person', {
          name: 'Charlie Brown',
          email: 'charlie@company.com',
          role: 'employee',
          department: 'Engineering'
        })
        .withEntityType('team1', 'Team', {
          name: 'Platform Team',
          department: 'Engineering'
        })
        .withEntityType('project1', 'Project', {
          title: 'New Platform',
          budget: 500000,
          status: 'active',
          deadline: '2024-12-31'
        });

      // Test valid relationships
      currentStore = currentStore
        .addEdge(new Edge('manages', 'alice', 'team1'))
        .addEdge(new Edge('memberOf', 'alice', 'team1'))
        .addEdge(new Edge('memberOf', 'bob', 'team1'))
        .addEdge(new Edge('memberOf', 'charlie', 'team1'))
        .addEdge(new Edge('worksOn', 'alice', 'project1'))
        .addEdge(new Edge('worksOn', 'bob', 'project1'))
        .addEdge(new Edge('owns', 'team1', 'project1'));

      expect(currentStore.getEdgeCount()).toBe(7);

      // Test constraint violations

      // 1. Try to add second manager to team (violates one-manager constraint)
      expect(() => {
        currentStore.addEdge(new Edge('manages', 'bob', 'team1'));
      }).toThrow(ConstraintViolationError);

      // 2. Try to add person with wrong entity type
      const store2 = currentStore.withEntityType('project2', 'Project', {
        title: 'Another Project',
        budget: 100000,
        status: 'planning'
      });
      
      expect(() => {
        store2.addEdge(new Edge('manages', 'project2', 'team1')); // Project can't manage Team
      }).toThrow(ConstraintViolationError);

      // 3. Try to add person with invalid attributes
      expect(() => {
        currentStore.withEntityType('dave', 'Person', {
          name: 'Dave Wilson',
          email: 'not-an-email', // Invalid email format
          role: 'employee'
        });
      }).toThrow('Entity attributes do not match schema');

      // 4. Try to exceed cardinality limits
      const store3 = currentStore
        .withEntityType('project2', 'Project', { title: 'P2', budget: 100000, status: 'active' })
        .withEntityType('project3', 'Project', { title: 'P3', budget: 100000, status: 'active' })
        .withEntityType('project4', 'Project', { title: 'P4', budget: 100000, status: 'active' })
        .withEntityType('project5', 'Project', { title: 'P5', budget: 100000, status: 'active' })
        .addEdge(new Edge('worksOn', 'alice', 'project2'))
        .addEdge(new Edge('worksOn', 'alice', 'project3'))
        .addEdge(new Edge('worksOn', 'alice', 'project4'))
        .addEdge(new Edge('worksOn', 'alice', 'project5'));

      // Alice now works on 5 projects (at limit)
      expect(() => {
        store3
          .withEntityType('project6', 'Project', { title: 'P6', budget: 100000, status: 'active' })
          .addEdge(new Edge('worksOn', 'alice', 'project6')); // Would exceed limit
      }).toThrow(ConstraintViolationError);
    });

    test('should handle schema inheritance correctly', () => {
      // Base entity types
      const vehicleType = new EntityType('Vehicle', {
        required: ['make', 'model', 'year'],
        types: {
          make: 'string',
          model: 'string',
          year: 'number'
        },
        constraints: {
          year: { min: 1900, max: 2030 }
        }
      });

      const carType = vehicleType.extend('Car', {
        required: ['doors', 'fuelType'],
        types: {
          doors: 'number',
          fuelType: 'string'
        },
        constraints: {
          doors: { min: 2, max: 5 },
          fuelType: { enum: ['gasoline', 'diesel', 'electric', 'hybrid'] }
        }
      });

      const truckType = vehicleType.extend('Truck', {
        required: ['capacity', 'axles'],
        types: {
          capacity: 'number',
          axles: 'number'
        },
        constraints: {
          capacity: { min: 1000, max: 50000 },
          axles: { min: 2, max: 5 }
        }
      });

      // Create store with inherited types
      const registry = new EntityTypeRegistry([vehicleType, carType, truckType]);
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        enableSchemaValidation: true,
        generateAttributeConstraints: true
      });

      // Valid car (inherits from vehicle)
      const store1 = store.withEntityType('car1', 'Car', {
        make: 'Toyota',
        model: 'Camry',
        year: 2023,
        doors: 4,
        fuelType: 'hybrid'
      });

      const metadata = store1.getEntityMetadata('car1');
      expect(metadata.type).toBe('Car');
      expect(metadata.attributes.make).toBe('Toyota');

      // Invalid car - missing inherited field
      expect(() => {
        store.withEntityType('car2', 'Car', {
          // Missing make, model, year from Vehicle
          doors: 4,
          fuelType: 'gasoline'
        });
      }).toThrow('Entity attributes do not match schema');

      // Invalid truck - constraint violation
      expect(() => {
        store.withEntityType('truck1', 'Truck', {
          make: 'Ford',
          model: 'F-150',
          year: 2023,
          capacity: 100000, // Exceeds max
          axles: 3
        });
      }).toThrow('Entity attributes do not match schema');
    });

    test('should handle complex constraint interactions', () => {
      // Define a social network schema
      const userType = new EntityType('User', {
        required: ['username', 'email'],
        types: {
          username: 'string',
          email: 'string'
        }
      });

      const postType = new EntityType('Post', {
        required: ['content', 'timestamp'],
        types: {
          content: 'string',
          timestamp: 'number'
        }
      });

      const registry = new EntityTypeRegistry([userType, postType]);
      
      const relationshipSchema = {
        'follows': { source: 'User', target: 'User' },
        'authored': { source: 'User', target: 'Post' },
        'likes': { source: 'User', target: 'Post' }
      };

      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        relationshipSchema: relationshipSchema,
        generateSchemaConstraints: true,
        constraints: [
          new CardinalityConstraint('one-author', 'authored', 'target', 1, 1), // Each post has exactly one author
          new CardinalityConstraint('max-follows', 'follows', 'source', 0, 100), // Can follow max 100 users
          new CardinalityConstraint('no-self-follow', 'follows', 'source', 0, null) // Custom constraint would prevent self-follow
        ]
      });

      // Set up entities
      let currentStore = store
        .withEntityType('user1', 'User', { username: 'alice', email: 'alice@social.com' })
        .withEntityType('user2', 'User', { username: 'bob', email: 'bob@social.com' })
        .withEntityType('user3', 'User', { username: 'charlie', email: 'charlie@social.com' })
        .withEntityType('post1', 'Post', { content: 'Hello World!', timestamp: Date.now() })
        .withEntityType('post2', 'Post', { content: 'Another post', timestamp: Date.now() });

      // Add relationships
      currentStore = currentStore
        .addEdge(new Edge('authored', 'user1', 'post1'))
        .addEdge(new Edge('authored', 'user2', 'post2'))
        .addEdge(new Edge('follows', 'user1', 'user2'))
        .addEdge(new Edge('follows', 'user2', 'user3'))
        .addEdge(new Edge('likes', 'user1', 'post2'))
        .addEdge(new Edge('likes', 'user3', 'post1'));

      expect(currentStore.getEdgeCount()).toBe(6);

      // Test violations
      
      // Can't have two authors for one post
      expect(() => {
        currentStore.addEdge(new Edge('authored', 'user3', 'post1'));
      }).toThrow(ConstraintViolationError);

      // Wrong entity type
      expect(() => {
        currentStore.addEdge(new Edge('follows', 'post1', 'user1')); // Post can't follow User
      }).toThrow(ConstraintViolationError);
    });

    test('should generate comprehensive schema report', () => {
      const personType = new EntityType('Person', {
        required: ['name'],
        optional: ['age'],
        types: { name: 'string', age: 'number' }
      });

      const companyType = new EntityType('Company', {
        required: ['name', 'industry'],
        types: { name: 'string', industry: 'string' }
      });

      const registry = new EntityTypeRegistry([personType, companyType]);
      
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        relationshipSchema: {
          'worksAt': { source: 'Person', target: 'Company' },
          'owns': { source: 'Company', target: 'Company' }
        },
        generateSchemaConstraints: true,
        generateAttributeConstraints: true,
        enableSchemaValidation: true
      });

      const report = store.getSchemaReport();

      expect(report.entityTypes).toHaveLength(2);
      expect(report.entityTypes[0].name).toBeDefined();
      expect(report.entityTypes[0].required).toBeDefined();
      
      expect(report.relationships).toHaveProperty('worksAt');
      expect(report.relationships.worksAt.source).toBe('Person');
      expect(report.relationships.worksAt.target).toBe('Company');
      
      expect(report.statistics.totalEntityTypes).toBe(2);
      expect(report.statistics.totalRelationships).toBe(2);
      expect(report.statistics.schemaValidationEnabled).toBe(true);
      expect(report.statistics.schemaConstraintsGenerated).toBe(true);
      expect(report.statistics.attributeConstraintsGenerated).toBe(true);
    });

    test('should handle schema evolution', () => {
      // Start with simple schema
      let store = new ImmutableDataStore()
        .registerEntityType(new EntityType('User', {
          required: ['name']
        }));

      // Add entity with old schema
      const store1 = store.withEntityType('user1', 'User', { name: 'Alice' });
      expect(store1.getEntityMetadata('user1').attributes.name).toBe('Alice');

      // Evolve schema - add email requirement
      const store2 = store1.registerEntityType(new EntityType('User', {
        required: ['name', 'email'],
        types: { name: 'string', email: 'string' }
      })).enableSchemaValidation();

      // Old entities still exist
      expect(store2.getEntityMetadata('user1').attributes.name).toBe('Alice');

      // New entities must follow new schema
      expect(() => {
        store2.withEntityType('user2', 'User', { name: 'Bob' }); // Missing email
      }).toThrow('Entity attributes do not match schema');

      // Valid with new schema
      const store3 = store2.withEntityType('user2', 'User', {
        name: 'Bob',
        email: 'bob@example.com'
      });
      expect(store3.getEntityMetadata('user2').attributes.email).toBe('bob@example.com');
    });

    test('should validate complex business rules with custom constraints', () => {
      const employeeType = new EntityType('Employee', {
        required: ['name', 'salary', 'level'],
        types: {
          name: 'string',
          salary: 'number',
          level: 'number'
        },
        constraints: {
          salary: { min: 30000, max: 500000 },
          level: { min: 1, max: 10 }
        }
      });

      const departmentType = new EntityType('Department', {
        required: ['name', 'budget'],
        types: {
          name: 'string',
          budget: 'number'
        },
        constraints: {
          budget: { min: 100000, max: 10000000 }
        }
      });

      const registry = new EntityTypeRegistry([employeeType, departmentType]);
      
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        relationshipSchema: {
          'worksIn': { source: 'Employee', target: 'Department' },
          'manages': { source: 'Employee', target: 'Department' }
        },
        generateSchemaConstraints: true,
        generateAttributeConstraints: true,
        enableSchemaValidation: true,
        constraints: [
          // Each department has exactly one manager
          new CardinalityConstraint('one-manager-per-dept', 'manages', 'target', 1, 1),
          // Employees can work in only one department
          new CardinalityConstraint('one-dept-per-employee', 'worksIn', 'source', 1, 1),
          // Departments can have 1-50 employees
          new CardinalityConstraint('dept-size', 'worksIn', 'target', 1, 50)
        ]
      });

      // Set up valid scenario
      let currentStore = store
        .withEntityType('emp1', 'Employee', { name: 'Alice', salary: 120000, level: 7 })
        .withEntityType('emp2', 'Employee', { name: 'Bob', salary: 80000, level: 5 })
        .withEntityType('emp3', 'Employee', { name: 'Charlie', salary: 60000, level: 3 })
        .withEntityType('dept1', 'Department', { name: 'Engineering', budget: 5000000 })
        .withEntityType('dept2', 'Department', { name: 'Marketing', budget: 2000000 });

      // Set up relationships
      currentStore = currentStore
        .addEdge(new Edge('manages', 'emp1', 'dept1'))
        .addEdge(new Edge('worksIn', 'emp1', 'dept1'))
        .addEdge(new Edge('worksIn', 'emp2', 'dept1'))
        .addEdge(new Edge('worksIn', 'emp3', 'dept1'));

      expect(currentStore.getEdgeCount()).toBe(4);

      // Test various constraint violations

      // 1. Can't have two managers for same department
      expect(() => {
        currentStore.addEdge(new Edge('manages', 'emp2', 'dept1'));
      }).toThrow(ConstraintViolationError);

      // 2. Employee can't work in two departments
      expect(() => {
        currentStore.addEdge(new Edge('worksIn', 'emp1', 'dept2'));
      }).toThrow(ConstraintViolationError);

      // 3. Invalid salary range
      expect(() => {
        currentStore.withEntityType('emp4', 'Employee', {
          name: 'Dave',
          salary: 20000, // Below minimum
          level: 2
        });
      }).toThrow('Entity attributes do not match schema');

      // Verify query methods work with schema
      const edges = currentStore.getEdgesByType('worksIn');
      expect(edges).toHaveLength(3);
      
      const deptEdges = currentStore.getEdgesByDestination('dept1');
      expect(deptEdges).toHaveLength(4);
    });
  });

  describe('Schema System Performance', () => {
    test('should handle large-scale entity and constraint validation efficiently', () => {
      const nodeType = new EntityType('Node', {
        required: ['id', 'value'],
        types: { id: 'string', value: 'number' }
      });

      const registry = new EntityTypeRegistry([nodeType]);
      
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        relationshipSchema: {
          'connects': { source: 'Node', target: 'Node' }
        },
        generateSchemaConstraints: true,
        constraints: [
          new CardinalityConstraint('max-connections', 'connects', 'source', 0, 10)
        ]
      });

      const startTime = Date.now();
      
      // Add 100 nodes
      let currentStore = store;
      for (let i = 0; i < 100; i++) {
        currentStore = currentStore.withEntityType(`node${i}`, 'Node', {
          id: `node-${i}`,
          value: i
        });
      }

      // Add edges (each node connects to next 5)
      for (let i = 0; i < 95; i++) {
        for (let j = 1; j <= 5; j++) {
          currentStore = currentStore.addEdge(
            new Edge('connects', `node${i}`, `node${i + j}`)
          );
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(currentStore.getEdgeCount()).toBe(475); // 95 nodes * 5 edges each
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify constraints still enforced
      expect(() => {
        // Try to add 11th connection for node0 (would exceed limit)
        let testStore = currentStore;
        for (let i = 6; i <= 11; i++) {
          testStore = testStore.addEdge(new Edge('connects', 'node0', `node${i}`));
        }
      }).toThrow(ConstraintViolationError);
    });
  });
});