/**
 * APIResourceManager - Example ResourceManager backed by API calls
 * 
 * Demonstrates how a ResourceManager that fetches data from a remote API
 * can use the DefaultQueryBuilder for client-side query operations.
 * 
 * The API returns JSON data which is then processed locally using
 * DefaultQueryBuilder's array operations.
 */

import { DefaultQueryBuilder } from '../src/DefaultQueryBuilder.js';
import { CollectionProxy } from '../src/CollectionProxy.js';
import { EntityProxy } from '../src/EntityProxy.js';

export class APIResourceManager {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.cache = new Map(); // Cache API responses
    this.cacheTimeout = options.cacheTimeout || 60000; // 1 minute default
    this._subscriptions = new Map();
  }
  
  // Required ResourceManager interface methods
  
  query(querySpec) {
    // Fetch data from API based on query spec
    // For this example, we'll simulate with cached data
    
    if (querySpec.endpoint) {
      // Direct endpoint query
      return this._fetchFromAPI(querySpec.endpoint);
    }
    
    if (querySpec.collection) {
      // Collection-based query
      const endpoint = `/${querySpec.collection}`;
      return this._fetchFromAPI(endpoint);
    }
    
    if (querySpec.entityId) {
      // Single entity query
      const endpoint = `/${querySpec.collection || 'entities'}/${querySpec.entityId}`;
      const result = this._fetchFromAPI(endpoint);
      return result ? [result] : [];
    }
    
    // Default: return empty array
    return [];
  }
  
  subscribe(querySpec, callback) {
    // Set up polling subscription for API data
    const subscription = {
      id: Date.now() + Math.random(),
      querySpec,
      callback,
      interval: null,
      unsubscribe: () => {
        if (subscription.interval) {
          clearInterval(subscription.interval);
        }
        this._subscriptions.delete(subscription.id);
      }
    };
    
    // Poll API every 5 seconds (in real app, might use WebSocket)
    subscription.interval = setInterval(() => {
      const data = this.query(querySpec);
      callback(data);
    }, 5000);
    
    this._subscriptions.set(subscription.id, subscription);
    return subscription;
  }
  
  getSchema() {
    // Could fetch schema from API
    return {
      endpoints: ['/users', '/projects', '/tasks'],
      version: '2.0.0',
      apiVersion: 'v1'
    };
  }
  
  /**
   * Query builder implementation - returns DefaultQueryBuilder
   * This enables client-side filtering/sorting/aggregation of API data
   */
  queryBuilder(sourceHandle) {
    return new DefaultQueryBuilder(this, sourceHandle);
  }
  
  // Optional methods
  
  async update(updateSpec) {
    // POST/PUT to API
    const endpoint = `/${updateSpec.collection}/${updateSpec.id}`;
    try {
      // Simulate API call
      const response = await this._postToAPI(endpoint, updateSpec.data);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  validate(data) {
    // Could validate against API schema
    return true;
  }
  
  getMetadata() {
    return {
      dataSourceType: 'API',
      baseUrl: this.baseUrl,
      cacheSize: this.cache.size,
      subscriptionCount: this._subscriptions.size,
      capabilities: {
        query: true,
        subscribe: true,
        update: true,
        validate: true,
        queryBuilder: true
      }
    };
  }
  
  // Private helper methods
  
  _fetchFromAPI(endpoint) {
    // Check cache first
    const cacheKey = `GET:${endpoint}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    // Simulate API fetch with mock data
    // In real implementation, would use fetch() or axios
    const mockData = this._getMockData(endpoint);
    
    // Cache the response
    this.cache.set(cacheKey, {
      data: mockData,
      timestamp: Date.now()
    });
    
    return mockData;
  }
  
  _postToAPI(endpoint, data) {
    // Simulate API POST/PUT
    // In real implementation, would use fetch() or axios
    return Promise.resolve({ ...data, id: Date.now() });
  }
  
  _getMockData(endpoint) {
    // Mock API responses for demonstration
    const mockDatabase = {
      '/users': [
        { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', active: true },
        { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user', active: true },
        { id: 3, name: 'Carol', email: 'carol@example.com', role: 'moderator', active: false },
        { id: 4, name: 'Dave', email: 'dave@example.com', role: 'user', active: true },
        { id: 5, name: 'Eve', email: 'eve@example.com', role: 'admin', active: true }
      ],
      '/projects': [
        { id: 101, title: 'Website Redesign', status: 'in_progress', priority: 'high', assigneeId: 1 },
        { id: 102, title: 'Mobile App', status: 'planning', priority: 'medium', assigneeId: 2 },
        { id: 103, title: 'API Integration', status: 'completed', priority: 'low', assigneeId: 1 },
        { id: 104, title: 'Database Migration', status: 'in_progress', priority: 'high', assigneeId: 3 }
      ],
      '/tasks': [
        { id: 1001, projectId: 101, title: 'Update homepage', completed: false, assigneeId: 1 },
        { id: 1002, projectId: 101, title: 'Fix navigation', completed: true, assigneeId: 2 },
        { id: 1003, projectId: 102, title: 'Design mockups', completed: false, assigneeId: 2 },
        { id: 1004, projectId: 103, title: 'Write tests', completed: true, assigneeId: 1 }
      ]
    };
    
    return mockDatabase[endpoint] || [];
  }
}

/**
 * Example usage showing how API data can be queried locally
 */
export function exampleAPIUsage() {
  // Create an API-backed ResourceManager
  const apiManager = new APIResourceManager('https://api.example.com', {
    cacheTimeout: 30000 // 30 second cache
  });
  
  // Create CollectionProxy for users from API
  const users = new CollectionProxy(apiManager, {
    collection: 'users'
  });
  
  // The API returns all users, but we can filter/sort locally
  // This reduces API calls and provides rich query capabilities
  
  console.log('\n=== API ResourceManager Examples ===\n');
  
  // Example 1: Filter API data locally
  const activeAdmins = users
    .where(user => user.active === true)
    .where(user => user.role === 'admin')
    .select(user => ({ name: user.name, email: user.email }))
    .toArray();
  
  console.log('Active admins:', activeAdmins);
  // Output: [{ name: 'Alice', email: 'alice@example.com' }, { name: 'Eve', email: 'eve@example.com' }]
  
  // Example 2: Complex query on cached API data
  const projects = new CollectionProxy(apiManager, {
    collection: 'projects'
  });
  
  const highPriorityProjects = projects
    .where(project => project.priority === 'high')
    .where(project => project.status === 'in_progress')
    .orderBy('title', 'asc')
    .toArray();
  
  console.log('High priority in-progress projects:', highPriorityProjects);
  
  // Example 3: Join data from multiple API endpoints locally
  const tasks = new CollectionProxy(apiManager, {
    collection: 'tasks'
  });
  
  // Join tasks with projects (client-side join of API data)
  const tasksWithProjects = tasks
    .where(task => !task.completed)
    .join(projects, (task, project) => task.projectId === project.id)
    .select(joined => ({
      task: joined.title,
      project: joined.title,
      priority: joined.priority
    }))
    .toArray();
  
  console.log('Incomplete tasks with project info:', tasksWithProjects);
  
  // Example 4: Aggregation on API data
  const userStats = users
    .groupBy('role')
    .toArray();
  
  console.log('Users by role:', userStats);
  
  // Example 5: Get single entity
  const firstActiveUser = users
    .where(user => user.active === true)
    .orderBy('name', 'asc')
    .first();
  
  console.log('First active user:', firstActiveUser);
  
  return apiManager;
}