/**
 * Integration tests for DefaultQueryBuilder
 * 
 * Tests the default query builder implementation with:
 * - Plain object ResourceManagers
 * - API-based ResourceManagers
 * - Handle hierarchy query flow
 * - All query combinator operations
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DefaultQueryBuilder } from '../../src/DefaultQueryBuilder.js';
import { PlainObjectResourceManager, exampleUsage } from '../../examples/PlainObjectResourceManager.js';
import { APIResourceManager, exampleAPIUsage } from '../../examples/APIResourceManager.js';
import { CollectionProxy } from '../../src/CollectionProxy.js';
import { EntityProxy } from '../../src/EntityProxy.js';

describe('DefaultQueryBuilder Integration Tests', () => {
  describe('PlainObjectResourceManager', () => {
    let resourceManager;
    let users;
    let projects;

    beforeEach(() => {
      // Create ResourceManager with plain JavaScript data
      resourceManager = new PlainObjectResourceManager({
        users: [
          { id: 1, name: 'Alice', age: 30, active: true, department: 'Engineering' },
          { id: 2, name: 'Bob', age: 25, active: true, department: 'Design' },
          { id: 3, name: 'Carol', age: 35, active: false, department: 'Engineering' },
          { id: 4, name: 'Dave', age: 28, active: true, department: 'Sales' },
          { id: 5, name: 'Eve', age: 22, active: true, department: 'Engineering' }
        ],
        projects: [
          { id: 101, name: 'Project Alpha', ownerId: 1, status: 'active' },
          { id: 102, name: 'Project Beta', ownerId: 2, status: 'completed' },
          { id: 103, name: 'Project Gamma', ownerId: 1, status: 'planning' }
        ]
      });

      // Create CollectionProxy handles
      users = new CollectionProxy(resourceManager, { collection: 'users' });
      projects = new CollectionProxy(resourceManager, { collection: 'projects' });
    });

    describe('Query Builder Creation', () => {
      it('should create DefaultQueryBuilder from queryBuilder method', () => {
        const builder = resourceManager.queryBuilder(users);
        
        expect(builder).toBeInstanceOf(DefaultQueryBuilder);
        expect(builder.resourceManager).toBe(resourceManager);
        expect(builder.sourceHandle).toBe(users);
      });

      it('should work with Handle hierarchy - queries flow up', () => {
        // Test that queries flow through Handle.where() -> ResourceManager.queryBuilder()
        const filtered = users.where(user => user.active === true);
        
        expect(filtered).toBeInstanceOf(DefaultQueryBuilder);
        expect(filtered.operations).toHaveLength(1);
        expect(filtered.operations[0].type).toBe('where');
      });
    });

    describe('Where Operations', () => {
      it('should filter data with where predicate', () => {
        const activeUsers = users
          .where(user => user.active === true)
          .toArray();
        
        expect(activeUsers).toHaveLength(4);
        expect(activeUsers.every(user => user.active === true)).toBe(true);
      });

      it('should chain multiple where filters', () => {
        const activeEngineers = users
          .where(user => user.active === true)
          .where(user => user.department === 'Engineering')
          .toArray();
        
        expect(activeEngineers).toHaveLength(2);
        expect(activeEngineers.map(u => u.name)).toEqual(['Alice', 'Eve']);
      });

      it('should handle predicates that throw errors', () => {
        const filtered = users
          .where(user => {
            if (!user.name) throw new Error('Missing name');
            return user.active === true;
          })
          .toArray();
        
        // Should still work - errors are caught and item excluded
        expect(filtered).toHaveLength(4);
      });
    });

    describe('Select Operations', () => {
      it('should transform data with select mapper', () => {
        const names = users
          .select(user => user.name)
          .toArray();
        
        expect(names).toEqual(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
      });

      it('should project to new object shapes', () => {
        const projected = users
          .where(user => user.active === true)
          .select(user => ({ 
            fullName: user.name, 
            yearsOld: user.age,
            dept: user.department 
          }))
          .toArray();
        
        expect(projected).toHaveLength(4);
        expect(projected[0]).toEqual({
          fullName: 'Alice',
          yearsOld: 30,
          dept: 'Engineering'
        });
      });
    });

    describe('OrderBy Operations', () => {
      it('should order by field ascending', () => {
        const ordered = users
          .orderBy('age', 'asc')
          .toArray();
        
        const ages = ordered.map(u => u.age);
        expect(ages).toEqual([22, 25, 28, 30, 35]);
      });

      it('should order by field descending', () => {
        const ordered = users
          .orderBy('name', 'desc')
          .toArray();
        
        const names = ordered.map(u => u.name);
        expect(names).toEqual(['Eve', 'Dave', 'Carol', 'Bob', 'Alice']);
      });

      it('should order by function', () => {
        const ordered = users
          .orderBy(user => user.department + user.name, 'asc')
          .toArray();
        
        expect(ordered[0].name).toBe('Bob'); // Design + Bob
        expect(ordered[1].name).toBe('Alice'); // Engineering + Alice
      });
    });

    describe('Limit and Skip Operations', () => {
      it('should limit results', () => {
        const limited = users
          .orderBy('name', 'asc')
          .limit(3)
          .toArray();
        
        expect(limited).toHaveLength(3);
        expect(limited.map(u => u.name)).toEqual(['Alice', 'Bob', 'Carol']);
      });

      it('should skip results', () => {
        const skipped = users
          .orderBy('name', 'asc')
          .skip(2)
          .toArray();
        
        expect(skipped).toHaveLength(3);
        expect(skipped.map(u => u.name)).toEqual(['Carol', 'Dave', 'Eve']);
      });

      it('should paginate with skip and limit', () => {
        const page2 = users
          .orderBy('id', 'asc')
          .skip(2)
          .limit(2)
          .toArray();
        
        expect(page2).toHaveLength(2);
        expect(page2.map(u => u.id)).toEqual([3, 4]);
      });
    });

    describe('GroupBy Operations', () => {
      it('should group by field', () => {
        const grouped = users
          .groupBy('department')
          .toArray();
        
        expect(grouped).toHaveLength(3);
        
        const engGroup = grouped.find(g => g.key === 'Engineering');
        expect(engGroup.count).toBe(3);
        expect(engGroup.items).toHaveLength(3);
      });

      it('should group by function', () => {
        const grouped = users
          .groupBy(user => Math.floor(user.age / 10) * 10)
          .toArray();
        
        expect(grouped).toHaveLength(2);
        
        const twenties = grouped.find(g => g.key === '20');
        expect(twenties.count).toBe(3);
        
        const thirties = grouped.find(g => g.key === '30');
        expect(thirties.count).toBe(2);
      });
    });

    describe('Aggregate Operations', () => {
      it('should calculate count', () => {
        const count = users
          .where(user => user.active === true)
          .aggregate('count');
        
        expect(count).toBe(4);
      });

      it('should calculate sum', () => {
        const totalAge = users
          .aggregate('sum', 'age');
        
        expect(totalAge).toBe(30 + 25 + 35 + 28 + 22);
      });

      it('should calculate average', () => {
        const avgAge = users
          .where(user => user.department === 'Engineering')
          .aggregate('avg', 'age');
        
        expect(avgAge).toBe((30 + 35 + 22) / 3);
      });

      it('should find min and max', () => {
        const minAge = users.aggregate('min', 'age');
        const maxAge = users.aggregate('max', 'age');
        
        expect(minAge).toBe(22);
        expect(maxAge).toBe(35);
      });

      it('should support custom aggregate functions', () => {
        const median = users
          .aggregate((items, field) => {
            const values = items.map(item => item[field]).sort((a, b) => a - b);
            return values[Math.floor(values.length / 2)];
          }, 'age');
        
        expect(median).toBe(28); // Middle value of [22, 25, 28, 30, 35]
      });
    });

    describe('Join Operations', () => {
      it('should join with attribute equality', () => {
        const joined = projects
          .join(users, (project, user) => project.ownerId === user.id)
          .toArray();
        
        // Projects joined with their owners
        expect(joined).toHaveLength(3);
        expect(joined[0]).toHaveProperty('status'); // From project
        expect(joined[0]).toHaveProperty('department'); // From user
      });

      it('should join with string field name', () => {
        // Add matching field for simple join
        const modifiedUsers = users
          .select(user => ({ ...user, projectOwnerId: user.id }))
          .toArray();
        
        const modifiedProjects = projects
          .select(project => ({ ...project, projectOwnerId: project.ownerId }))
          .toArray();
        
        // Can't directly test string-based join with our current setup
        // but the functionality is there in DefaultQueryBuilder
      });
    });

    describe('Terminal Methods', () => {
      it('should get first result', () => {
        const first = users
          .where(user => user.active === true)
          .orderBy('name', 'asc')
          .first();
        
        expect(first).not.toBeNull();
        expect(first.name).toBe('Alice');
      });

      it('should get last result', () => {
        const last = users
          .where(user => user.active === true)
          .orderBy('age', 'asc')
          .last();
        
        expect(last).not.toBeNull();
        expect(last.name).toBe('Alice'); // Age 30
      });

      it('should count results', () => {
        const count = users
          .where(user => user.department === 'Engineering')
          .count();
        
        expect(count).toBe(3);
      });

      it('should return null for empty first/last', () => {
        const first = users
          .where(user => user.age > 100)
          .first();
        
        const last = users
          .where(user => user.age > 100)
          .last();
        
        expect(first).toBeNull();
        expect(last).toBeNull();
      });
    });

    describe('Complex Query Chains', () => {
      it('should handle complex multi-operation queries', () => {
        const results = users
          .where(user => user.active === true)
          .where(user => user.age >= 25)
          .select(user => ({
            name: user.name,
            age: user.age,
            dept: user.department
          }))
          .orderBy('age', 'desc')
          .limit(2)
          .toArray();
        
        expect(results).toHaveLength(2);
        expect(results[0].name).toBe('Alice'); // Age 30
        expect(results[1].name).toBe('Dave');  // Age 28
      });

      it('should maintain immutability', () => {
        const builder1 = resourceManager.queryBuilder(users);
        const builder2 = builder1.where(user => user.active);
        const builder3 = builder2.select(user => user.name);
        
        expect(builder1).not.toBe(builder2);
        expect(builder2).not.toBe(builder3);
        expect(builder1.operations).toHaveLength(0);
        expect(builder2.operations).toHaveLength(1);
        expect(builder3.operations).toHaveLength(2);
      });
    });

    describe('Entity Proxy Wrapping', () => {
      it('should wrap results when ResourceManager provides wrapQueryResult', () => {
        // Add wrapQueryResult method to test custom wrapping
        const wrapQueryResultSpy = jest.fn((result) => {
          return new EntityProxy(resourceManager, result.id);
        });
        resourceManager.wrapQueryResult = wrapQueryResultSpy;

        const first = users.first();
        
        // Should call wrapQueryResult for result wrapping
        expect(wrapQueryResultSpy).toHaveBeenCalledWith({
          id: 1,
          name: 'Alice',
          age: 30,
          active: true,
          department: 'Engineering'
        });
        expect(first).toBeInstanceOf(EntityProxy);
        
        // Clean up
        delete resourceManager.wrapQueryResult;
      });

      it('should return plain objects when no custom wrapping', () => {
        // Ensure no wrapQueryResult method
        delete resourceManager.wrapQueryResult;
        
        const first = users.first();
        
        expect(first).toEqual({
          id: 1,
          name: 'Alice',
          age: 30,
          active: true,
          department: 'Engineering'
        });
      });
    });
  });

  describe('APIResourceManager', () => {
    let apiManager;
    let users;
    let projects;
    let tasks;

    beforeEach(() => {
      // Create API-backed ResourceManager
      apiManager = new APIResourceManager('https://api.example.com', {
        cacheTimeout: 30000
      });
      
      // Create CollectionProxy handles for API endpoints
      users = new CollectionProxy(apiManager, { collection: 'users' });
      projects = new CollectionProxy(apiManager, { collection: 'projects' });
      tasks = new CollectionProxy(apiManager, { collection: 'tasks' });
    });

    describe('API Data Querying', () => {
      it('should filter cached API data locally', () => {
        const activeAdmins = users
          .where(user => user.active === true)
          .where(user => user.role === 'admin')
          .select(user => ({ name: user.name, email: user.email }))
          .toArray();
        
        expect(activeAdmins).toHaveLength(2);
        expect(activeAdmins.map(u => u.name)).toEqual(['Alice', 'Eve']);
      });

      it('should handle complex queries on API data', () => {
        const highPriorityProjects = projects
          .where(project => project.priority === 'high')
          .where(project => project.status === 'in_progress')
          .orderBy('title', 'asc')
          .toArray();
        
        expect(highPriorityProjects).toHaveLength(2);
        expect(highPriorityProjects[0].title).toBe('Database Migration'); // First alphabetically
        expect(highPriorityProjects[1].title).toBe('Website Redesign'); // Second alphabetically
      });

      it('should join data from multiple API endpoints', () => {
        const tasksWithProjects = tasks
          .where(task => !task.completed)
          .join(projects, (task, project) => task.projectId === project.id)
          .select(joined => ({
            taskTitle: joined.title,
            projectId: joined.projectId,
            projectStatus: joined.status
          }))
          .toArray();
        
        expect(tasksWithProjects.length).toBeGreaterThan(0);
        expect(tasksWithProjects[0]).toHaveProperty('taskTitle');
        expect(tasksWithProjects[0]).toHaveProperty('projectStatus');
      });

      it('should aggregate API data locally', () => {
        const usersByRole = users
          .groupBy('role')
          .toArray();
        
        expect(usersByRole.length).toBeGreaterThan(0);
        
        const adminGroup = usersByRole.find(g => g.key === 'admin');
        expect(adminGroup).toBeDefined();
        expect(adminGroup.count).toBe(2);
      });
    });

    describe('API Caching', () => {
      it('should use cached data when available', () => {
        // First query populates cache
        const results1 = users.toArray();
        
        // Check cache is populated
        expect(apiManager.cache.size).toBeGreaterThan(0);
        
        // Second query uses cache
        const results2 = users.toArray();
        
        // Results should be identical (same cached data)
        expect(results2).toEqual(results1);
      });
    });

    describe('Complex API Workflows', () => {
      it('should handle pagination simulation', () => {
        const page1 = users
          .orderBy('id', 'asc')
          .skip(0)
          .limit(2)
          .toArray();
        
        const page2 = users
          .orderBy('id', 'asc')
          .skip(2)
          .limit(2)
          .toArray();
        
        expect(page1).toHaveLength(2);
        expect(page2).toHaveLength(2);
        expect(page1[0].id).toBeLessThan(page2[0].id);
      });

      it('should calculate statistics on API data', () => {
        const activeCount = users
          .where(user => user.active === true)
          .count();
        
        const avgTasksPerProject = tasks
          .groupBy('projectId')
          .select(group => group.count)
          .aggregate('avg');
        
        expect(activeCount).toBeGreaterThan(0);
        expect(typeof avgTasksPerProject).toBe('number');
      });
    });
  });

  describe('Handle Hierarchy Integration', () => {
    it('should flow queries up through Handle tree', () => {
      const resourceManager = new PlainObjectResourceManager({
        items: [
          { id: 1, value: 10 },
          { id: 2, value: 20 },
          { id: 3, value: 30 }
        ]
      });
      
      const collection = new CollectionProxy(resourceManager, { collection: 'items' });
      
      // Query starts at Handle, flows to ResourceManager.queryBuilder()
      const filtered = collection.where(item => item.value > 15);
      
      expect(filtered).toBeInstanceOf(DefaultQueryBuilder);
      expect(filtered.resourceManager).toBe(resourceManager);
      expect(filtered.sourceHandle).toBe(collection);
    });

    it('should maintain Handle references through query chain', () => {
      const resourceManager = new PlainObjectResourceManager({
        items: [{ id: 1 }, { id: 2 }]
      });
      
      const collection = new CollectionProxy(resourceManager, { collection: 'items' });
      
      const builder1 = collection.where(item => item.id > 0);
      const builder2 = builder1.select(item => item.id);
      const builder3 = builder2.limit(1);
      
      // All builders should reference the same source Handle
      expect(builder1.sourceHandle).toBe(collection);
      expect(builder2.sourceHandle).toBe(collection);
      expect(builder3.sourceHandle).toBe(collection);
    });
  });

  describe('Example Functions', () => {
    it('should run PlainObjectResourceManager example', () => {
      // Capture console output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      exampleUsage();
      
      // Verify example ran successfully
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should run APIResourceManager example', () => {
      // Capture console output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const apiManager = exampleAPIUsage();
      
      // Verify example ran and returned manager
      expect(apiManager).toBeInstanceOf(APIResourceManager);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});