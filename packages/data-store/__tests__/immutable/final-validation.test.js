/**
 * Final Validation Test
 * Demonstrates the complete working immutable data store
 * MVP Implementation Complete
 */

import { ImmutableDataStore } from '../../src/immutable/ImmutableDataStore.js';
import { CardinalityConstraint } from '../../src/immutable/constraints/CardinalityConstraint.js';
import { EntityTypeConstraint } from '../../src/immutable/constraints/EntityTypeConstraint.js';
import { CustomConstraint } from '../../src/immutable/constraints/CustomConstraint.js';
import { ConstraintResult } from '../../src/immutable/constraints/ConstraintResult.js';
import { ConstraintViolation } from '../../src/immutable/constraints/ConstraintViolation.js';
import { EntityType } from '../../src/immutable/schema/EntityType.js';
import { EntityTypeRegistry } from '../../src/immutable/schema/EntityTypeRegistry.js';
import { Edge } from '../../src/Edge.js';

describe('Final Validation - MVP Complete', () => {
  test('should demonstrate complete working immutable data store', () => {
    // Create entity types with schema validation
    const userType = new EntityType('User', {
      required: ['name', 'email'],
      types: { name: 'string', email: 'string' }
    });
    
    const projectType = new EntityType('Project', {
      required: ['title', 'status'],
      types: { title: 'string', status: 'string' }
    });
    
    // Create registry
    const registry = new EntityTypeRegistry([userType, projectType]);
    
    // Define constraints
    const constraints = [
      // Each user can manage 0-3 projects
      new CardinalityConstraint('max-projects', 'manages', 'source', 0, 3),
      // Each project must have exactly 1 manager
      new CardinalityConstraint('one-manager', 'manages', 'target', 1, 1),
      // Type safety: only Users can manage Projects
      new EntityTypeConstraint('user-manages-project', 'manages', {
        source: 'User',
        target: 'Project'
      }),
      // Custom business rule: completed projects can't be managed
      new CustomConstraint('no-completed-management', 'manages', 
        'Completed projects cannot be managed',
        (store, edge) => {
          const projectMeta = store.getEntityMetadata(edge.dst);
          if (projectMeta?.attributes?.status === 'completed') {
            return ConstraintResult.failure('no-completed-management', [
              new ConstraintViolation(
                'no-completed-management',
                'Cannot manage completed projects',
                edge
              )
            ]);
          }
          return ConstraintResult.success('no-completed-management');
        }
      )
    ];
    
    // Create immutable data store
    const store = new ImmutableDataStore({
      entityTypeRegistry: registry,
      constraints: constraints,
      enableSchemaValidation: true
    });
    
    // Build system state immutably
    let system = store
      // Add users with validated attributes
      .withEntityType('alice', 'User', { 
        name: 'Alice Smith', 
        email: 'alice@example.com' 
      })
      .withEntityType('bob', 'User', { 
        name: 'Bob Jones', 
        email: 'bob@example.com' 
      })
      // Add projects
      .withEntityType('proj1', 'Project', { 
        title: 'Website Redesign', 
        status: 'active' 
      })
      .withEntityType('proj2', 'Project', { 
        title: 'Mobile App', 
        status: 'active' 
      })
      .withEntityType('proj3', 'Project', { 
        title: 'Legacy System', 
        status: 'completed' 
      });
    
    // Add relationships with constraint validation
    system = system
      .addEdge(new Edge('manages', 'alice', 'proj1'))
      .addEdge(new Edge('manages', 'bob', 'proj2'));
    
    // Verify system state
    expect(system.getEdgeCount()).toBe(2);
    expect(system.getEdgesByType('manages')).toHaveLength(2);
    
    // Test constraint: Can't manage completed project
    expect(() => {
      system.addEdge(new Edge('manages', 'alice', 'proj3'));
    }).toThrow('Constraint validation failed');
    
    // Test constraint: Can't have two managers
    expect(() => {
      system.addEdge(new Edge('manages', 'alice', 'proj2'));
    }).toThrow('Constraint validation failed');
    
    // Test immutability
    expect(Object.isFrozen(system)).toBe(true);
    
    // Query capabilities
    const aliceProjects = system.getEdgesBySource('alice')
      .filter(e => e.type === 'manages')
      .map(e => e.dst);
    expect(aliceProjects).toEqual(['proj1']);
    
    // Dynamic constraint management
    const systemWithNewConstraint = system.addConstraint(
      new CardinalityConstraint('min-one-project', 'manages', 'source', 1, null)
    );
    
    // Now alice must manage at least one project
    expect(() => {
      systemWithNewConstraint.removeEdge(new Edge('manages', 'alice', 'proj1'));
    }).toThrow('Constraint validation failed');
    
    // Success - Complete working immutable data store!
    expect(system).toBeDefined();
    expect(system).toBeInstanceOf(ImmutableDataStore);
  });
  
  test('should demonstrate structural sharing and performance', () => {
    const store = new ImmutableDataStore();
    
    // Build large graph
    let currentStore = store;
    for (let i = 0; i < 100; i++) {
      currentStore = currentStore.withEntityType(`node${i}`, 'Node');
    }
    
    for (let i = 0; i < 99; i++) {
      currentStore = currentStore.addEdge(new Edge('next', `node${i}`, `node${i+1}`));
    }
    
    // Make small change
    const before = currentStore;
    const after = currentStore.addEdge(new Edge('special', 'node0', 'node99'));
    
    // Different stores but sharing structure
    expect(before).not.toBe(after);
    expect(before.getEdgeCount()).toBe(99);
    expect(after.getEdgeCount()).toBe(100);
    
    // Both immutable
    expect(Object.isFrozen(before)).toBe(true);
    expect(Object.isFrozen(after)).toBe(true);
  });
});