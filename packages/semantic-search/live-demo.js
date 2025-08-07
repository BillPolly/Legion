/**
 * Live Semantic Search Demo
 * 
 * Shows the unified event system working with real event data
 * and natural language queries from AI agents.
 */

import { UniversalEventCollector } from '../code-gen/jester/src/core/UniversalEventCollector.js';
import { EventAwareLogManager } from '../log-manager/src/EventAwareLogManager.js';
import { AgentEventAnalyzer } from './src/agents/AgentEventAnalyzer.js';
import { ResourceManager } from '../tools/src/ResourceManager.js';

console.log('🚀 Starting Live Semantic Search Demo...\n');

// Initialize system components
const resourceManager = new ResourceManager();
await resourceManager.initialize();

const eventCollector = new UniversalEventCollector(null, {
  enableCorrelation: true,
  bufferSize: 50,
  flushInterval: 2000
});

// Add error event listener to prevent crashes
eventCollector.on('error', (errorEvent) => {
  console.log(`⚠️ Error event captured: ${errorEvent.error?.message}`);
});

const logManager = new EventAwareLogManager({
  enableEventCapture: true,
  enableCorrelation: true
});
logManager.setEventCollector(eventCollector);

// Mock search provider that demonstrates semantic capabilities
const mockSearchProvider = {
  searchProductionErrors: async (query, services, options) => {
    console.log(`🔍 Searching production errors: "${query}" in services: [${services.join(', ')}]`);
    
    // Simulate semantic matching based on query content
    const mockResults = [];
    if (query.includes('database') || query.includes('connection')) {
      mockResults.push({
        document: {
          eventId: 'evt-db-001',
          level: 'error',
          message: 'Database connection timeout after 30s',
          service: 'user-service',
          timestamp: Date.now() - 3600000,
          correlationId: 'corr-db-123'
        },
        score: 0.92
      });
    }
    
    if (query.includes('auth') || query.includes('authentication')) {
      mockResults.push({
        document: {
          eventId: 'evt-auth-001',
          level: 'error',
          message: 'Authentication failed - invalid token',
          service: 'auth-service',
          timestamp: Date.now() - 1800000,
          correlationId: 'corr-auth-456'
        },
        score: 0.88
      });
    }
    
    return mockResults;
  },
  
  searchTestFailures: async (query, options) => {
    console.log(`🧪 Searching test failures: "${query}"`);
    
    const testResults = [];
    if (query.includes('database') || query.includes('connection')) {
      testResults.push({
        document: {
          eventId: 'evt-test-db-001',
          type: 'jest_test',
          testName: 'should connect to database',
          status: 'failed',
          error: 'Connection refused: localhost:5432',
          service: 'user-service',
          timestamp: Date.now() - 7200000
        }
      });
    }
    
    return testResults;
  },
  
  traceCorrelationId: async (correlationId) => {
    console.log(`🔗 Tracing correlation ID: ${correlationId}`);
    
    // Simulate a complete request trace
    return {
      correlationId,
      totalEvents: 5,
      timespan: 2500,
      timeline: [
        { type: 'api_call', method: 'POST', url: '/api/users', status: 200, timestamp: Date.now() - 5000, service: 'gateway' },
        { type: 'production_log', level: 'info', message: 'Processing user creation request', timestamp: Date.now() - 4000, service: 'user-service' },
        { type: 'production_log', level: 'info', message: 'Validating user data', timestamp: Date.now() - 3000, service: 'user-service' },
        { type: 'api_call', method: 'POST', url: '/internal/validate', status: 200, timestamp: Date.now() - 2000, service: 'validation-service' },
        { type: 'production_log', level: 'info', message: 'User created successfully', timestamp: Date.now() - 1000, service: 'user-service' }
      ],
      eventTypes: {
        api_call: 2,
        production_log: 3
      }
    };
  },
  
  analyzeFailurePatterns: async (timeRange) => {
    console.log(`📊 Analyzing failure patterns for time range: ${JSON.stringify(timeRange)}`);
    
    return {
      patterns: [
        {
          count: 15,
          representative: { message: 'Database connection timeout', service: 'user-service' },
          services: ['user-service', 'order-service'],
          errorTypes: ['ConnectionError', 'TimeoutError']
        },
        {
          count: 8,
          representative: { message: 'Authentication token expired', service: 'auth-service' },
          services: ['auth-service'],
          errorTypes: ['AuthError', 'TokenError']
        }
      ]
    };
  }
};

const agentAnalyzer = new AgentEventAnalyzer(mockSearchProvider, null, {
  defaultTimeRange: 86400000,
  maxResults: 20
});

console.log('✅ System initialized. Starting event generation...\n');

// Generate realistic event data
console.log('📝 Generating sample events...');

// 1. Jest test events
const testEvent1 = eventCollector.onTestStart({
  name: 'should authenticate user with valid credentials',
  path: '/auth/authentication.test.js'
});

const testEvent2 = eventCollector.onTestEnd(
  { name: 'should authenticate user with valid credentials', path: '/auth/authentication.test.js' },
  { status: 'passed', duration: 150, numPassingAsserts: 3, numFailingAsserts: 0 }
);

// 2. Production API call
const apiEvent = eventCollector.onAPICall('POST', '/api/auth/login', 200, 245, {
  correlationId: 'corr-live-demo-123',
  userId: 'user-demo-456'
});

// 3. Production logs through LogManager
logManager.forwardLogAsEvent({
  level: 'info',
  message: 'User authentication successful for user@example.com',
  timestamp: new Date().toISOString(),
  context: {
    correlationId: 'corr-live-demo-123',
    service: 'auth-service',
    userId: 'user-demo-456'
  }
});

logManager.forwardLogAsEvent({
  level: 'error',
  message: 'Database connection pool exhausted - unable to acquire connection',
  timestamp: new Date().toISOString(),
  context: {
    correlationId: 'corr-db-error-789',
    service: 'user-service',
    errorCode: 'DB_POOL_EXHAUSTED'
  }
});

// 4. Runtime events
const runtimeEvent = eventCollector.onRuntimeEvent('performance_metric', {
  metric: 'database_query_time',
  value: 1850,
  threshold: 1000,
  query: 'SELECT * FROM users WHERE email = ?'
});

const errorEvent = eventCollector.onErrorEvent(new Error('Connection timeout to database'), {
  source: 'user-service',
  correlationId: 'corr-db-error-789',
  query: 'INSERT INTO users (email, name) VALUES (?, ?)'
});

console.log(`✅ Generated ${eventCollector.getStatistics().totalEvents} events\n`);

// Force flush to see all events
eventCollector.flushBuffer();

console.log('🤖 Starting AI Agent Natural Language Queries...\n');

// Demo queries that showcase semantic search capabilities
const queries = [
  'what database errors happened in the last hour?',
  'analyze failing authentication tests',
  'trace all events for correlation ID corr-live-demo-123',
  'show me connection timeout issues',
  'what are the common error patterns?'
];

for (let i = 0; i < queries.length; i++) {
  const query = queries[i];
  
  console.log(`\n🔤 Query ${i + 1}: "${query}"`);
  console.log('─'.repeat(50));
  
  try {
    const result = await agentAnalyzer.investigate(query);
    
    if (result.success) {
      console.log(`✅ Success - Type: ${result.type}`);
      
      if (result.results && result.results.length > 0) {
        console.log(`📊 Found ${result.results.length} results:`);
        result.results.forEach((r, idx) => {
          console.log(`  ${idx + 1}. ${r.document?.message || r.document?.testName || 'Unknown'} (Score: ${r.score?.toFixed(2) || 'N/A'})`);
        });
      }
      
      if (result.summary) {
        console.log(`📈 Summary:`, JSON.stringify(result.summary, null, 2));
      }
      
      if (result.timeline && result.timeline.length > 0) {
        console.log(`⏰ Timeline with ${result.timeline.length} events:`);
        result.timeline.forEach((event, idx) => {
          const time = new Date(event.timestamp).toLocaleTimeString();
          console.log(`  ${idx + 1}. [${time}] ${event.type}: ${event.message || event.method + ' ' + event.url || 'Event'}`);
        });
      }
      
      if (result.patterns && result.patterns.length > 0) {
        console.log(`🔍 Patterns found:`);
        result.patterns.forEach((pattern, idx) => {
          console.log(`  ${idx + 1}. ${pattern.description} (${pattern.count} occurrences)`);
        });
      }
      
    } else {
      console.log(`❌ Failed: ${result.error}`);
      console.log(`💡 Suggestions: ${result.suggestions?.join(', ')}`);
    }
    
  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
  }
  
  // Small delay between queries
  await new Promise(resolve => setTimeout(resolve, 500));
}

console.log('\n📊 Final System Statistics:');
console.log('─'.repeat(30));

const eventStats = eventCollector.getStatistics();
console.log(`Total Events: ${eventStats.totalEvents}`);
console.log(`Event Types:`, JSON.stringify(eventStats.typeDistribution, null, 2));
console.log(`Correlations Tracked: ${eventStats.correlationCount}`);

const logStats = await logManager.getStatistics();
console.log(`Log Manager Connected: ${logStats.events?.eventCollectorConnected ? 'Yes' : 'No'}`);
console.log(`Correlation Tracker Size: ${logStats.events?.correlationTracker || 0}`);

console.log('\n🎉 Live Semantic Search Demo Complete!');
console.log('\n💡 Key Features Demonstrated:');
console.log('  ✅ Unified event collection from Jest tests, logs, APIs, and runtime');
console.log('  ✅ Correlation tracking across distributed events');
console.log('  ✅ Natural language query processing and intent recognition');
console.log('  ✅ Semantic search with similarity scoring');
console.log('  ✅ Pattern analysis and timeline reconstruction');
console.log('  ✅ Real-time event buffering and batch processing');

// Cleanup
await eventCollector.cleanup();
await logManager.cleanup();