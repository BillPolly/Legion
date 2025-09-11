/**
 * Integration tests for CollectionProxy with update+query functionality
 * Phase 3: CollectionProxy Integration
 * NO MOCKS - using real DataStore and DataScript
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataStore } from '../src/store.js';
import { DataStoreProxy } from '../src/datastore-proxy.js';
import { EntityProxy } from '../src/proxy.js';
import { CollectionProxy } from '../src/collection-proxy.js';
import { StreamProxy } from '../src/stream-proxy.js';

describe('CollectionProxy Update+Query Integration', () => {
  let dataStore;
  let dataStoreProxy;
  
  beforeEach(() => {
    // Create real DataStore with comprehensive schema
    const schema = {
      ':user/name': { valueType: 'string' },
      ':user/email': { valueType: 'string', unique: 'identity' },
      ':user/team': { valueType: 'string' },
      ':user/role': { valueType: 'string' },
      ':user/active': { valueType: 'boolean' },
      ':task/title': { valueType: 'string' },
      ':task/assignee': { valueType: 'ref' },
      ':task/status': { valueType: 'string' },
      ':task/priority': { valueType: 'number' },
      ':project/name': { valueType: 'string' },
      ':project/tasks': { valueType: 'ref', card: 'many' },
      ':project/team': { valueType: 'string' }
    };
    
    dataStore = new DataStore(schema);
    dataStoreProxy = new DataStoreProxy(dataStore);
  });
  
  describe('CollectionProxy.query() with Updates', () => {
    it('should support chained update+query on collection', () => {
      // First create a collection of users
      const users = dataStoreProxy.query({
        update: [
          { ':user/name': 'Alice', ':user/team': 'frontend', ':user/role': 'developer' },
          { ':user/name': 'Bob', ':user/team': 'frontend', ':user/role': 'designer' },
          { ':user/name': 'Charlie', ':user/team': 'backend', ':user/role': 'developer' }
        ],
        find: ['?user'],
        where: [
          ['?user', ':user/team', 'frontend']
        ]
      });
      
      expect(users).toBeInstanceOf(CollectionProxy);
      expect(users.length).toBe(2); // Alice and Bob
      
      // Now chain a query with update to add tasks for these users
      const tasksResult = users.query({
        update: [
          { ':task/title': 'Design UI', ':task/assignee': '?user-0', ':task/status': 'open' },
          { ':task/title': 'Implement form', ':task/assignee': '?user-0', ':task/status': 'open' },
          { ':task/title': 'Create mockups', ':task/assignee': '?user-1', ':task/status': 'open' }
        ],
        find: ['?task'],
        where: [
          ['?task', ':task/assignee', '?user-0']
        ]
      });
      
      // Should return tasks for the first user (Alice)
      expect(tasksResult).toBeInstanceOf(CollectionProxy);
      expect(tasksResult.length).toBe(2);
    });
    
    it('should add items to existing collection', () => {
      // Create initial collection
      const initialProjects = dataStoreProxy.query({
        update: [
          { ':project/name': 'Project A', ':project/team': 'alpha' },
          { ':project/name': 'Project B', ':project/team': 'beta' }
        ],
        find: ['?project'],
        where: [
          ['?project', ':project/name', '?name']
        ]
      });
      
      expect(initialProjects).toBeInstanceOf(CollectionProxy);
      expect(initialProjects.length).toBe(2);
      
      // Add more projects via collection query
      const expandedProjects = initialProjects.query({
        update: [
          { ':project/name': 'Project C', ':project/team': 'alpha' },
          { ':project/name': 'Project D', ':project/team': 'beta' }
        ],
        find: ['?project'],
        where: [
          ['?project', ':project/name', '?name']
        ]
      });
      
      // Should now have all 4 projects
      expect(expandedProjects).toBeInstanceOf(CollectionProxy);
      expect(expandedProjects.length).toBe(4);
    });
    
    it('should preserve collection context in updates', () => {
      // Create users in specific team
      const teamUsers = dataStoreProxy.query({
        update: [
          { ':user/name': 'TeamLead', ':user/team': 'mobile', ':user/role': 'lead' },
          { ':user/name': 'Dev1', ':user/team': 'mobile', ':user/role': 'developer' },
          { ':user/name': 'Dev2', ':user/team': 'mobile', ':user/role': 'developer' }
        ],
        find: ['?user'],
        where: [
          ['?user', ':user/team', 'mobile']
        ]
      });
      
      // Update only the developers in this team
      const updatedDevs = teamUsers.query({
        update: {
          ':user/active': true
        },
        find: ['?user'],
        where: [
          ['?user', ':user/role', 'developer'],
          ['?user', ':user/team', 'mobile']
        ]
      });
      
      expect(updatedDevs).toBeInstanceOf(CollectionProxy);
      expect(updatedDevs.length).toBe(2); // Only the 2 developers
      
      // Verify they were updated
      expect(updatedDevs[0].get(':user/active')).toBe(true);
      expect(updatedDevs[1].get(':user/active')).toBe(true);
    });
    
    it('should handle empty collection in chained query', () => {
      // Query for non-existent items
      const emptyCollection = dataStoreProxy.query({
        find: ['?user'],
        where: [
          ['?user', ':user/team', 'non-existent-team']
        ]
      });
      
      expect(emptyCollection).toBeInstanceOf(CollectionProxy);
      expect(emptyCollection.length).toBe(0);
      
      // Try to chain update+query on empty collection
      const result = emptyCollection.query({
        update: {
          ':user/name': 'NewUser',
          ':user/team': 'new-team'
        },
        find: ['?user'],
        where: [
          ['?user', ':user/team', 'new-team']
        ]
      });
      
      // Should create the new user and return it
      expect(result).toBeInstanceOf(EntityProxy);
      expect(result.get(':user/name')).toBe('NewUser');
    });
  });
  
  describe('Collection Filtering Tests', () => {
    it('should support collection-scoped updates', () => {
      // Create tasks with different priorities
      const allTasks = dataStoreProxy.query({
        update: [
          { ':task/title': 'Critical Bug', ':task/priority': 1, ':task/status': 'open' },
          { ':task/title': 'Feature Request', ':task/priority': 3, ':task/status': 'open' },
          { ':task/title': 'Documentation', ':task/priority': 5, ':task/status': 'open' },
          { ':task/title': 'Hotfix', ':task/priority': 1, ':task/status': 'open' }
        ],
        find: ['?task'],
        where: [
          ['?task', ':task/status', 'open']
        ]
      });
      
      expect(allTasks.length).toBe(4);
      
      // Update only high-priority tasks in the collection
      const criticalTasks = allTasks.filter(task => task.get(':task/priority') === 1);
      expect(criticalTasks.length).toBe(2);
      
      // Mark critical tasks as in-progress
      const updatedCritical = criticalTasks.query({
        update: criticalTasks.map(task => ({
          ':db/id': task.entityId,
          ':task/status': 'in-progress'
        })),
        find: ['?task'],
        where: [
          ['?task', ':task/status', 'in-progress']
        ]
      });
      
      expect(updatedCritical).toBeInstanceOf(CollectionProxy);
      expect(updatedCritical.length).toBe(2);
    });
    
    it('should handle cross-collection queries', () => {
      // Create users and projects
      const setupResult = dataStoreProxy.query({
        update: [
          { ':user/name': 'Alice', ':user/team': 'alpha' },
          { ':user/name': 'Bob', ':user/team': 'beta' },
          { ':project/name': 'Project X', ':project/team': 'alpha' },
          { ':project/name': 'Project Y', ':project/team': 'beta' }
        ],
        find: ['?entity'],
        where: [
          ['?entity', ':user/name', '?name']
        ]
      });
      
      // Get users collection
      const users = dataStoreProxy.query({
        find: ['?user'],
        where: [
          ['?user', ':user/name', '?name']
        ]
      });
      
      // Query for projects matching user teams
      const userProjects = users.query({
        find: ['?project'],
        where: [
          ['?user', ':user/team', '?team'],
          ['?project', ':project/team', '?team']
        ]
      });
      
      expect(userProjects).toBeInstanceOf(CollectionProxy);
      expect(userProjects.length).toBeGreaterThan(0);
    });
    
    it('should support collection intersection queries', () => {
      // Create users with roles
      const result = dataStoreProxy.query({
        update: [
          { ':user/name': 'Alice', ':user/role': 'developer', ':user/active': true },
          { ':user/name': 'Bob', ':user/role': 'developer', ':user/active': false },
          { ':user/name': 'Charlie', ':user/role': 'designer', ':user/active': true },
          { ':user/name': 'Diana', ':user/role': 'developer', ':user/active': true }
        ],
        find: ['?user'],
        where: [
          ['?user', ':user/role', 'developer']
        ]
      });
      
      const developers = result;
      expect(developers.length).toBe(3); // Alice, Bob, Diana
      
      // Get active users
      const activeUsers = dataStoreProxy.query({
        find: ['?user'],
        where: [
          ['?user', ':user/active', true]
        ]
      });
      
      expect(activeUsers.length).toBe(3); // Alice, Charlie, Diana
      
      // Find intersection: active developers
      const activeDevelopers = developers.filter(dev => dev.get(':user/active') === true);
      expect(activeDevelopers.length).toBe(2); // Alice and Diana
    });
    
    it('should enforce collection boundaries', () => {
      // Create separate teams
      const teamA = dataStoreProxy.query({
        update: [
          { ':user/name': 'A1', ':user/team': 'A' },
          { ':user/name': 'A2', ':user/team': 'A' }
        ],
        find: ['?user'],
        where: [
          ['?user', ':user/team', 'A']
        ]
      });
      
      const teamB = dataStoreProxy.query({
        update: [
          { ':user/name': 'B1', ':user/team': 'B' },
          { ':user/name': 'B2', ':user/team': 'B' }
        ],
        find: ['?user'],
        where: [
          ['?user', ':user/team', 'B']
        ]
      });
      
      expect(teamA.length).toBe(2);
      expect(teamB.length).toBe(2);
      
      // Updates through teamA should not affect teamB's view
      const updatedTeamA = teamA.query({
        update: teamA.map(user => ({
          ':db/id': user.entityId,
          ':user/active': true
        })),
        find: ['?user'],
        where: [
          ['?user', ':user/team', 'A'],
          ['?user', ':user/active', true]
        ]
      });
      
      expect(updatedTeamA.length).toBe(2);
      
      // Verify teamB users are not affected
      const teamBActive = dataStoreProxy.query({
        find: ['?user'],
        where: [
          ['?user', ':user/team', 'B'],
          ['?user', ':user/active', true]
        ]
      });
      
      expect(teamBActive.length).toBe(0); // No team B users should be active
    });
  });
});