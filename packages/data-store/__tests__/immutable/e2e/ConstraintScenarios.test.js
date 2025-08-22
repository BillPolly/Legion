/**
 * End-to-End Tests for Constraint Scenarios
 * Per implementation plan Phase 5 Step 5.2
 * Comprehensive constraint scenario testing
 */

import { ImmutableDataStore } from '../../../src/immutable/ImmutableDataStore.js';
import { EntityType } from '../../../src/immutable/schema/EntityType.js';
import { EntityTypeRegistry } from '../../../src/immutable/schema/EntityTypeRegistry.js';
import { CardinalityConstraint } from '../../../src/immutable/constraints/CardinalityConstraint.js';
import { EntityTypeConstraint } from '../../../src/immutable/constraints/EntityTypeConstraint.js';
import { CustomConstraint } from '../../../src/immutable/constraints/CustomConstraint.js';
import { ConstraintResult } from '../../../src/immutable/constraints/ConstraintResult.js';
import { ConstraintViolation } from '../../../src/immutable/constraints/ConstraintViolation.js';
import { ConstraintViolationError } from '../../../src/immutable/ConstraintViolationError.js';
import { Edge } from '../../../src/Edge.js';
import { RelationshipType } from '../../../src/RelationshipType.js';

describe('Comprehensive Constraint Scenarios', () => {
  describe('Cardinality Constraint Enforcement', () => {
    test('should enforce minimum and maximum cardinality constraints', () => {
      const store = new ImmutableDataStore({
        constraints: [
          // Each employee must work at exactly one company
          new CardinalityConstraint('one-company', 'worksAt', 'source', 1, 1),
          // Each company must have between 2 and 100 employees
          new CardinalityConstraint('company-size', 'worksAt', 'target', 2, 100),
          // Each employee can manage 0 to 5 other employees
          new CardinalityConstraint('management-span', 'manages', 'source', 0, 5)
        ]
      });

      // Set up entities
      let currentStore = store
        .withEntityType('emp1', 'Employee')
        .withEntityType('emp2', 'Employee')
        .withEntityType('emp3', 'Employee')
        .withEntityType('comp1', 'Company')
        .withEntityType('comp2', 'Company');

      // Test: Can't have employee without company (when trying to add other edges)
      // First, add management relationship
      currentStore = currentStore.addEdge(new Edge('manages', 'emp1', 'emp2'));
      
      // Now emp1 must work somewhere (min cardinality = 1)
      currentStore = currentStore.addEdge(new Edge('worksAt', 'emp1', 'comp1'));
      currentStore = currentStore.addEdge(new Edge('worksAt', 'emp2', 'comp1'));

      // Test: Can't exceed max cardinality
      expect(() => {
        currentStore.addEdge(new Edge('worksAt', 'emp1', 'comp2')); // Would violate exactly-one constraint
      }).toThrow(ConstraintViolationError);

      // Test: Company needs minimum employees
      const store2 = store
        .withEntityType('emp4', 'Employee')
        .withEntityType('comp3', 'Company');

      // First employee is OK
      const store3 = store2.addEdge(new Edge('worksAt', 'emp4', 'comp3'));
      
      // Company still needs one more employee (min = 2)
      // This is OK for now since we're building up the graph
      expect(store3.getEdgeCount()).toBe(1);

      // Test management span
      let mgmtStore = store
        .withEntityType('manager', 'Manager')
        .withEntityType('emp5', 'Employee')
        .withEntityType('emp6', 'Employee')
        .withEntityType('emp7', 'Employee')
        .withEntityType('emp8', 'Employee')
        .withEntityType('emp9', 'Employee')
        .withEntityType('emp10', 'Employee');

      // Manager can manage up to 5 employees
      mgmtStore = mgmtStore
        .addEdge(new Edge('manages', 'manager', 'emp5'))
        .addEdge(new Edge('manages', 'manager', 'emp6'))
        .addEdge(new Edge('manages', 'manager', 'emp7'))
        .addEdge(new Edge('manages', 'manager', 'emp8'))
        .addEdge(new Edge('manages', 'manager', 'emp9'));

      // 6th employee would exceed limit
      expect(() => {
        mgmtStore.addEdge(new Edge('manages', 'manager', 'emp10'));
      }).toThrow(ConstraintViolationError);
    });

    test('should handle removal operations with min cardinality', () => {
      const store = new ImmutableDataStore({
        constraints: [
          // Project must have at least 2 team members
          new CardinalityConstraint('min-team-size', 'assignedTo', 'target', 2, null)
        ]
      });

      // Set up project with 3 members
      let currentStore = store
        .withEntityType('p1', 'Person')
        .withEntityType('p2', 'Person')
        .withEntityType('p3', 'Person')
        .withEntityType('proj', 'Project')
        .addEdge(new Edge('assignedTo', 'p1', 'proj'))
        .addEdge(new Edge('assignedTo', 'p2', 'proj'))
        .addEdge(new Edge('assignedTo', 'p3', 'proj'));

      // Can remove one person (leaves 2, which meets minimum)
      const afterRemove1 = currentStore.removeEdge(new Edge('assignedTo', 'p3', 'proj'));
      expect(afterRemove1.getEdgeCount()).toBe(2);

      // Can't remove another (would leave 1, below minimum)
      expect(() => {
        afterRemove1.removeEdge(new Edge('assignedTo', 'p2', 'proj'));
      }).toThrow(ConstraintViolationError);
    });
  });

  describe('Entity Type Constraint Enforcement', () => {
    test('should enforce entity type constraints strictly', () => {
      const personType = new EntityType('Person');
      const companyType = new EntityType('Company');
      const projectType = new EntityType('Project');
      
      const registry = new EntityTypeRegistry([personType, companyType, projectType]);
      
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        constraints: [
          new EntityTypeConstraint('person-works-at-company', 'worksAt', {
            source: 'Person',
            target: 'Company'
          }),
          new EntityTypeConstraint('person-works-on-project', 'worksOn', {
            source: 'Person',
            target: 'Project'
          }),
          new EntityTypeConstraint('company-owns-project', 'owns', {
            source: 'Company',
            target: 'Project'
          })
        ]
      });

      let currentStore = store
        .withEntityType('alice', 'Person')
        .withEntityType('acme', 'Company')
        .withEntityType('proj1', 'Project');

      // Valid edges
      currentStore = currentStore
        .addEdge(new Edge('worksAt', 'alice', 'acme'))
        .addEdge(new Edge('worksOn', 'alice', 'proj1'))
        .addEdge(new Edge('owns', 'acme', 'proj1'));

      expect(currentStore.getEdgeCount()).toBe(3);

      // Invalid: Person -> Person for worksAt
      expect(() => {
        currentStore
          .withEntityType('bob', 'Person')
          .addEdge(new Edge('worksAt', 'alice', 'bob'));
      }).toThrow(ConstraintViolationError);

      // Invalid: Company -> Company for worksOn
      expect(() => {
        currentStore
          .withEntityType('beta', 'Company')
          .addEdge(new Edge('worksOn', 'acme', 'beta'));
      }).toThrow(ConstraintViolationError);

      // Invalid: Project -> Company for owns
      expect(() => {
        currentStore.addEdge(new Edge('owns', 'proj1', 'acme'));
      }).toThrow(ConstraintViolationError);
    });

    test('should handle polymorphic entity types with inheritance', () => {
      const vehicleType = new EntityType('Vehicle');
      const carType = vehicleType.extend('Car');
      const truckType = vehicleType.extend('Truck');
      const personType = new EntityType('Person');
      
      const registry = new EntityTypeRegistry([vehicleType, carType, truckType, personType]);
      
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        constraints: [
          // Person can own any Vehicle (including subtypes)
          new EntityTypeConstraint('ownership', 'owns', {
            source: 'Person',
            target: 'Vehicle'
          })
        ]
      });

      let currentStore = store
        .withEntityType('alice', 'Person')
        .withEntityType('car1', 'Car')
        .withEntityType('truck1', 'Truck')
        .withEntityType('vehicle1', 'Vehicle');

      // All should work - Car and Truck are subtypes of Vehicle
      currentStore = currentStore
        .addEdge(new Edge('owns', 'alice', 'car1'))
        .addEdge(new Edge('owns', 'alice', 'truck1'))
        .addEdge(new Edge('owns', 'alice', 'vehicle1'));

      expect(currentStore.getEdgeCount()).toBe(3);

      // Invalid: Vehicle can't own Person
      expect(() => {
        currentStore.addEdge(new Edge('owns', 'car1', 'alice'));
      }).toThrow(ConstraintViolationError);
    });
  });

  describe('Custom Business Rule Constraints', () => {
    test('should enforce complex custom business rules', () => {
      const store = new ImmutableDataStore({
        constraints: [
          // Custom rule: No self-relationships
          new CustomConstraint('no-self-rel', '*', 'No self-relationships', (store, edge) => {
            if (edge.src === edge.dst) {
              return ConstraintResult.failure('no-self-rel', [
                new ConstraintViolation(
                  'no-self-rel',
                  'Self-relationships are not allowed',
                  edge
                )
              ]);
            }
            return ConstraintResult.success('no-self-rel');
          }),

          // Custom rule: Hierarchical consistency (can't manage someone who manages you)
          new CustomConstraint('no-circular-mgmt', 'manages', 'No circular management', (store, edge) => {
            // Check if target already manages source
            const reverseEdge = Array.from(store.getEdges().values())
              .find(e => e.type === 'manages' && e.src === edge.dst && e.dst === edge.src);
            
            if (reverseEdge) {
              return ConstraintResult.failure('no-circular-mgmt', [
                new ConstraintViolation(
                  'no-circular-mgmt',
                  'Circular management relationship detected',
                  edge,
                  { existingEdge: reverseEdge }
                )
              ]);
            }
            return ConstraintResult.success('no-circular-mgmt');
          }),

          // Custom rule: Budget constraints
          new CustomConstraint('budget-limit', 'funds', 'Project funding limits', (store, edge) => {
            const projectMeta = store.getEntityMetadata(edge.dst);
            const amount = projectMeta?.attributes?.fundingAmount || 0;
            
            // Get total funding for this project
            const existingFunding = Array.from(store.getEdges().values())
              .filter(e => e.type === 'funds' && e.dst === edge.dst)
              .reduce((sum, e) => {
                const funderMeta = store.getEntityMetadata(e.src);
                return sum + (funderMeta?.attributes?.contributionAmount || 0);
              }, 0);
            
            const newFunderMeta = store.getEntityMetadata(edge.src);
            const newAmount = newFunderMeta?.attributes?.contributionAmount || 0;
            
            if (existingFunding + newAmount > 1000000) {
              return ConstraintResult.failure('budget-limit', [
                new ConstraintViolation(
                  'budget-limit',
                  `Total funding would exceed $1M limit`,
                  edge,
                  { 
                    currentTotal: existingFunding,
                    newAmount: newAmount,
                    wouldBe: existingFunding + newAmount
                  }
                )
              ]);
            }
            return ConstraintResult.success('budget-limit');
          })
        ]
      });

      // Test no self-relationships
      let currentStore = store.withEntityType('entity1', 'Entity');
      
      expect(() => {
        currentStore.addEdge(new Edge('relates', 'entity1', 'entity1'));
      }).toThrow(ConstraintViolationError);

      // Test no circular management
      currentStore = store
        .withEntityType('manager1', 'Manager')
        .withEntityType('manager2', 'Manager')
        .addEdge(new Edge('manages', 'manager1', 'manager2'));

      expect(() => {
        currentStore.addEdge(new Edge('manages', 'manager2', 'manager1'));
      }).toThrow(ConstraintViolationError);

      // Test budget constraints
      currentStore = store
        .withEntityType('funder1', 'Funder', { contributionAmount: 400000 })
        .withEntityType('funder2', 'Funder', { contributionAmount: 400000 })
        .withEntityType('funder3', 'Funder', { contributionAmount: 300000 })
        .withEntityType('project1', 'Project', { fundingAmount: 0 });

      currentStore = currentStore
        .addEdge(new Edge('funds', 'funder1', 'project1'))
        .addEdge(new Edge('funds', 'funder2', 'project1'));

      // Total is now 800K, adding 300K would exceed 1M limit
      expect(() => {
        currentStore.addEdge(new Edge('funds', 'funder3', 'project1'));
      }).toThrow(ConstraintViolationError);
    });

    test('should handle temporal constraints', () => {
      const store = new ImmutableDataStore({
        constraints: [
          // Events must be scheduled in chronological order
          new CustomConstraint('chronological', 'follows', 'Chronological ordering', (store, edge) => {
            const prevEvent = store.getEntityMetadata(edge.src);
            const nextEvent = store.getEntityMetadata(edge.dst);
            
            const prevTime = prevEvent?.attributes?.timestamp || 0;
            const nextTime = nextEvent?.attributes?.timestamp || 0;
            
            if (prevTime >= nextTime) {
              return ConstraintResult.failure('chronological', [
                new ConstraintViolation(
                  'chronological',
                  'Events must be in chronological order',
                  edge,
                  { prevTime, nextTime }
                )
              ]);
            }
            return ConstraintResult.success('chronological');
          })
        ]
      });

      let currentStore = store
        .withEntityType('event1', 'Event', { timestamp: 1000 })
        .withEntityType('event2', 'Event', { timestamp: 2000 })
        .withEntityType('event3', 'Event', { timestamp: 1500 });

      // Valid: event1 (1000) -> event2 (2000)
      currentStore = currentStore.addEdge(new Edge('follows', 'event1', 'event2'));

      // Valid: event1 (1000) -> event3 (1500)
      currentStore = currentStore.addEdge(new Edge('follows', 'event1', 'event3'));

      // Invalid: event2 (2000) -> event3 (1500)
      expect(() => {
        currentStore.addEdge(new Edge('follows', 'event2', 'event3'));
      }).toThrow(ConstraintViolationError);

      // Invalid: event2 (2000) -> event1 (1000)
      expect(() => {
        currentStore.addEdge(new Edge('follows', 'event2', 'event1'));
      }).toThrow(ConstraintViolationError);
    });
  });

  describe('Constraint Violation Handling', () => {
    test('should provide detailed violation information', () => {
      const store = new ImmutableDataStore({
        constraints: [
          new CardinalityConstraint('max-one', 'rel', 'source', 0, 1)
        ]
      });

      let currentStore = store
        .withEntityType('a', 'Entity')
        .withEntityType('b', 'Entity')
        .withEntityType('c', 'Entity')
        .addEdge(new Edge('rel', 'a', 'b'));

      try {
        currentStore.addEdge(new Edge('rel', 'a', 'c'));
        fail('Should have thrown ConstraintViolationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ConstraintViolationError);
        expect(error.violations).toHaveLength(1);
        expect(error.violations[0].constraintId).toBe('max-one');
        expect(error.operation).toBe('addEdge');
        expect(error.retryable).toBe(true);
        expect(error.suggestions).toBeDefined();
        expect(error.performanceMetrics).toBeDefined();
      }
    });

    test('should handle multiple constraint violations', () => {
      const personType = new EntityType('Person', {
        required: ['name'],
        types: { name: 'string' }
      });
      
      const registry = new EntityTypeRegistry([personType]);
      
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        constraints: [
          new CardinalityConstraint('max-one', 'worksAt', 'source', 0, 1),
          new EntityTypeConstraint('person-to-company', 'worksAt', {
            source: 'Person',
            target: 'Company'
          })
        ]
      });

      let currentStore = store
        .withEntityType('alice', 'Person', { name: 'Alice' })
        .withEntityType('notCompany', 'NotCompany')
        .withEntityType('company1', 'Company')
        .addEdge(new Edge('worksAt', 'alice', 'company1'));

      // This violates both constraints:
      // 1. Alice already works somewhere (cardinality)
      // 2. NotCompany is not a Company (entity type)
      try {
        currentStore.addEdge(new Edge('worksAt', 'alice', 'notCompany'));
        fail('Should have thrown ConstraintViolationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ConstraintViolationError);
        expect(error.violations.length).toBeGreaterThanOrEqual(1);
        // At least the cardinality violation should be present
        expect(error.violations.some(v => v.constraintId === 'max-one')).toBe(true);
      }
    });
  });

  describe('Batch Operations with Constraints', () => {
    test('should validate all operations in batch atomically', () => {
      const store = new ImmutableDataStore({
        constraints: [
          new CardinalityConstraint('max-two', 'rel', 'source', 0, 2)
        ]
      });

      let currentStore = store
        .withEntityType('a', 'Entity')
        .withEntityType('b', 'Entity')
        .withEntityType('c', 'Entity')
        .withEntityType('d', 'Entity');

      // Batch that should succeed
      currentStore = currentStore.batch(batch => {
        batch.addEdge(new Edge('rel', 'a', 'b'));
        batch.addEdge(new Edge('rel', 'a', 'c'));
      });

      expect(currentStore.getEdgeCount()).toBe(2);

      // Batch that should succeed atomically (add and remove, final state is valid)
      const newStore = currentStore.batch(batch => {
        batch.addEdge(new Edge('rel', 'a', 'd')); // Would exceed max temporarily
        batch.removeEdge(new Edge('rel', 'a', 'b')); // This makes room - final state valid
      });

      // Store should be updated with the successful batch
      expect(newStore.getEdgeCount()).toBe(2); // Still 2 edges
      expect(newStore.hasEdge(new Edge('rel', 'a', 'b'))).toBe(false); // Removed
      expect(newStore.hasEdge(new Edge('rel', 'a', 'c'))).toBe(true);   // Still there
      expect(newStore.hasEdge(new Edge('rel', 'a', 'd'))).toBe(true);   // Added
      
      // Batch that should fail atomically (final state exceeds max)
      expect(() => {
        newStore.batch(batch => {
          batch.addEdge(new Edge('rel', 'a', 'b')); // Would exceed max with no removals
        });
      }).toThrow(ConstraintViolationError);
    });

    test('should handle complex batch scenarios', () => {
      const store = new ImmutableDataStore({
        constraints: [
          // Each person must have exactly one primary role
          new CardinalityConstraint('one-primary', 'primaryRole', 'source', 1, 1),
          // Each person can have 0-3 secondary roles
          new CardinalityConstraint('max-secondary', 'secondaryRole', 'source', 0, 3)
        ]
      });

      let currentStore = store
        .withEntityType('alice', 'Person')
        .withEntityType('role1', 'Role')
        .withEntityType('role2', 'Role')
        .withEntityType('role3', 'Role')
        .withEntityType('role4', 'Role')
        .withEntityType('role5', 'Role');

      // Set up initial state
      currentStore = currentStore.batch(batch => {
        batch.addEdge(new Edge('primaryRole', 'alice', 'role1'));
        batch.addEdge(new Edge('secondaryRole', 'alice', 'role2'));
        batch.addEdge(new Edge('secondaryRole', 'alice', 'role3'));
      });

      // Valid batch: Change primary role
      currentStore = currentStore.batch(batch => {
        batch.removeEdge(new Edge('primaryRole', 'alice', 'role1'));
        batch.addEdge(new Edge('primaryRole', 'alice', 'role4'));
      });

      expect(currentStore.getEdgesBySource('alice').filter(e => e.type === 'primaryRole')).toHaveLength(1);

      // Invalid batch: Try to add too many secondary roles
      expect(() => {
        currentStore.batch(batch => {
          batch.addEdge(new Edge('secondaryRole', 'alice', 'role4'));
          batch.addEdge(new Edge('secondaryRole', 'alice', 'role5'));
        });
      }).toThrow(ConstraintViolationError);
    });
  });
});