# AI Agent WebApp Testing with Legion Log Capture

## Overview

Legion provides a comprehensive system for AI agents to automatically test web applications with full observability through frontend log capture, backend processing, and semantic analysis. This guide explains how an agent would set up and use this system for live testing.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AI Agent                              │
│  (Orchestrates testing, analyzes results, fixes issues)     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Test Harness                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Node Server  │  │   Browser    │  │ Aiur Backend │     │
│  │   (Target)   │◄─┤  Automation  │  │  (Log Proc)  │     │
│  └──────┬───────┘  └──────────────┘  └──────▲───────┘     │
│         │                                     │              │
│         ▼                                     │              │
│  ┌──────────────────────────────────────────┐│              │
│  │         Injected HTML Page               ││              │
│  │  ┌────────────────────────────────────┐  ││              │
│  │  │   Legion Frontend Logger           │──┘│              │
│  │  │  (Auto-captures all logs/errors)   │   │              │
│  │  └────────────────────────────────────┘   │              │
│  └────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Semantic Search & Analysis                      │
│         (Pattern detection, error correlation)               │
└─────────────────────────────────────────────────────────────┘
```

## Setup Process

### 1. Create the Target Web Application

The agent first creates a simple Node.js server with the webapp to test:

```javascript
// test-webapp/server.js
import express from 'express';
import { addLegionLogging } from '@legion/tools';

const app = express();

// Add Legion logging middleware - this is the key!
addLegionLogging(app, {
  wsUrl: 'ws://localhost:8080/ws',
  enableInDevelopment: true,
  loggerConfig: {
    batchSize: 10,        // Send logs more frequently for testing
    batchInterval: 2000,  // 2 second batches
    enableConsoleCapture: true,
    enableErrorCapture: true,
    enablePerformanceCapture: true
  }
});

// Serve the webapp
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test WebApp</title>
    </head>
    <body>
      <h1>Calculator App</h1>
      <input id="num1" type="number" />
      <input id="num2" type="number" />
      <button onclick="calculate()">Calculate</button>
      <div id="result"></div>
      
      <script>
        function calculate() {
          const num1 = parseFloat(document.getElementById('num1').value);
          const num2 = parseFloat(document.getElementById('num2').value);
          
          console.log('Calculating:', num1, '+', num2);
          
          // Intentional bug for testing
          if (num2 === 0) {
            throw new Error('Division by zero!');
          }
          
          const result = num1 / num2;  // Bug: should be addition
          document.getElementById('result').innerText = result;
          console.log('Result:', result);
        }
      </script>
    </body>
    </html>
  `);
});

app.listen(3000, () => {
  console.log('Test webapp running on http://localhost:3000');
});
```

### 2. Start the Aiur Backend

The agent ensures the Aiur backend is running to process logs:

```bash
# Start Aiur server with log processing
cd packages/aiur
npm run dev
```

This starts:
- WebSocket server on `ws://localhost:8080/ws`
- LogCaptureAgent for processing frontend logs
- Semantic search integration for pattern analysis
- BT-based workflow execution for log analysis

### 3. Launch Browser Automation

The agent uses Playwright or Puppeteer to interact with the webapp:

```javascript
// test-runner.js
import { chromium } from 'playwright';

class WebAppTestRunner {
  async runTest() {
    // Launch browser
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    // Navigate to test app
    await page.goto('http://localhost:3000');
    
    // Wait for Legion logger to initialize
    await page.waitForFunction(() => 
      window.LegionLogger && window.LegionLogger.getStatus().connected
    );
    
    // Run test interactions
    await page.fill('#num1', '10');
    await page.fill('#num2', '0');  // Will trigger error
    await page.click('button');
    
    // Wait for logs to be processed
    await page.waitForTimeout(3000);
    
    // Check for errors in Aiur
    const errors = await this.checkProcessedErrors();
    
    return { success: errors.length === 0, errors };
  }
}
```

## How Log Capture Works

### Frontend Capture

When the page loads, the injected Legion logger automatically:

1. **Hooks Console Methods**
   ```javascript
   // Captures: console.log, console.error, console.warn, etc.
   console.log('User clicked button', { action: 'calculate' });
   // → Sent to backend as structured log entry
   ```

2. **Captures JavaScript Errors**
   ```javascript
   // Window errors
   window.addEventListener('error', (event) => {
     // Automatically captured with stack trace
   });
   
   // Promise rejections
   window.addEventListener('unhandledrejection', (event) => {
     // Automatically captured with reason
   });
   ```

3. **Tracks Performance Metrics**
   ```javascript
   // Navigation timing
   const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
   
   // Resource timing
   performance.getEntriesByType('resource').forEach(resource => {
     // Tracks load times for scripts, styles, images
   });
   ```

4. **Batches and Sends via WebSocket**
   ```javascript
   {
     type: 'log_batch',
     batchId: 'batch-1234',
     entries: [
       {
         type: 'console_log',
         level: 'error',
         messages: ['Division by zero!'],
         timestamp: 1234567890,
         stackTrace: '...',
         url: 'http://localhost:3000'
       }
     ]
   }
   ```

### Backend Processing

The LogCaptureAgent processes logs using a Behavior Tree workflow:

```yaml
log_capture_workflow:
  type: sequence
  children:
    - validate_log_batch      # Ensure valid structure
    - process_log_entries     # Standardize entries
    - parallel:
        - analyze_errors      # Detect error patterns
        - analyze_performance # Check for slow operations
        - detect_patterns     # Find recurring issues
    - forward_to_semantic_search  # Send to AI analysis
    - generate_alerts        # Create alerts for critical issues
```

### Analysis Results

The agent receives structured analysis:

```javascript
{
  errorAnalysis: {
    errorCount: 1,
    errorTypes: {
      'Error': 1
    },
    criticalErrors: [{
      message: 'Division by zero!',
      stackTrace: '...',
      url: 'http://localhost:3000'
    }],
    errorRate: 0.25  // 25% of logs are errors
  },
  
  performanceAnalysis: {
    averageLoadTime: 234,  // ms
    issues: [{
      type: 'slow_page_load',
      time: 5234,
      url: 'http://localhost:3000'
    }]
  },
  
  patternAnalysis: {
    repeatingErrors: [{
      pattern: 'Error:Division by zero',
      count: 3
    }],
    timePatterns: {
      '14': 45,  // Most errors at 2 PM
    }
  },
  
  alerts: [{
    type: 'critical_errors',
    severity: 'critical',
    message: '1 critical errors detected',
    data: [...]
  }]
}
```

## Agent Workflow for Testing

### 1. Setup Phase
```javascript
async function setupTestEnvironment() {
  // 1. Start Aiur backend
  await startAiurServer();
  
  // 2. Create test webapp with Legion injection
  await createTestWebApp({
    features: ['calculator', 'form-validation', 'api-calls']
  });
  
  // 3. Start webapp server
  await startWebAppServer(3000);
  
  // 4. Verify Legion connection
  await verifyLogCaptureConnection();
}
```

### 2. Test Execution Phase
```javascript
async function executeTests() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate and wait for logger
  await page.goto('http://localhost:3000');
  await page.waitForFunction(() => window.LegionLogger?.getStatus().connected);
  
  // Run test scenarios
  const scenarios = [
    { action: 'valid_calculation', inputs: [5, 3] },
    { action: 'division_by_zero', inputs: [10, 0] },
    { action: 'invalid_input', inputs: ['abc', 'def'] },
    { action: 'performance_test', inputs: generateLargeDataset() }
  ];
  
  for (const scenario of scenarios) {
    await runScenario(page, scenario);
    await waitForLogProcessing(2000);
  }
  
  return await collectResults();
}
```

### 3. Analysis Phase
```javascript
async function analyzeResults() {
  // Query Aiur for processed logs
  const analysis = await queryAiurAnalysis();
  
  // Use semantic search to find patterns
  const patterns = await semanticSearch.query({
    query: 'error patterns in calculator function',
    sessionId: testSessionId
  });
  
  // Generate fix recommendations
  const recommendations = await generateRecommendations(analysis, patterns);
  
  return {
    errors: analysis.errorAnalysis,
    performance: analysis.performanceAnalysis,
    patterns: patterns,
    recommendations: recommendations
  };
}
```

### 4. Auto-Fix Phase
```javascript
async function autoFixIssues(analysis) {
  for (const error of analysis.criticalErrors) {
    if (error.message.includes('Division by zero')) {
      // Fix the code
      await fixCode({
        file: 'server.js',
        line: findErrorLine(error.stackTrace),
        fix: 'Add zero check before division'
      });
    }
  }
  
  // Re-run tests to verify fixes
  const verifyResults = await executeTests();
  return verifyResults.errors.length === 0;
}
```

## Advanced Features

### 1. Real-time Monitoring
```javascript
// Agent can subscribe to real-time log updates
const ws = new WebSocket('ws://localhost:8080/ws');
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'frontend_alert') {
    // Immediate response to critical errors
    handleCriticalAlert(msg.alert);
  }
});
```

### 2. Pattern Learning
```javascript
// Use semantic search to learn from past errors
async function learnErrorPatterns() {
  const historicalErrors = await semanticSearch.query({
    query: 'all JavaScript errors in last 24 hours',
    filters: { type: 'frontend_error' }
  });
  
  // Train pattern recognition
  const patterns = extractPatterns(historicalErrors);
  
  // Apply to current testing
  return patterns;
}
```

### 3. Performance Regression Detection
```javascript
// Compare current performance with baseline
async function detectPerformanceRegression() {
  const currentMetrics = await getCurrentPerformanceMetrics();
  const baseline = await getBaselineMetrics();
  
  const regressions = [];
  for (const [metric, value] of Object.entries(currentMetrics)) {
    if (value > baseline[metric] * 1.1) {  // 10% regression threshold
      regressions.push({
        metric,
        current: value,
        baseline: baseline[metric],
        regression: ((value - baseline[metric]) / baseline[metric] * 100).toFixed(1) + '%'
      });
    }
  }
  
  return regressions;
}
```

## Benefits for AI Agents

1. **Complete Observability**: Every console log, error, and performance metric is captured automatically
2. **No Code Changes Required**: Just add the middleware to any Express app
3. **Real-time Analysis**: Logs are processed as they arrive using BT workflows
4. **Pattern Detection**: Semantic search identifies recurring issues across sessions
5. **Actionable Insights**: Analysis provides specific error locations and fix recommendations
6. **Continuous Testing**: Can run in background monitoring production apps
7. **Learning System**: Builds knowledge base of errors and solutions over time

## Example Test Report

```markdown
## WebApp Test Report

**Session ID**: test-1234567890
**Duration**: 45 seconds
**Pages Tested**: 3

### Errors Detected
- ❌ **Critical Error**: Division by zero at line 15
  - Occurrences: 3
  - Pattern: Happens when second input is 0
  - Suggested Fix: Add validation `if (num2 === 0) return 'Cannot divide by zero';`

### Performance Issues
- ⚠️ **Slow Page Load**: 5.2s (threshold: 3s)
  - Cause: Large unminified JavaScript bundle
  - Suggested Fix: Enable minification and compression

### Patterns Identified
- Error rate increases when rapid clicking occurs
- Memory leak detected after 50+ calculations
- Console logs show debugging messages in production

### Recommendations
1. Add input validation for all numeric fields
2. Implement error boundaries for graceful error handling
3. Add performance monitoring for calculation function
4. Remove console.log statements from production build

### Auto-Fix Results
✅ Applied 2 fixes automatically:
- Added zero-check validation
- Removed debug console.log statements

🔄 Re-test Results: All tests passing
```

## Conclusion

This system provides AI agents with a powerful framework for testing web applications with complete visibility into frontend behavior. The automatic log capture, real-time processing, and semantic analysis enable agents to quickly identify issues, understand patterns, and even automatically fix problems - all without requiring any manual instrumentation of the target application.