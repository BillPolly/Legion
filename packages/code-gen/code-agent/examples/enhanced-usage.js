/**
 * Enhanced Code Agent Usage Examples
 * 
 * This file demonstrates how to use the EnhancedCodeAgent with real runtime testing
 */

import { EnhancedCodeAgent } from '@jsenvoy/code-agent';
import os from 'os';

// Example 1: Basic Enhanced Usage
async function basicEnhancedExample() {
  console.log('\n=== Example 1: Basic Enhanced Usage ===\n');
  
  const agent = new EnhancedCodeAgent({
    projectType: 'fullstack',
    enableConsoleOutput: true,
    enhancedConfig: {
      enableRuntimeTesting: true,
      enableBrowserTesting: true,
      enableLogAnalysis: true
    }
  });
  
  // Set up event listeners
  agent.on('progress', (e) => console.log(`[Progress] ${e.message}`));
  agent.on('runtime:log', (e) => console.log(`[Runtime] ${e.message}`));
  agent.on('error', (e) => console.error(`[Error] ${e.message}`));
  
  await agent.initialize('./example-enhanced-project');
  
  const result = await agent.develop({
    projectName: 'Enhanced Todo App',
    description: 'A todo app with real testing',
    features: [
      'Add and remove tasks',
      'Mark tasks as complete',
      'Filter by status',
      'Local storage persistence'
    ]
  });
  
  console.log('\nProject Summary:', result);
  
  // Cleanup
  await agent.cleanup();
}

// Example 2: Advanced Configuration
async function advancedConfigExample() {
  console.log('\n=== Example 2: Advanced Configuration ===\n');
  
  const agent = new EnhancedCodeAgent({
    projectType: 'backend',
    qualityGates: {
      eslintErrors: 0,
      eslintWarnings: 5,
      testCoverage: 90,
      allTestsPass: true
    },
    enhancedConfig: {
      enableRuntimeTesting: true,
      enableBrowserTesting: false, // Backend only
      enableLogAnalysis: true,
      enablePerformanceMonitoring: true,
      runtimeTimeout: 600000, // 10 minutes
      parallelExecution: true
    }
  });
  
  // Advanced initialization options
  await agent.initialize('./advanced-backend-project', {
    runtimeConfig: {
      logLevel: 'debug',
      captureConsole: true,
      logRetention: 3600000 // 1 hour
    },
    healthConfig: {
      checkInterval: 3000,
      thresholds: {
        cpu: 75,
        memory: 80,
        disk: 85
      }
    },
    performanceConfig: {
      enableCaching: true,
      cacheSize: 500, // MB
      batchSize: 20,
      maxWorkers: Math.min(os.cpus().length, 8)
    }
  });
  
  // Monitor system health
  agent.healthMonitor.on('warning', (data) => {
    console.warn(`[Health Warning] ${data.metric}: ${data.value}%`);
    if (data.metric === 'memory' && data.value > 85) {
      console.log('High memory usage detected, triggering optimization...');
      agent.performanceOptimizer.optimizeMemory();
    }
  });
  
  // Monitor performance
  agent.performanceOptimizer.on('batch:progress', (data) => {
    console.log(`[Batch Progress] ${data.completed}/${data.total} (${data.percentage.toFixed(1)}%)`);
  });
  
  const result = await agent.develop({
    projectName: 'API Service',
    description: 'RESTful API with database integration',
    features: [
      'User authentication with JWT',
      'CRUD operations for resources',
      'Rate limiting',
      'Request validation',
      'Error handling',
      'API documentation'
    ],
    technologies: ['Express', 'MongoDB', 'Jest', 'Swagger']
  });
  
  // Generate detailed reports
  const healthReport = agent.healthMonitor.generateHealthReport();
  const performanceReport = agent.performanceOptimizer.generatePerformanceReport();
  
  console.log('\nHealth Report:', healthReport);
  console.log('\nPerformance Report:', performanceReport);
  
  await agent.cleanup();
}

// Example 3: Selective Testing
async function selectiveTestingExample() {
  console.log('\n=== Example 3: Selective Testing ===\n');
  
  const agent = new EnhancedCodeAgent({
    projectType: 'frontend',
    enhancedConfig: {
      enableRuntimeTesting: true,
      enableBrowserTesting: true,
      browserConfig: {
        browsers: ['chromium'], // Only test in Chrome
        headless: true,
        viewport: { width: 1920, height: 1080 }
      }
    }
  });
  
  await agent.initialize('./frontend-project');
  
  // Generate the project first
  const devResult = await agent.develop({
    projectName: 'Dashboard App',
    description: 'Admin dashboard with charts',
    features: ['Data visualization', 'User management', 'Reports']
  });
  
  // Run selective tests
  console.log('\n--- Running Unit Tests Only ---');
  const unitResults = await agent.comprehensiveTestingPhase.runTestSuite('unit', {
    coverage: true,
    verbose: true
  });
  
  console.log('\n--- Running Browser Tests ---');
  const browserResults = await agent.comprehensiveTestingPhase.runTestSuite('browser', {
    screenshots: true,
    video: false,
    slowMo: 50 // Slow down for debugging
  });
  
  console.log('\nTest Results:');
  console.log('Unit Tests:', unitResults.summary);
  console.log('Browser Tests:', browserResults.summary);
  
  await agent.cleanup();
}

// Example 4: Fix Workflow
async function fixWorkflowExample() {
  console.log('\n=== Example 4: Fix Workflow ===\n');
  
  const agent = new EnhancedCodeAgent({
    enhancedConfig: {
      enableRuntimeTesting: true,
      enableLogAnalysis: true
    }
  });
  
  await agent.initialize('./project-to-fix');
  
  // First, run quality checks to identify issues
  console.log('Running quality checks...');
  const qualityResults = await agent.runEnhancedQualityChecks();
  
  console.log(`Found ${qualityResults.eslint.errorCount} ESLint errors`);
  console.log(`Found ${qualityResults.jest.failed} failing tests`);
  
  // Apply fixes using enhanced fixing phase
  if (qualityResults.eslint.errorCount > 0 || qualityResults.jest.failed > 0) {
    console.log('\nApplying fixes...');
    
    // Configure fixing
    agent.enhancedFixingPhase.on('fix:started', (e) => {
      console.log(`[Fix] Starting iteration ${e.iteration}`);
    });
    
    agent.enhancedFixingPhase.on('fix:completed', (e) => {
      console.log(`[Fix] Iteration ${e.iteration} completed - ${e.fixesApplied} fixes applied`);
    });
    
    const fixResult = await agent.runEnhancedFixing();
    
    console.log('\nFix Summary:');
    console.log(`Total iterations: ${fixResult.iterations}`);
    console.log(`Total fixes applied: ${fixResult.totalFixes}`);
    console.log(`Success: ${fixResult.success}`);
    
    // Generate fix report
    const fixReport = await agent.enhancedFixingPhase.generateReport();
    console.log('\nFix Report:', fixReport);
  }
  
  await agent.cleanup();
}

// Example 5: CI/CD Integration
async function cicdExample() {
  console.log('\n=== Example 5: CI/CD Integration ===\n');
  
  const isCI = process.env.CI === 'true';
  
  const agent = new EnhancedCodeAgent({
    projectType: 'fullstack',
    enableConsoleOutput: !isCI, // Disable in CI
    enhancedConfig: {
      enableRuntimeTesting: true,
      enableBrowserTesting: !isCI, // Disable browser tests in CI
      browserHeadless: true,
      parallelExecution: true,
      runtimeTimeout: isCI ? 1200000 : 600000 // 20 min in CI, 10 min locally
    }
  });
  
  // CI-specific event handling
  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };
  
  agent.on('test:completed', (e) => {
    testResults.total += e.total;
    testResults.passed += e.passed;
    testResults.failed += e.failed;
    testResults.skipped += e.skipped || 0;
  });
  
  try {
    await agent.initialize(process.env.WORKSPACE || './ci-project');
    
    const result = await agent.develop({
      projectName: 'CI/CD Test Project',
      description: 'Project for CI/CD pipeline testing',
      features: ['Basic CRUD', 'Authentication', 'Tests']
    });
    
    // Generate reports for CI artifacts
    const summary = await agent.generateEnhancedSummary();
    
    // Write reports to files
    const fs = await import('fs/promises');
    await fs.writeFile('./test-results.json', JSON.stringify(testResults, null, 2));
    await fs.writeFile('./project-summary.json', JSON.stringify(summary, null, 2));
    
    // Exit with appropriate code
    const exitCode = result.success && testResults.failed === 0 ? 0 : 1;
    console.log(`\nCI Build ${exitCode === 0 ? 'PASSED' : 'FAILED'}`);
    process.exit(exitCode);
    
  } catch (error) {
    console.error('CI Build FAILED:', error.message);
    process.exit(1);
  } finally {
    await agent.cleanup();
  }
}

// Example 6: Performance Optimization
async function performanceExample() {
  console.log('\n=== Example 6: Performance Optimization ===\n');
  
  const agent = new EnhancedCodeAgent({
    enhancedConfig: {
      enableRuntimeTesting: true,
      parallelExecution: true
    }
  });
  
  await agent.initialize('./performance-project', {
    performanceConfig: {
      enableCaching: true,
      cacheSize: 1000, // 1GB cache
      batchSize: 50,
      maxWorkers: os.cpus().length
    }
  });
  
  // Track performance metrics
  const startTime = Date.now();
  let peakMemory = 0;
  
  const memoryInterval = setInterval(() => {
    const usage = process.memoryUsage();
    peakMemory = Math.max(peakMemory, usage.heapUsed);
  }, 1000);
  
  // Use batch processing for multiple features
  const features = [
    'User management',
    'Product catalog',
    'Shopping cart',
    'Payment processing',
    'Order tracking',
    'Inventory management',
    'Reports and analytics',
    'Email notifications'
  ];
  
  // Generate each feature as a separate task
  const tasks = features.map(feature => ({
    id: feature.toLowerCase().replace(/\s+/g, '-'),
    execute: async () => {
      // Simulate feature generation
      return { feature, generated: true };
    }
  }));
  
  // Process in batches
  const results = await agent.performanceOptimizer.batchProcess(tasks, {
    parallel: true,
    cacheable: true
  });
  
  clearInterval(memoryInterval);
  
  const totalTime = Date.now() - startTime;
  const perfReport = agent.performanceOptimizer.generatePerformanceReport();
  
  console.log('\nPerformance Metrics:');
  console.log(`Total time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Peak memory: ${(peakMemory / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Cache hit rate: ${(perfReport.cache.hitRate * 100).toFixed(1)}%`);
  console.log(`Parallelization ratio: ${(perfReport.parallelization.ratio * 100).toFixed(1)}%`);
  
  await agent.cleanup();
}

// Main function to run examples
async function main() {
  const examples = {
    1: basicEnhancedExample,
    2: advancedConfigExample,
    3: selectiveTestingExample,
    4: fixWorkflowExample,
    5: cicdExample,
    6: performanceExample
  };
  
  const exampleNumber = process.argv[2];
  
  if (exampleNumber && examples[exampleNumber]) {
    await examples[exampleNumber]();
  } else {
    console.log('Available examples:');
    console.log('1. Basic Enhanced Usage');
    console.log('2. Advanced Configuration');
    console.log('3. Selective Testing');
    console.log('4. Fix Workflow');
    console.log('5. CI/CD Integration');
    console.log('6. Performance Optimization');
    console.log('\nUsage: node enhanced-usage.js <example-number>');
    console.log('Example: node enhanced-usage.js 1');
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

// Run main
main().catch(console.error);