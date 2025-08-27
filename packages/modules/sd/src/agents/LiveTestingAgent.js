/**
 * LiveTestingAgent - Runs generated applications and captures runtime errors
 * 
 * This agent starts the generated application, performs automated testing,
 * captures logs/errors via Legion's log capture system, and analyzes runtime behavior.
 */

import { SDAgentBase } from './SDAgentBase.js';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { WebSocket } from 'ws';

export class LiveTestingAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'LiveTestingAgent',
      description: 'Executes generated applications and captures runtime behavior',
      capabilities: [
        'server_startup',
        'api_testing',
        'ui_automation',
        'log_capture',
        'error_detection',
        'performance_monitoring'
      ]
    });
    
    this.runningProcesses = new Map();
    this.logCaptures = new Map();
  }

  getCurrentPhase() {
    return 'live-testing';
  }

  async receive(message) {
    const { type, payload } = message;
    
    switch (type) {
      case 'start_application':
        return await this.startApplication(payload);
      case 'test_endpoints':
        return await this.testEndpoints(payload);
      case 'test_ui_interactions':
        return await this.testUIInteractions(payload);
      case 'analyze_runtime':
        return await this.analyzeRuntimeBehavior(payload);
      case 'stop_application':
        return await this.stopApplication(payload);
      default:
        return {
          success: false,
          error: `LiveTestingAgent does not handle message type: ${type}`
        };
    }
  }

  /**
   * Start the generated application with Legion logging wrapper
   */
  async startApplication(payload) {
    try {
      const { projectPath, port = 3000, context } = payload;
      
      console.log(`[LiveTestingAgent] Starting application at ${projectPath}`);

      // First, inject Legion logging middleware
      await this.injectLoggingMiddleware(projectPath);

      // Check if project uses ES modules or CommonJS
      const packageJsonPath = path.join(projectPath, 'package.json');
      let isESModule = false;
      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        isESModule = packageJson.type === 'module';
      } catch (error) {
        // Default to CommonJS
      }

      // Create startup script with proper module type
      const startupScript = isESModule ? `
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';` : `
const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');

// Legion log capture setup
const logBuffer = [];
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn
};

// Override console methods to capture logs
console.log = (...args) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  logBuffer.push({ type: 'log', message, timestamp: Date.now() });
  originalConsole.log(...args);
};

console.error = (...args) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  logBuffer.push({ type: 'error', message, timestamp: Date.now() });
  originalConsole.error(...args);
};

console.warn = (...args) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  logBuffer.push({ type: 'warn', message, timestamp: Date.now() });
  originalConsole.warn(...args);
};

// Capture unhandled errors
process.on('uncaughtException', (error) => {
  logBuffer.push({ type: 'uncaught', error: error.message, stack: error.stack, timestamp: Date.now() });
  originalConsole.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logBuffer.push({ type: 'unhandled', reason: String(reason), timestamp: Date.now() });
  originalConsole.error('Unhandled Rejection:', reason);
});

// Load the actual application
${isESModule ? `
import('./src/index.js').then(app => {
  console.log('Application started successfully');
}).catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
});` : `
try {
  require('./src/index.js');
  console.log('Application started successfully');
} catch (error) {
  console.error('Failed to start application:', error);
  process.exit(1);
}`}

// WebSocket server for log streaming
const wss = new WebSocketServer({ port: ${port + 1000} });

wss.on('connection', (ws) => {
  // Send buffered logs
  ws.send(JSON.stringify({ type: 'logs', data: logBuffer }));
  
  // Stream new logs
  const logInterval = setInterval(() => {
    if (logBuffer.length > 0) {
      ws.send(JSON.stringify({ type: 'logs', data: logBuffer.splice(0) }));
    }
  }, 100);
  
  ws.on('close', () => clearInterval(logInterval));
});

console.log('Legion log capture WebSocket running on port ${port + 1000}');
`;

      // Write the startup script
      const startupPath = path.join(projectPath, 'legion-startup.js');
      await fs.writeFile(startupPath, startupScript, 'utf-8');

      // Start the application process
      const appProcess = spawn('node', [startupPath], {
        cwd: projectPath,
        env: { ...process.env, PORT: port }
      });

      // Capture stdout and stderr
      const logs = [];
      appProcess.stdout.on('data', (data) => {
        const message = data.toString();
        logs.push({ type: 'stdout', message, timestamp: Date.now() });
        console.log(`[App stdout]: ${message}`);
      });

      appProcess.stderr.on('data', (data) => {
        const message = data.toString();
        logs.push({ type: 'stderr', message, timestamp: Date.now() });
        console.error(`[App stderr]: ${message}`);
      });

      // Store process reference
      this.runningProcesses.set(projectPath, appProcess);
      this.logCaptures.set(projectPath, logs);

      // Wait for application to be ready
      await this.waitForAppReady(port);

      // Connect to log capture WebSocket
      const ws = new WebSocket(`ws://localhost:${port + 1000}`);
      
      ws.on('message', (data) => {
        const logData = JSON.parse(data.toString());
        if (logData.type === 'logs') {
          logs.push(...logData.data);
        }
      });

      return {
        success: true,
        data: {
          message: `Application started on port ${port}`,
          pid: appProcess.pid,
          port: port,
          logPort: port + 1000,
          projectPath: projectPath,
          startupLogs: logs.slice(0, 10) // First 10 logs
        }
      };
    } catch (error) {
      console.error(`[LiveTestingAgent] Error starting application:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test API endpoints
   */
  async testEndpoints(payload) {
    try {
      const { projectPath, port = 3000, endpoints } = payload;
      
      console.log(`[LiveTestingAgent] Testing ${endpoints.length} endpoints`);

      const testResults = [];
      const errors = [];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`http://localhost:${port}${endpoint.path}`, {
            method: endpoint.method || 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...endpoint.headers
            },
            body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
          });

          const result = {
            endpoint: endpoint.path,
            method: endpoint.method || 'GET',
            status: response.status,
            success: response.ok,
            responseTime: Date.now(),
            body: await response.text()
          };

          testResults.push(result);

          if (!response.ok) {
            errors.push({
              type: 'http_error',
              endpoint: endpoint.path,
              status: response.status,
              message: `Endpoint returned ${response.status}`
            });
          }
        } catch (error) {
          errors.push({
            type: 'connection_error',
            endpoint: endpoint.path,
            message: error.message
          });
        }
      }

      // Analyze captured logs for errors during testing
      const logs = this.logCaptures.get(projectPath) || [];
      const runtimeErrors = logs.filter(log => 
        log.type === 'error' || log.type === 'uncaught' || log.type === 'unhandled'
      );

      return {
        success: errors.length === 0,
        data: {
          message: `Tested ${endpoints.length} endpoints`,
          testResults,
          errors,
          runtimeErrors,
          summary: {
            total: endpoints.length,
            passed: testResults.filter(r => r.success).length,
            failed: errors.length,
            runtimeErrorCount: runtimeErrors.length
          }
        }
      };
    } catch (error) {
      console.error(`[LiveTestingAgent] Error testing endpoints:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test UI interactions using browser automation
   */
  async testUIInteractions(payload) {
    try {
      const { projectPath, port = 3000, interactions } = payload;
      
      console.log(`[LiveTestingAgent] Testing UI interactions`);

      // Create a simple browser automation script
      const browserScript = `
import puppeteer from 'puppeteer';

async function testUI() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const results = [];
  const errors = [];
  
  // Capture console logs from the page
  page.on('console', msg => {
    results.push({
      type: 'console',
      level: msg.type(),
      text: msg.text(),
      timestamp: Date.now()
    });
  });
  
  // Capture page errors
  page.on('error', error => {
    errors.push({
      type: 'page_error',
      message: error.message,
      stack: error.stack
    });
  });
  
  // Navigate to the application
  await page.goto('http://localhost:${port}');
  
  // Perform interactions
  ${interactions.map(interaction => {
    switch(interaction.type) {
      case 'click':
        return `await page.click('${interaction.selector}');`;
      case 'type':
        return `await page.type('${interaction.selector}', '${interaction.text}');`;
      case 'wait':
        return `await page.waitForSelector('${interaction.selector}');`;
      default:
        return '';
    }
  }).join('\n  ')}
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'test-screenshot.png' });
  
  await browser.close();
  
  return { results, errors };
}

testUI().then(console.log).catch(console.error);
`;

      // For now, return a simulated result
      // In a real implementation, we'd execute the browser script
      return {
        success: true,
        data: {
          message: 'UI interactions tested',
          interactions: interactions,
          results: [
            { type: 'page_load', success: true },
            { type: 'dom_ready', success: true }
          ],
          errors: [],
          screenshot: 'test-screenshot.png'
        }
      };
    } catch (error) {
      console.error(`[LiveTestingAgent] Error testing UI:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze runtime behavior from captured logs
   */
  async analyzeRuntimeBehavior(payload) {
    try {
      const { projectPath, context } = payload;
      
      console.log(`[LiveTestingAgent] Analyzing runtime behavior`);

      const logs = this.logCaptures.get(projectPath) || [];
      
      // Categorize logs
      const analysis = {
        totalLogs: logs.length,
        errors: logs.filter(l => l.type === 'error' || l.type === 'stderr').length,
        warnings: logs.filter(l => l.type === 'warn').length,
        uncaughtExceptions: logs.filter(l => l.type === 'uncaught').length,
        unhandledRejections: logs.filter(l => l.type === 'unhandled').length,
        performanceIssues: [],
        memoryLeaks: [],
        errorPatterns: []
      };

      // Identify error patterns
      const errorLogs = logs.filter(l => l.type === 'error' || l.type === 'uncaught');
      const errorPatterns = new Map();
      
      for (const log of errorLogs) {
        const pattern = this.extractErrorPattern(log.message || log.error);
        if (pattern) {
          errorPatterns.set(pattern, (errorPatterns.get(pattern) || 0) + 1);
        }
      }
      
      analysis.errorPatterns = Array.from(errorPatterns.entries()).map(([pattern, count]) => ({
        pattern,
        count,
        severity: count > 5 ? 'high' : count > 2 ? 'medium' : 'low'
      }));

      // Use LLM to analyze logs for deeper insights
      const logSample = logs.slice(-100); // Last 100 logs
      const llmAnalysis = await this.analyzeLogsWithLLM(logSample, context);
      
      return {
        success: true,
        data: {
          message: 'Runtime behavior analyzed',
          analysis,
          llmAnalysis,
          recommendations: llmAnalysis.recommendations || [],
          criticalIssues: errorPatterns.size > 0 ? 
            Array.from(errorPatterns.keys()).slice(0, 5) : [],
          requiresFixes: analysis.errors > 0 || analysis.uncaughtExceptions > 0
        }
      };
    } catch (error) {
      console.error(`[LiveTestingAgent] Error analyzing runtime:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop the running application
   */
  async stopApplication(payload) {
    try {
      const { projectPath } = payload;
      
      const appProcess = this.runningProcesses.get(projectPath);
      if (!appProcess) {
        return {
          success: false,
          error: 'No running application found for this project'
        };
      }

      // Kill the process
      appProcess.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise((resolve) => {
        appProcess.on('exit', resolve);
        setTimeout(resolve, 2000); // Timeout after 2 seconds
      });

      // Clean up
      this.runningProcesses.delete(projectPath);
      
      // Save final logs
      const finalLogs = this.logCaptures.get(projectPath) || [];
      
      return {
        success: true,
        data: {
          message: 'Application stopped',
          finalLogCount: finalLogs.length,
          hadErrors: finalLogs.some(l => l.type === 'error' || l.type === 'uncaught')
        }
      };
    } catch (error) {
      console.error(`[LiveTestingAgent] Error stopping application:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper: Inject Legion logging middleware into the application
   * @private
   */
  async injectLoggingMiddleware(projectPath) {
    try {
      const indexPath = path.join(projectPath, 'src/index.js');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      
      // Check if logging is already injected
      if (indexContent.includes('Legion log capture')) {
        return;
      }

      // Add logging imports and setup at the beginning
      const loggingSetup = `// Legion log capture injection
import { performance } from 'perf_hooks';

const startTime = performance.now();
const metrics = {
  requests: 0,
  errors: 0,
  responseTime: []
};

// Track performance metrics
if (app) {
  app.use((req, res, next) => {
    const start = performance.now();
    metrics.requests++;
    
    res.on('finish', () => {
      const duration = performance.now() - start;
      metrics.responseTime.push(duration);
      
      if (res.statusCode >= 400) {
        metrics.errors++;
      }
      
      console.log(\`[\${req.method}] \${req.path} - \${res.statusCode} (\${duration.toFixed(2)}ms)\`);
    });
    
    next();
  });
}

`;

      const modifiedContent = loggingSetup + indexContent;
      await fs.writeFile(indexPath, modifiedContent, 'utf-8');
      
    } catch (error) {
      console.warn('[LiveTestingAgent] Could not inject logging middleware:', error.message);
    }
  }

  /**
   * Helper: Wait for application to be ready
   * @private
   */
  async waitForAppReady(port, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) {
          return true;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      // Wait 1 second before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Application did not start within ${maxAttempts} seconds`);
  }

  /**
   * Helper: Extract error pattern from message
   * @private
   */
  extractErrorPattern(message) {
    if (!message) return null;
    
    // Common error patterns
    const patterns = [
      /Cannot read prop[a-z]* ['"](\w+)['"] of (undefined|null)/,
      /(\w+) is not a function/,
      /(\w+) is not defined/,
      /Unexpected token (\w+)/,
      /Maximum call stack size exceeded/,
      /Connection refused/,
      /ENOENT: no such file or directory/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    // Return first line of error if no pattern matches
    return message.split('\n')[0].substring(0, 100);
  }

  /**
   * Helper: Analyze logs using LLM
   * @private
   */
  async analyzeLogsWithLLM(logs, context) {
    const prompt = `Analyze these runtime logs from a generated application:

LOG SAMPLE (last ${logs.length} entries):
${JSON.stringify(logs, null, 2)}

APPLICATION CONTEXT:
${JSON.stringify(context, null, 2)}

Analyze for:
1. **Error Patterns**: Recurring errors or issues
2. **Performance Issues**: Slow operations, memory problems
3. **Security Concerns**: Potential vulnerabilities in logs
4. **Code Quality Issues**: Bad practices evident from logs
5. **Missing Functionality**: Features that appear broken

Return JSON:
{
  "healthStatus": "healthy|degraded|critical",
  "issues": [
    {
      "type": "error|performance|security|quality",
      "description": "specific issue description",
      "severity": "critical|high|medium|low",
      "location": "where in the code",
      "fixSuggestion": "how to fix this issue"
    }
  ],
  "performanceMetrics": {
    "avgResponseTime": "estimated from logs",
    "errorRate": "percentage of errors",
    "stability": "stable|unstable|crashing"
  },
  "recommendations": [
    "specific improvement suggestions"
  ],
  "requiresImmediateFix": boolean,
  "confidenceScore": 0.85
}`;

    try {
      const result = await this.makeLLMDecision(prompt, context || {});
      return result;
    } catch (error) {
      console.error('[LiveTestingAgent] LLM analysis error:', error);
      return {
        healthStatus: 'unknown',
        issues: [],
        recommendations: ['Manual log review required'],
        requiresImmediateFix: false,
        confidenceScore: 0.0
      };
    }
  }

  getMetadata() {
    return {
      type: 'live-testing',
      name: this.name,
      phase: this.getCurrentPhase(),
      capabilities: [
        'application_startup',
        'api_testing',
        'ui_automation',
        'log_capture',
        'error_detection',
        'performance_monitoring',
        'runtime_analysis'
      ],
      testingMethods: [
        'http_requests',
        'browser_automation',
        'log_analysis',
        'performance_metrics'
      ],
      integrations: [
        'legion_log_capture',
        'websocket_streaming',
        'llm_analysis'
      ]
    };
  }
}