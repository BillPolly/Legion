/**
 * Query Combinator Examples - Demonstrating universal Handle query projection pattern
 * 
 * Shows how the query combinator system works across different Handle types:
 * - CollectionProxy: Collections of entities
 * - StreamProxy: Continuous query result streams
 * - EntityProxy: Individual entities with relationships
 * - DOMElementProxy: DOM elements as proxies
 * 
 * All examples use the universal Handle projection pattern where:
 * - Each query operation creates a new proxy through DataSource.queryBuilder()
 * - Query builders analyze source Handle type and create appropriate projections
 * - Terminal methods return appropriate Handle types (collections, entities, streams, scalars)
 * - All operations are synchronous following the synchronous dispatcher pattern
 */

import { Handle } from '../src/Handle.js';
import { CollectionProxy } from '../../data-proxies/src/CollectionProxy.js';
import { StreamProxy } from '../../data-proxies/src/StreamProxy.js';
import { EntityProxy } from '../../data-proxies/src/EntityProxy.js';

/**
 * Example 1: Collection Query Combinators
 * 
 * Demonstrates fluent API on collections of entities with different return types
 */
export function collectionQueryExamples() {
  // Assume we have a collection of users
  const users = getCollectionProxy('users');
  
  // FILTERING - Returns new CollectionProxy with filtered entities
  const activeUsers = users.where(user => user.active === true);
  const premiumUsers = users.where(user => user.subscriptionLevel === 'premium');
  
  // CHAINING - Each operation returns new proxy for further chaining
  const activePremiumUsers = users
    .where(user => user.active === true)
    .where(user => user.subscriptionLevel === 'premium')
    .orderBy('lastLoginDate', 'desc')
    .limit(10);
  
  // SELECTION/MAPPING - Transform entities, may return different Handle type
  const userNames = users.select(user => user.name); // Returns StreamProxy of strings
  const userSummaries = users.select(user => ({
    id: user.id,
    name: user.name,
    email: user.email
  })); // Returns CollectionProxy of summary objects
  
  // AGGREGATION - Returns scalar values or aggregate handles
  const userCount = users.count(); // Returns number
  const totalLogins = users.aggregate('sum', 'loginCount'); // Returns number
  const avgAge = users.aggregate('avg', 'age'); // Returns number
  
  // GROUPING - Returns CollectionProxy of grouped entities
  const usersByLevel = users.groupBy('subscriptionLevel'); // Returns CollectionProxy of groups
  const usersByCountry = users.groupBy(user => user.address.country);
  
  // JOINING - Returns CollectionProxy with joined data
  const projects = getCollectionProxy('projects');
  const usersWithProjects = users.join(projects, 'userId'); // Join on userId field
  const usersWithProjectCount = users.join(projects, (user, project) => user.id === project.ownerId);
  
  // TERMINAL OPERATIONS - Execute query and return results
  const firstUser = users.where(u => u.active).first(); // Returns EntityProxy or null
  const lastUser = users.orderBy('createdAt').last(); // Returns EntityProxy or null
  const allUsers = users.toArray(); // Returns Array of entity objects
  
  return {
    activeUsers,
    premiumUsers,
    activePremiumUsers,
    userNames,
    userSummaries,
    userCount,
    totalLogins,
    avgAge,
    usersByLevel,
    usersByCountry,
    usersWithProjects,
    usersWithProjectCount,
    firstUser,
    lastUser,
    allUsers
  };
}

/**
 * Example 2: Stream Query Combinators
 * 
 * Demonstrates query combinators on continuous query result streams
 */
export function streamQueryExamples() {
  // Assume we have a stream of real-time events
  const eventStream = getStreamProxy('events');
  
  // FILTERING - Returns new StreamProxy with filtered events
  const errorEvents = eventStream.where(event => event.level === 'error');
  const criticalEvents = eventStream.where(event => event.severity >= 8);
  
  // TRANSFORMATION - Transform stream data
  const eventSummaries = eventStream.select(event => ({
    timestamp: event.timestamp,
    type: event.type,
    message: event.message
  }));
  
  // WINDOWING - Group events by time windows
  const eventsByMinute = eventStream.groupBy(event => {
    return Math.floor(event.timestamp / 60000) * 60000; // Round to minute
  });
  
  // RATE LIMITING - Limit stream throughput
  const throttledEvents = eventStream.limit(100); // Max 100 events
  const sampledEvents = eventStream.skip(9).take(1); // Take every 10th event
  
  // REAL-TIME AGGREGATION - Continuous aggregation over streams
  const eventCount = errorEvents.count(); // Continuous count of error events
  const avgResponseTime = eventStream
    .where(event => event.type === 'http_request')
    .aggregate('avg', 'responseTime'); // Continuous average
  
  // STREAM JOINING - Join streams in real-time
  const userActivityStream = getStreamProxy('user_activity');
  const correlatedEvents = eventStream.join(userActivityStream, (event, activity) => 
    event.userId === activity.userId && 
    Math.abs(event.timestamp - activity.timestamp) < 5000 // Within 5 seconds
  );
  
  // TERMINAL OPERATIONS on streams
  const latestEvent = eventStream.first(); // Most recent event as EntityProxy
  const oldestEvent = eventStream.last(); // Oldest event as EntityProxy
  const allEvents = eventStream.toArray(); // All current events as Array
  
  return {
    errorEvents,
    criticalEvents,
    eventSummaries,
    eventsByMinute,
    throttledEvents,
    sampledEvents,
    eventCount,
    avgResponseTime,
    correlatedEvents,
    latestEvent,
    oldestEvent,
    allEvents
  };
}

/**
 * Example 3: Entity Relationship Navigation
 * 
 * Demonstrates query combinators for navigating entity relationships
 */
export function entityRelationshipExamples() {
  // Assume we have a user entity with relationships
  const user = getEntityProxy('users', 12345);
  
  // RELATIONSHIP NAVIGATION - Follow entity references
  const userProjects = user.projects; // Returns CollectionProxy of related projects
  const userProfile = user.profile; // Returns EntityProxy of related profile
  const userAddress = user.address; // Returns EntityProxy of related address
  
  // NESTED FILTERING - Filter through relationships
  const activeProjects = user.projects.where(project => project.status === 'active');
  const recentProjects = user.projects
    .where(project => project.status === 'active')
    .orderBy('lastModified', 'desc')
    .limit(5);
  
  // DEEP RELATIONSHIP CHAINS - Navigate multiple levels
  const projectCollaborators = user.projects
    .select(project => project.collaborators) // Gets all collaborators
    .where(collaborator => collaborator.id !== user.id); // Exclude self
  
  const projectTasks = user.projects
    .where(project => project.status === 'active')
    .select(project => project.tasks)
    .where(task => task.assignedTo === user.id);
  
  // REVERSE RELATIONSHIPS - Find entities that reference this one
  const mentionedInComments = getCollectionProxy('comments')
    .where(comment => comment.mentions.includes(user.id));
  
  const ownedRepositories = getCollectionProxy('repositories')
    .where(repo => repo.ownerId === user.id);
  
  // AGGREGATION ACROSS RELATIONSHIPS
  const totalProjectTasks = user.projects
    .select(project => project.tasks)
    .count(); // Total tasks across all projects
  
  const avgProjectSize = user.projects.aggregate('avg', 'taskCount');
  
  // COMPLEX RELATIONSHIP QUERIES
  const collaboratorNetwork = user.projects
    .select(project => project.collaborators)
    .groupBy('department')
    .select(group => ({
      department: group.key,
      collaborators: group.items,
      count: group.items.length
    }));
  
  return {
    userProjects,
    userProfile,
    userAddress,
    activeProjects,
    recentProjects,
    projectCollaborators,
    projectTasks,
    mentionedInComments,
    ownedRepositories,
    totalProjectTasks,
    avgProjectSize,
    collaboratorNetwork
  };
}

/**
 * Example 4: DOM Element Query Combinators
 * 
 * Demonstrates query combinators on DOM elements (which are also Handle proxies)
 */
export function domElementQueryExamples() {
  // Assume we have DOM element proxies
  const mainContainer = getDOMElementProxy('#main-container');
  
  // ELEMENT SELECTION - Select child elements
  const buttons = mainContainer.where(element => element.tagName === 'BUTTON');
  const activeButtons = buttons.where(button => !button.disabled);
  
  // ATTRIBUTE FILTERING
  const requiredInputs = mainContainer
    .where(element => element.tagName === 'INPUT')
    .where(input => input.hasAttribute('required'));
  
  const visibleElements = mainContainer
    .where(element => element.style.display !== 'none')
    .where(element => element.style.visibility !== 'hidden');
  
  // ELEMENT TRANSFORMATION
  const elementData = mainContainer
    .select(element => ({
      tag: element.tagName,
      classes: Array.from(element.classList),
      id: element.id,
      text: element.textContent
    }));
  
  // CSS SELECTOR STYLE QUERIES
  const formElements = mainContainer.where(element => 
    ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(element.tagName)
  );
  
  const errorElements = mainContainer.where(element => 
    element.classList.contains('error')
  );
  
  // HIERARCHY NAVIGATION
  const parentElements = mainContainer.select(element => element.parentElement);
  const childElements = mainContainer.select(element => 
    Array.from(element.children)
  );
  
  // EVENT TARGET ANALYSIS
  const clickableElements = mainContainer.where(element =>
    element.onclick || 
    element.addEventListener || 
    element.hasAttribute('onclick')
  );
  
  // ACCESSIBILITY QUERIES
  const accessibleElements = mainContainer.where(element =>
    element.hasAttribute('aria-label') ||
    element.hasAttribute('aria-labelledby') ||
    element.hasAttribute('title')
  );
  
  // TERMINAL OPERATIONS on DOM
  const firstButton = buttons.first(); // First button as DOMElementProxy
  const allInputValues = formElements
    .where(el => el.tagName === 'INPUT')
    .select(input => input.value)
    .toArray(); // Array of input values
  
  const elementCount = mainContainer.count(); // Total descendant count
  
  return {
    buttons,
    activeButtons,
    requiredInputs,
    visibleElements,
    elementData,
    formElements,
    errorElements,
    parentElements,
    childElements,
    clickableElements,
    accessibleElements,
    firstButton,
    allInputValues,
    elementCount
  };
}

/**
 * Example 5: Cross-Handle Type Queries
 * 
 * Demonstrates queries that span multiple Handle types and resource managers
 */
export function crossHandleTypeExamples() {
  // Different Handle types from different resource managers
  const users = getCollectionProxy('users'); // From DataStore
  const events = getStreamProxy('events'); // From EventStream  
  const domForm = getDOMElementProxy('#user-form'); // From DOM
  
  // CROSS-RESOURCE CORRELATION
  const userActivityCorrelation = users
    .join(events, (user, event) => user.id === event.userId)
    .where(correlation => correlation.event.type === 'login')
    .orderBy(correlation => correlation.event.timestamp, 'desc');
  
  // UI-DATA BINDING QUERIES
  const formUserBinding = users
    .where(user => user.id === getCurrentUserId())
    .first()
    .join(domForm.where(el => el.tagName === 'INPUT'), (user, input) => {
      return input.name in user; // Join on matching field names
    });
  
  // REAL-TIME UI UPDATES
  const liveUserStatus = users
    .where(user => user.isOnline)
    .join(events.where(event => event.type === 'status_change'), 
          (user, event) => user.id === event.userId)
    .select(correlation => ({
      user: correlation.user,
      lastActivity: correlation.event.timestamp,
      status: correlation.event.data.status
    }));
  
  // COMPLEX MULTI-SOURCE AGGREGATION
  const userEngagementMetrics = users
    .select(user => ({
      user: user,
      loginEvents: events
        .where(event => event.type === 'login' && event.userId === user.id)
        .count(),
      formSubmissions: events
        .where(event => event.type === 'form_submit' && event.userId === user.id)
        .count(),
      uiInteractions: events
        .where(event => event.type === 'ui_interaction' && event.userId === user.id)
        .count()
    }))
    .orderBy('loginEvents', 'desc');
  
  return {
    userActivityCorrelation,
    formUserBinding,
    liveUserStatus,
    userEngagementMetrics
  };
}

/**
 * Example 6: Query Builder Return Type Analysis
 * 
 * Demonstrates how query builders determine appropriate return types
 */
export function returnTypeExamples() {
  const users = getCollectionProxy('users');
  
  // COLLECTION OPERATIONS -> CollectionProxy
  const filteredUsers = users.where(u => u.active); // CollectionProxy
  const sortedUsers = users.orderBy('name'); // CollectionProxy
  const limitedUsers = users.limit(10); // CollectionProxy
  
  // TRANSFORMATION OPERATIONS -> Type depends on mapping
  const userNames = users.select(u => u.name); // StreamProxy<string>
  const userObjects = users.select(u => ({ id: u.id, name: u.name })); // CollectionProxy
  const firstUserName = users.select(u => u.name).first(); // string (scalar)
  
  // AGGREGATION OPERATIONS -> Scalar values
  const count = users.count(); // number
  const totalAge = users.aggregate('sum', 'age'); // number
  const avgAge = users.aggregate('avg', 'age'); // number
  const maxAge = users.aggregate('max', 'age'); // number
  
  // GROUPING OPERATIONS -> CollectionProxy of groups
  const groupedUsers = users.groupBy('department'); // CollectionProxy<Group>
  const groupCounts = users.groupBy('department').select(group => ({
    department: group.key,
    count: group.items.length
  })); // CollectionProxy<{department, count}>
  
  // JOIN OPERATIONS -> Type depends on join result
  const projects = getCollectionProxy('projects');
  const userProjects = users.join(projects, 'userId'); // CollectionProxy<UserProject>
  const projectCounts = users
    .join(projects, 'userId')
    .groupBy('userId')
    .select(group => ({
      userId: group.key,
      projectCount: group.items.length
    })); // CollectionProxy<{userId, projectCount}>
  
  // TERMINAL OPERATIONS -> Specific types
  const firstUser = users.first(); // EntityProxy or null
  const lastUser = users.last(); // EntityProxy or null
  const allUsers = users.toArray(); // Array<Object>
  const userArray = users.select(u => u.name).toArray(); // Array<string>
  
  return {
    // Collections
    filteredUsers, // CollectionProxy<User>
    sortedUsers, // CollectionProxy<User>
    limitedUsers, // CollectionProxy<User>
    
    // Transformations
    userNames, // StreamProxy<string>
    userObjects, // CollectionProxy<Object>
    firstUserName, // string
    
    // Aggregations
    count, // number
    totalAge, // number
    avgAge, // number
    maxAge, // number
    
    // Grouping
    groupedUsers, // CollectionProxy<Group>
    groupCounts, // CollectionProxy<Object>
    
    // Joins
    userProjects, // CollectionProxy<UserProject>
    projectCounts, // CollectionProxy<Object>
    
    // Terminals
    firstUser, // EntityProxy | null
    lastUser, // EntityProxy | null
    allUsers, // Array<Object>
    userArray // Array<string>
  };
}

// Helper functions to simulate getting different Handle types
function getCollectionProxy(entityType) {
  // Mock implementation - real code would get from DataSource
  return new CollectionProxy(mockDataSource, {
    find: ['?e'],
    where: [['?e', ':entity/type', entityType]]
  });
}

function getStreamProxy(streamName) {
  // Mock implementation - real code would get from DataSource
  return new StreamProxy(mockDataSource, {
    find: ['?e', '?attr', '?value'],
    where: [['?e', '?attr', '?value']]
  });
}

function getEntityProxy(entityType, entityId) {
  // Mock implementation - real code would get from DataSource
  return new EntityProxy(mockDataSource, entityId);
}

function getDOMElementProxy(selector) {
  // Mock implementation - real code would get from DOM DataSource
  const element = document.querySelector(selector);
  return new DOMElementProxy(mockDOMDataSource, element);
}

function getCurrentUserId() {
  return 12345; // Mock current user ID
}

// Mock DataSource for examples
const mockDataSource = {
  query: () => [],
  subscribe: () => ({ unsubscribe: () => {} }),
  getSchema: () => ({}),
  queryBuilder: (sourceHandle) => ({
    where: () => mockDataSource.queryBuilder(sourceHandle),
    select: () => mockDataSource.queryBuilder(sourceHandle),
    join: () => mockDataSource.queryBuilder(sourceHandle),
    orderBy: () => mockDataSource.queryBuilder(sourceHandle),
    limit: () => mockDataSource.queryBuilder(sourceHandle),
    skip: () => mockDataSource.queryBuilder(sourceHandle),
    groupBy: () => mockDataSource.queryBuilder(sourceHandle),
    aggregate: () => 0,
    first: () => null,
    last: () => null,
    count: () => 0,
    toArray: () => []
  })
};

const mockDOMDataSource = {
  ...mockDataSource,
  // DOM-specific query builder implementation would go here
};

export {
  collectionQueryExamples,
  streamQueryExamples,
  entityRelationshipExamples,
  domElementQueryExamples,
  crossHandleTypeExamples,
  returnTypeExamples
};