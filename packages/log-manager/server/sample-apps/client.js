/**
 * Sample Client Application
 * Simulates a client making requests to the web server with correlation tracking
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:4001';
let requestCounter = 0;
let correlationCounter = 0;

// Structured logging
function log(level, message, metadata = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    client: 'api-client',
    ...metadata
  };
  console.log(JSON.stringify(logEntry));
}

// Make API request
async function makeRequest(method, path, body = null) {
  const requestId = `client-req-${++requestCounter}`;
  const url = `${API_URL}${path}`;
  
  log('info', `[${requestId}] ${method} ${url}`);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-ID': 'sample-client',
      'X-Request-ID': requestId
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    
    const data = await response.json();
    
    if (response.ok) {
      log('info', `[${requestId}] Response ${response.status} (${duration}ms)`, {
        status: response.status,
        duration,
        serverRequestId: data.requestId
      });
    } else {
      log('warn', `[${requestId}] Error response ${response.status} (${duration}ms): ${data.error}`, {
        status: response.status,
        duration,
        error: data.error
      });
    }
    
    return { response, data };
    
  } catch (error) {
    log('error', `[${requestId}] Request failed: ${error.message}`, {
      error: error.message
    });
    throw error;
  }
}

// Simulate user journey
async function simulateUserJourney() {
  const journeyId = `journey-${Date.now()}`;
  const correlationId = ++correlationCounter;
  
  log('info', `[correlation-${correlationId}] Starting user journey ${journeyId}`);
  
  try {
    // Step 1: Check health
    log('debug', `[correlation-${correlationId}] Step 1: Health check`);
    await makeRequest('GET', '/api/health');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Get users list
    log('debug', `[correlation-${correlationId}] Step 2: Fetching users`);
    const { data: usersData } = await makeRequest('GET', '/api/users');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 3: Get specific user
    if (usersData.users && usersData.users.length > 0) {
      const userId = usersData.users[0].id;
      log('debug', `[correlation-${correlationId}] Step 3: Fetching user ${userId}`);
      await makeRequest('GET', `/api/users/${userId}`);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Step 4: Trigger processing
    log('debug', `[correlation-${correlationId}] Step 4: Starting process`);
    await makeRequest('POST', '/api/process', {
      data: { 
        timestamp: new Date(),
        type: 'user-action',
        journeyId 
      },
      correlationId
    });
    
    log('info', `[correlation-${correlationId}] User journey ${journeyId} completed`);
    
  } catch (error) {
    log('error', `[correlation-${correlationId}] User journey ${journeyId} failed: ${error.message}`);
  }
}

// Simulate various client behaviors
async function runClientSimulation() {
  log('info', 'Client simulation started');
  
  // Periodic health checks
  setInterval(async () => {
    try {
      await makeRequest('GET', '/api/health');
    } catch (error) {
      log('warn', 'Health check failed');
    }
  }, 30000);
  
  // User journeys
  while (true) {
    // Random delay between journeys
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 7000));
    
    // Start a new journey
    simulateUserJourney().catch(error => {
      log('error', `Journey failed: ${error.message}`);
    });
    
    // Sometimes make random requests
    if (Math.random() > 0.7) {
      const randomEndpoints = [
        '/api/users',
        '/api/users/1',
        '/api/users/2',
        '/api/users/999', // Will cause 404
        '/api/nonexistent' // Will cause 404
      ];
      
      const endpoint = randomEndpoints[Math.floor(Math.random() * randomEndpoints.length)];
      makeRequest('GET', endpoint).catch(() => {});
    }
  }
}

// Performance monitor
function monitorPerformance() {
  setInterval(() => {
    const stats = {
      requests: requestCounter,
      requestsPerMinute: Math.round(requestCounter / (process.uptime() / 60)),
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    };
    
    log('info', `Client stats - Requests: ${stats.requests}, RPM: ${stats.requestsPerMinute}, Memory: ${stats.memory}MB`);
  }, 20000);
}

// Main
async function main() {
  log('info', `Client application starting (target: ${API_URL})`);
  
  // Wait a bit for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check if server is available
  try {
    await makeRequest('GET', '/api/health');
    log('info', 'Server is available, starting simulation');
  } catch (error) {
    log('error', 'Server is not available, waiting...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Start monitoring
  monitorPerformance();
  
  // Run simulation
  await runClientSimulation();
}

// Handle signals
process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM, shutting down client');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'Received SIGINT, shutting down client');
  process.exit(0);
});

// Start client
main().catch(error => {
  log('error', `Failed to start client: ${error.message}`);
  process.exit(1);
});