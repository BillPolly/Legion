/**
 * Sample Worker Application
 * Simulates background processing with correlation IDs
 */

let taskCounter = 0;
let correlationCounter = 0;

// Structured logging
function log(level, message, metadata = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    worker: 'background-worker',
    ...metadata
  };
  console.log(JSON.stringify(logEntry));
}

// Task processor
async function processTask(taskId, correlationId) {
  log('info', `[trace-${taskId}] Starting task processing${correlationId ? ` [correlation-${correlationId}]` : ''}`);
  
  try {
    // Simulate various processing stages
    const stages = [
      { name: 'data-fetch', duration: 500, failChance: 0.1 },
      { name: 'validation', duration: 200, failChance: 0.05 },
      { name: 'transformation', duration: 300, failChance: 0.08 },
      { name: 'storage', duration: 400, failChance: 0.12 }
    ];
    
    for (const stage of stages) {
      log('debug', `[trace-${taskId}] Executing stage: ${stage.name}`);
      
      await new Promise(resolve => setTimeout(resolve, stage.duration));
      
      if (Math.random() < stage.failChance) {
        throw new Error(`Stage ${stage.name} failed`);
      }
      
      log('debug', `[trace-${taskId}] Stage ${stage.name} completed`);
    }
    
    log('info', `[trace-${taskId}] Task completed successfully`);
    return { success: true, taskId };
    
  } catch (error) {
    log('error', `[trace-${taskId}] Task failed: ${error.message}`, {
      error: error.message
    });
    throw error;
  }
}

// Queue processor
async function processQueue() {
  log('info', 'Queue processor started');
  
  while (true) {
    const hasWork = Math.random() > 0.3; // 70% chance of having work
    
    if (hasWork) {
      const taskId = `task-${++taskCounter}`;
      const correlationId = Math.random() > 0.5 ? `${++correlationCounter}` : null;
      
      try {
        await processTask(taskId, correlationId);
      } catch (error) {
        log('warn', `Task ${taskId} moved to retry queue`);
      }
    } else {
      log('debug', 'Queue empty, waiting...');
    }
    
    // Wait before next iteration
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
  }
}

// Metrics reporter
function reportMetrics() {
  setInterval(() => {
    const metrics = {
      tasksProcessed: taskCounter,
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      cpu: process.cpuUsage()
    };
    
    log('info', `Worker metrics - Tasks: ${metrics.tasksProcessed}, Memory: ${metrics.memory}MB, Uptime: ${metrics.uptime}s`);
  }, 20000);
}

// Health checker
function startHealthCheck() {
  setInterval(() => {
    const health = {
      status: 'healthy',
      tasksPerMinute: Math.round(taskCounter / (process.uptime() / 60))
    };
    
    log('debug', `Health check: ${JSON.stringify(health)}`);
  }, 15000);
}

// Main
async function main() {
  log('info', 'Worker application starting...');
  
  // Start background tasks
  reportMetrics();
  startHealthCheck();
  
  // Start processing
  try {
    await processQueue();
  } catch (error) {
    log('error', `Worker crashed: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Handle signals
process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM, shutting down worker');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'Received SIGINT, shutting down worker');
  process.exit(0);
});

// Unhandled errors
process.on('uncaughtException', (error) => {
  log('error', `Uncaught exception: ${error.message}`, {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', `Unhandled rejection: ${reason}`, {
    reason,
    promise
  });
});

// Start the worker
main().catch(error => {
  log('error', `Failed to start worker: ${error.message}`);
  process.exit(1);
});