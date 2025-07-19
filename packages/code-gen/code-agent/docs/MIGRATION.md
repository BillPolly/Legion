# Migration Guide: From Mocked to Real Testing

## Overview

This guide helps you migrate from the base CodeAgent (with mocked testing) to the EnhancedCodeAgent (with real runtime testing). The enhanced version provides actual test execution, browser testing, and comprehensive log analysis.

## Table of Contents

1. [Key Differences](#key-differences)
2. [Migration Steps](#migration-steps)
3. [Configuration Changes](#configuration-changes)
4. [API Changes](#api-changes)
5. [Feature Comparison](#feature-comparison)
6. [Common Migration Scenarios](#common-migration-scenarios)
7. [Troubleshooting](#troubleshooting)

## Key Differences

### Base CodeAgent (Mocked)
- Simulates test execution
- No real server startup
- No browser testing
- Limited log analysis
- Faster execution
- No external dependencies

### EnhancedCodeAgent (Real)
- Executes actual tests
- Starts real servers
- Full browser automation
- Comprehensive log analysis
- Slower but accurate
- Requires runtime dependencies

## Migration Steps

### Step 1: Install Dependencies

```bash
# Install runtime dependencies
npm install @jsenvoy/log-manager @jsenvoy/node-runner @jsenvoy/playwright

# Install peer dependencies
npm install puppeteer jest eslint
```

### Step 2: Update Imports

**Before:**
```javascript
import { CodeAgent } from '@jsenvoy/code-agent';
```

**After:**
```javascript
import { EnhancedCodeAgent } from '@jsenvoy/code-agent';
```

### Step 3: Update Configuration

**Before:**
```javascript
const agent = new CodeAgent({
  projectType: 'fullstack',
  enableConsoleOutput: true,
  testCoverage: {
    threshold: 80
  }
});
```

**After:**
```javascript
const agent = new EnhancedCodeAgent({
  projectType: 'fullstack',
  enableConsoleOutput: true,
  testCoverage: {
    threshold: 80
  },
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: true,
    enableLogAnalysis: true,
    runtimeTimeout: 300000, // 5 minutes
    browserHeadless: true,
    parallelExecution: true
  }
});
```

### Step 4: Update Initialization

**Before:**
```javascript
await agent.initialize('./my-project');
```

**After:**
```javascript
await agent.initialize('./my-project', {
  runtimeConfig: {
    logLevel: 'info',
    captureConsole: true
  },
  healthConfig: {
    checkInterval: 5000,
    thresholds: {
      cpu: 80,
      memory: 85
    }
  }
});
```

### Step 5: Handle New Events

**Add new event handlers:**
```javascript
// Runtime events
agent.on('runtime:log', (event) => {
  console.log(`[Runtime] ${event.message}`);
});

agent.on('runtime:error', (event) => {
  console.error(`[Runtime Error] ${event.message}`);
});

// Health monitoring
agent.healthMonitor.on('warning', (event) => {
  console.warn(`[Health] ${event.metric}: ${event.value}%`);
});

// Test execution
agent.on('test:started', (event) => {
  console.log(`[Test] Starting: ${event.suite}`);
});

agent.on('test:completed', (event) => {
  console.log(`[Test] Completed: ${event.suite} - ${event.passed}/${event.total} passed`);
});
```

## Configuration Changes

### Environment Variables

Add these environment variables for enhanced features:

```bash
# .env file
NODE_ENV=development
LOG_LEVEL=info
BROWSER_HEADLESS=true
PARALLEL_WORKERS=4
TEST_TIMEOUT=120000
```

### Package.json Scripts

Update your scripts for real testing:

```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "lint": "eslint .",
    "build": "node build.js",
    "start": "node server.js"
  }
}
```

## API Changes

### Method Changes

| Base CodeAgent | EnhancedCodeAgent | Notes |
|----------------|-------------------|-------|
| `runQualityChecks()` | `runEnhancedQualityChecks()` | Returns real execution results |
| N/A | `runComprehensiveTesting()` | New method for full test suite |
| N/A | `runEnhancedFixing()` | AI-powered fixing with logs |
| `getProjectSummary()` | `generateEnhancedSummary()` | Includes runtime metrics |

### Return Value Changes

**Base Quality Results:**
```javascript
{
  eslint: {
    passed: true,
    errors: 0,
    warnings: 2
  },
  jest: {
    passed: true,
    coverage: 85
  }
}
```

**Enhanced Quality Results:**
```javascript
{
  eslint: {
    success: true,
    errorCount: 0,
    warningCount: 2,
    results: [...], // Detailed results
    fixableErrorCount: 0,
    fixableWarningCount: 1
  },
  jest: {
    success: true,
    testResults: [...], // Actual test results
    coverage: {
      percentage: 85,
      lines: { total: 500, covered: 425 },
      statements: { total: 600, covered: 510 },
      functions: { total: 50, covered: 45 },
      branches: { total: 100, covered: 80 }
    }
  },
  logs: {
    errors: [...],
    warnings: [...],
    insights: [...]
  }
}
```

## Feature Comparison

| Feature | Base CodeAgent | EnhancedCodeAgent |
|---------|----------------|-------------------|
| Code Generation | ✅ | ✅ |
| Test Generation | ✅ | ✅ |
| ESLint Checking | ✅ Simulated | ✅ Real |
| Jest Testing | ✅ Simulated | ✅ Real |
| Server Testing | ❌ | ✅ |
| Browser Testing | ❌ | ✅ |
| Log Analysis | ❌ | ✅ |
| Performance Monitoring | ❌ | ✅ |
| Visual Regression | ❌ | ✅ |
| Parallel Execution | ❌ | ✅ |

## Common Migration Scenarios

### Scenario 1: Simple Project

**Before:**
```javascript
const agent = new CodeAgent();
await agent.initialize('./simple-app');
const result = await agent.develop({
  projectName: 'Simple App',
  description: 'A basic web app'
});
```

**After:**
```javascript
const agent = new EnhancedCodeAgent({
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: false, // Skip for simple projects
    runtimeTimeout: 60000 // 1 minute for simple projects
  }
});
await agent.initialize('./simple-app');
const result = await agent.develop({
  projectName: 'Simple App',
  description: 'A basic web app'
});
```

### Scenario 2: Complex Full-Stack Application

**Before:**
```javascript
const agent = new CodeAgent({
  projectType: 'fullstack',
  qualityGates: {
    eslintErrors: 0,
    testCoverage: 90
  }
});
```

**After:**
```javascript
const agent = new EnhancedCodeAgent({
  projectType: 'fullstack',
  qualityGates: {
    eslintErrors: 0,
    testCoverage: 90
  },
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: true,
    enableLogAnalysis: true,
    parallelExecution: true,
    runtimeTimeout: 600000, // 10 minutes
    browserConfig: {
      browsers: ['chromium', 'firefox'],
      headless: true,
      viewport: { width: 1920, height: 1080 }
    }
  }
});

// Add resource monitoring
agent.healthMonitor.on('warning', (data) => {
  if (data.metric === 'memory' && data.value > 90) {
    console.warn('High memory usage detected');
    // Optionally trigger cleanup
  }
});
```

### Scenario 3: CI/CD Integration

**Before:**
```javascript
// Simple CI script
const agent = new CodeAgent();
await agent.initialize(process.env.WORKSPACE);
const result = await agent.develop(requirements);
process.exit(result.success ? 0 : 1);
```

**After:**
```javascript
// Enhanced CI script with proper cleanup
const agent = new EnhancedCodeAgent({
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: process.env.CI !== 'true', // Disable in CI
    browserHeadless: true,
    parallelExecution: true
  }
});

try {
  await agent.initialize(process.env.WORKSPACE);
  const result = await agent.develop(requirements);
  
  // Generate reports
  const report = await agent.generateEnhancedSummary();
  await saveReport(report);
  
  process.exit(result.success ? 0 : 1);
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
} finally {
  // Important: Clean up resources
  await agent.cleanup();
}
```

## Troubleshooting

### Issue: Out of Memory Errors

**Solution:**
```bash
# Increase Node.js memory
NODE_OPTIONS='--max-old-space-size=4096' npm run dev

# Or in code
const agent = new EnhancedCodeAgent({
  enhancedConfig: {
    parallelExecution: false, // Reduce memory usage
    performanceConfig: {
      memoryLimit: 2048 // MB
    }
  }
});
```

### Issue: Tests Timeout

**Solution:**
```javascript
const agent = new EnhancedCodeAgent({
  enhancedConfig: {
    runtimeTimeout: 600000, // Increase to 10 minutes
    testConfig: {
      timeout: 120000, // 2 minutes per test
      retries: 2
    }
  }
});
```

### Issue: Browser Tests Fail

**Solution:**
```javascript
const agent = new EnhancedCodeAgent({
  enhancedConfig: {
    browserConfig: {
      headless: false, // Debug visually
      slowMo: 100, // Slow down actions
      devtools: true // Open devtools
    }
  }
});
```

### Issue: Port Conflicts

**Solution:**
```javascript
const agent = new EnhancedCodeAgent({
  enhancedConfig: {
    serverConfig: {
      basePort: 4000, // Change base port
      portRange: 100 // Ports 4000-4100
    }
  }
});
```

## Performance Considerations

### Execution Time

- Base CodeAgent: 1-5 minutes typical
- EnhancedCodeAgent: 5-20 minutes typical

### Resource Usage

- Base CodeAgent: ~500MB RAM
- EnhancedCodeAgent: 2-4GB RAM

### Optimization Tips

1. **Use Parallel Execution**
   ```javascript
   enhancedConfig: {
     parallelExecution: true,
     maxWorkers: os.cpus().length
   }
   ```

2. **Enable Caching**
   ```javascript
   performanceConfig: {
     enableCaching: true,
     cacheSize: 200 // MB
   }
   ```

3. **Selective Testing**
   ```javascript
   // Skip browser tests for backend-only changes
   const testConfig = {
     includeUnit: true,
     includeIntegration: true,
     includeE2E: isFullStack
   };
   ```

## Rollback Strategy

If you need to rollback to mocked testing:

1. Keep both imports available:
   ```javascript
   import { CodeAgent, EnhancedCodeAgent } from '@jsenvoy/code-agent';
   
   const Agent = useEnhanced ? EnhancedCodeAgent : CodeAgent;
   ```

2. Use feature flags:
   ```javascript
   const config = {
     enhancedConfig: process.env.USE_REAL_TESTING ? {
       enableRuntimeTesting: true,
       // ... other enhanced config
     } : undefined
   };
   ```

3. Gradual migration:
   ```javascript
   // Start with just real ESLint
   enhancedConfig: {
     enableRuntimeTesting: true,
     enableBrowserTesting: false,
     enableLogAnalysis: false
   }
   ```

## Next Steps

1. Review the [API Documentation](./API.md)
2. Check out [Examples](../examples)
3. Read about [Performance Optimization](./PERFORMANCE.md)
4. Join our [Community Discord](https://discord.gg/codeagent)

## Support

For migration issues, please:
1. Check the [FAQ](./FAQ.md)
2. Search [existing issues](https://github.com/user/code-agent/issues)
3. Create a new issue with the `migration` label