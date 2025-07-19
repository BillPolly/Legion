# Configuration Guide

## Overview

This guide covers all configuration options for the Code Agent, including basic settings, enhanced features, and advanced customization options.

## Table of Contents

1. [Configuration Structure](#configuration-structure)
2. [Basic Configuration](#basic-configuration)
3. [Enhanced Configuration](#enhanced-configuration)
4. [Runtime Configuration](#runtime-configuration)
5. [Environment Variables](#environment-variables)
6. [Configuration Files](#configuration-files)
7. [Advanced Options](#advanced-options)
8. [Examples](#examples)

## Configuration Structure

The Code Agent uses a hierarchical configuration system:

```
CodeAgent Config
├── Basic Settings
├── Project Settings
├── Quality Gates
├── ESLint Rules
└── Enhanced Config (optional)
    ├── Runtime Settings
    ├── Browser Settings
    ├── Performance Settings
    └── Monitoring Settings
```

## Basic Configuration

### CodeAgent Constructor Options

```javascript
const agent = new CodeAgent({
  // Project type
  projectType: 'fullstack', // 'frontend' | 'backend' | 'fullstack'
  
  // Working directory (set during initialization)
  workingDirectory: null,
  
  // State persistence
  stateFile: '.code-agent-state.json',
  
  // Console output
  enableConsoleOutput: true,
  
  // Test coverage requirements
  testCoverage: {
    threshold: 80,
    branches: 75,
    functions: 80,
    lines: 80,
    statements: 80
  },
  
  // Quality gates
  qualityGates: {
    eslintErrors: 0,
    eslintWarnings: 10,
    testCoverage: 80,
    allTestsPass: true,
    complexityThreshold: 10
  },
  
  // ESLint rules
  eslintRules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': 'error',
    'no-eval': 'error'
  },
  
  // Error handling
  errorConfig: {
    enableLogging: true,
    autoCleanup: true,
    maxRetries: 3,
    retryDelay: 1000
  }
});
```

### Project Types

#### Frontend Configuration
```javascript
{
  projectType: 'frontend',
  eslintRules: {
    // Browser-specific rules
    'no-alert': 'error',
    'no-document-write': 'error'
  },
  testCoverage: {
    threshold: 75 // Lower for UI components
  }
}
```

#### Backend Configuration
```javascript
{
  projectType: 'backend',
  eslintRules: {
    // Node.js specific rules
    'no-process-exit': 'error',
    'handle-callback-err': 'error'
  },
  testCoverage: {
    threshold: 90 // Higher for APIs
  }
}
```

#### Fullstack Configuration
```javascript
{
  projectType: 'fullstack',
  // Combines frontend and backend rules
  // Applies appropriate rules based on file location
}
```

## Enhanced Configuration

### EnhancedCodeAgent Options

```javascript
const agent = new EnhancedCodeAgent({
  // All basic options plus:
  
  enhancedConfig: {
    // Runtime testing
    enableRuntimeTesting: true,
    runtimeTimeout: 300000, // 5 minutes
    
    // Browser testing
    enableBrowserTesting: true,
    browserHeadless: true,
    browserTimeout: 30000,
    
    // Log analysis
    enableLogAnalysis: true,
    logLevel: 'info',
    captureConsole: true,
    
    // Performance monitoring
    enablePerformanceMonitoring: true,
    performanceThresholds: {
      testDuration: 5000,
      memoryUsage: 500 * 1024 * 1024, // 500MB
      cpuUsage: 80
    },
    
    // Parallel execution
    parallelExecution: true,
    maxWorkers: 4,
    
    // Browser configuration
    browserConfig: {
      browsers: ['chromium', 'firefox', 'webkit'],
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      slowMo: 0,
      timeout: 30000
    },
    
    // Server configuration
    serverConfig: {
      startTimeout: 30000,
      healthCheckInterval: 5000,
      healthCheckRetries: 6,
      shutdownTimeout: 10000,
      basePort: 3000,
      portRange: 100
    }
  }
});
```

### Feature Flags

```javascript
{
  enhancedConfig: {
    // Core features
    enableRuntimeTesting: true,
    enableBrowserTesting: true,
    enableLogAnalysis: true,
    enablePerformanceMonitoring: true,
    
    // Advanced features
    enableVisualRegression: false,
    enableAccessibilityTesting: true,
    enableSecurityScanning: true,
    enableDependencyAudit: true,
    
    // Optimization features
    enableCaching: true,
    enableParallelization: true,
    enableIncrementalTesting: false
  }
}
```

## Runtime Configuration

### Initialization Options

```javascript
await agent.initialize('./my-project', {
  // LLM configuration
  llmConfig: {
    provider: 'openai', // 'openai' | 'anthropic' | 'mock'
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4000,
    timeout: 60000
  },
  
  // File operations configuration
  fileOpsConfig: {
    encoding: 'utf8',
    createBackups: true,
    validatePaths: true,
    maxFileSize: 10 * 1024 * 1024 // 10MB
  },
  
  // Runtime configuration (Enhanced only)
  runtimeConfig: {
    logLevel: 'debug', // 'error' | 'warn' | 'info' | 'debug'
    logRetention: 86400000, // 24 hours
    captureConsole: true,
    captureStderr: true,
    logFormat: 'json' // 'json' | 'text'
  },
  
  // Health monitoring configuration (Enhanced only)
  healthConfig: {
    enabled: true,
    checkInterval: 5000,
    historySize: 100,
    thresholds: {
      cpu: 80,
      memory: 85,
      disk: 90,
      eventLoop: 100
    },
    alerts: {
      enabled: true,
      cooldown: 300000 // 5 minutes
    }
  },
  
  // Performance configuration (Enhanced only)
  performanceConfig: {
    enableCaching: true,
    cacheSize: 100, // MB
    cacheTTL: 3600000, // 1 hour
    enableParallelization: true,
    maxWorkers: os.cpus().length,
    batchSize: 10,
    memoryLimit: 2048 // MB
  },
  
  // Module configuration
  moduleConfig: {
    autoLoad: true,
    moduleDirectory: './modules',
    allowedModules: ['file', 'web', 'github']
  }
});
```

## Environment Variables

### Core Variables

```bash
# Node environment
NODE_ENV=development|production|test

# Code Agent settings
CODE_AGENT_ENV=development
CODE_AGENT_DEBUG=true
CODE_AGENT_LOG_LEVEL=debug

# LLM providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=...

# Runtime settings
RUNTIME_TIMEOUT=600000
MAX_WORKERS=8
ENABLE_CACHING=true

# Browser testing
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=60000
PLAYWRIGHT_BROWSERS=chromium,firefox

# Performance
MEMORY_LIMIT=4096
CPU_THRESHOLD=90
ENABLE_PROFILING=false

# Security
ENABLE_SECURITY_SCAN=true
SECURITY_SCAN_LEVEL=strict
```

### Loading Environment Variables

```javascript
import dotenv from 'dotenv';

// Load environment-specific config
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

// Create config from environment
const config = {
  projectType: process.env.PROJECT_TYPE || 'fullstack',
  enhancedConfig: {
    enableRuntimeTesting: process.env.ENABLE_RUNTIME_TESTING === 'true',
    runtimeTimeout: parseInt(process.env.RUNTIME_TIMEOUT) || 300000,
    maxWorkers: parseInt(process.env.MAX_WORKERS) || 4
  }
};
```

## Configuration Files

### code-agent.config.js

```javascript
// code-agent.config.js
export default {
  // Project settings
  project: {
    name: 'My Application',
    type: 'fullstack',
    version: '1.0.0'
  },
  
  // Development settings
  development: {
    enableConsoleOutput: true,
    enableMocks: true,
    testCoverage: {
      threshold: 70
    }
  },
  
  // Production settings
  production: {
    enableConsoleOutput: false,
    enableMocks: false,
    testCoverage: {
      threshold: 90
    },
    enhancedConfig: {
      enableRuntimeTesting: true,
      enableSecurityScanning: true
    }
  },
  
  // Custom rules
  eslintRules: {
    // Project-specific rules
  },
  
  // Hooks
  hooks: {
    beforeGenerate: async (context) => {
      console.log('Starting generation...');
    },
    afterGenerate: async (context) => {
      console.log('Generation complete!');
    },
    onError: async (error, context) => {
      console.error('Error occurred:', error);
    }
  }
};
```

### Loading Configuration File

```javascript
import { loadConfig } from '@jsenvoy/code-agent/config';

const config = await loadConfig('./code-agent.config.js');
const agent = new EnhancedCodeAgent(config[process.env.NODE_ENV]);
```

### JSON Configuration

```json
{
  "codeAgent": {
    "projectType": "fullstack",
    "qualityGates": {
      "eslintErrors": 0,
      "testCoverage": 85
    },
    "enhancedConfig": {
      "enableRuntimeTesting": true,
      "browserConfig": {
        "browsers": ["chromium"],
        "headless": true
      }
    }
  }
}
```

## Advanced Options

### Custom Fix Strategies

```javascript
{
  enhancedConfig: {
    fixingStrategies: {
      syntax: {
        enabled: true,
        confidence: 0.9
      },
      logic: {
        enabled: true,
        confidence: 0.8,
        maxIterations: 3
      },
      performance: {
        enabled: true,
        confidence: 0.7,
        techniques: ['memoization', 'caching', 'algorithm']
      },
      custom: {
        enabled: true,
        handler: async (error, context) => {
          // Custom fix logic
          return { fix: '...', confidence: 0.85 };
        }
      }
    }
  }
}
```

### Custom Security Rules

```javascript
{
  securityConfig: {
    enableScanning: true,
    customRules: [
      {
        pattern: /api\.mycompany\.com/,
        severity: 'high',
        message: 'Internal API exposed'
      },
      {
        pattern: /TODO.*security/i,
        severity: 'medium',
        message: 'Security TODO found'
      }
    ],
    ignorePaths: ['test/', 'docs/'],
    secretsWhitelist: ['example-key', 'demo-token']
  }
}
```

### Performance Optimization

```javascript
{
  performanceConfig: {
    // Task optimization
    taskBatching: {
      enabled: true,
      batchSize: 20,
      maxConcurrent: 5
    },
    
    // Caching strategy
    caching: {
      enabled: true,
      strategy: 'lru', // 'lru' | 'lfu' | 'ttl'
      maxSize: 500, // MB
      compression: true
    },
    
    // Resource limits
    limits: {
      maxMemory: 4096, // MB
      maxCpu: 90, // percentage
      maxDuration: 600000 // 10 minutes
    }
  }
}
```

### Monitoring Configuration

```javascript
{
  monitoringConfig: {
    // Metrics collection
    metrics: {
      enabled: true,
      interval: 5000,
      retention: 3600000 // 1 hour
    },
    
    // Alerting
    alerts: [
      {
        name: 'High Memory Usage',
        metric: 'memory',
        condition: 'gt',
        threshold: 85,
        duration: 60000,
        severity: 'warning',
        handler: async (alert) => {
          console.warn('Alert:', alert);
        }
      }
    ],
    
    // Reporting
    reporting: {
      enabled: true,
      interval: 300000, // 5 minutes
      format: 'json',
      destination: './reports'
    }
  }
}
```

## Examples

### Minimal Configuration

```javascript
const agent = new CodeAgent();
await agent.initialize('./my-project');
```

### Development Configuration

```javascript
const agent = new EnhancedCodeAgent({
  projectType: 'fullstack',
  enableConsoleOutput: true,
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: false, // Skip for faster dev
    browserHeadless: false, // See browser during dev
    parallelExecution: false, // Easier debugging
    logLevel: 'debug'
  }
});
```

### Production Configuration

```javascript
const agent = new EnhancedCodeAgent({
  projectType: 'fullstack',
  enableConsoleOutput: false,
  qualityGates: {
    eslintErrors: 0,
    eslintWarnings: 0,
    testCoverage: 95,
    allTestsPass: true
  },
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: true,
    enableLogAnalysis: true,
    enablePerformanceMonitoring: true,
    enableSecurityScanning: true,
    parallelExecution: true,
    maxWorkers: os.cpus().length,
    browserHeadless: true,
    logLevel: 'error'
  },
  securityConfig: {
    enableScanning: true,
    scanLevel: 'strict'
  },
  performanceConfig: {
    enableCaching: true,
    enableOptimization: true
  }
});
```

### CI/CD Configuration

```javascript
const agent = new EnhancedCodeAgent({
  projectType: process.env.PROJECT_TYPE,
  enableConsoleOutput: false,
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: process.env.CI !== 'true',
    runtimeTimeout: 1200000, // 20 minutes for CI
    parallelExecution: true,
    maxWorkers: 2, // Limited in CI environment
    browserHeadless: true
  },
  errorConfig: {
    exitOnError: true,
    generateReport: true,
    reportPath: process.env.CIRCLE_ARTIFACTS || './reports'
  }
});
```

## Best Practices

1. **Use environment variables** for sensitive configuration
2. **Create environment-specific** configuration files
3. **Set appropriate timeouts** based on project complexity
4. **Enable features progressively** during migration
5. **Monitor resource usage** and adjust limits accordingly
6. **Use parallel execution** for faster execution
7. **Configure logging levels** appropriately per environment
8. **Set up alerts** for critical metrics
9. **Regular review** configuration for optimization
10. **Document** custom configuration options

## Troubleshooting

### Common Configuration Issues

1. **Memory errors**: Increase `memoryLimit` or reduce `maxWorkers`
2. **Timeout errors**: Increase `runtimeTimeout` or optimize tests
3. **Browser failures**: Check `browserConfig` and system requirements
4. **Performance issues**: Enable caching and parallel execution
5. **Security warnings**: Review and update security rules

### Configuration Validation

```javascript
import { validateConfig } from '@jsenvoy/code-agent/config';

try {
  const valid = await validateConfig(myConfig);
  console.log('Configuration is valid');
} catch (error) {
  console.error('Configuration error:', error.message);
}
```

## Next Steps

1. Review [API Documentation](./API.md)
2. See [Migration Guide](./MIGRATION.md)
3. Check [Examples](../examples/)
4. Read [Best Practices](./BEST_PRACTICES.md)