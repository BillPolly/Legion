# Legion Planning Package - Development Environment Setup

## 🚀 Complete Development Environment Guide

This guide provides comprehensive setup instructions for beginning TDD development of the Legion Planning Package, based on the proven node-runner methodology.

---

## 📋 Prerequisites Verification

### **System Requirements**
```bash
# Verify Node.js version (must be 18.0.0+)
node --version  # Should show v18.0.0 or higher

# Verify npm version
npm --version   # Should show 8.0.0 or higher

# Verify Legion monorepo setup
ls /path/to/LegionCopy/packages/  # Should show multiple packages including node-runner
```

### **Environment Variables Setup**
```bash
# Check for .env file in Legion root
ls /path/to/LegionCopy/.env  # Should exist with API keys

# Verify essential environment variables
grep -E "(ANTHROPIC_API_KEY|OPENAI_API_KEY)" /path/to/LegionCopy/.env
```

---

## 🏗️ Development Environment Setup

### **Step 1: Navigate to Planning Package**
```bash
cd /path/to/LegionCopy/packages/planning/planner
pwd  # Should show: .../LegionCopy/packages/planning/planner
```

### **Step 2: Install Dependencies**
```bash
# Install package dependencies
npm install

# Install development dependencies (if not already present)
npm install --save-dev jest@^29.0.0

# Link Legion workspace dependencies
npm run link-workspace  # Or equivalent for your setup
```

### **Step 3: Verify Current Package State**
```bash
# Check current package structure
ls -la
# Should show: package.json, src/, __tests__/, etc.

# Verify current tests (baseline)
npm test
# Note: May have some failures - this is expected before TDD enhancement

# Check current test count
find __tests__ -name "*.test.js" | wc -l
# Should show: 4 (current baseline)
```

---

## 🧪 Test Infrastructure Setup

### **Step 4: Enhanced Jest Configuration**
Create or update `jest.config.js`:
```javascript
export default {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapping: {
    '^@legion/(.*)$': '<rootDir>/../../../packages/$1/src',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/examples/**',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  maxWorkers: 4
};
```

### **Step 5: Create Test Setup Infrastructure**
```bash
# Create comprehensive test directory structure
mkdir -p __tests__/{unit,integration,utils,mocks}

# Create test setup file
touch __tests__/setup.js
```

**Content for `__tests__/setup.js`:**
```javascript
/**
 * Jest setup file for Legion Planning Package tests
 * Based on successful node-runner testing patterns
 */

// Global test configuration
jest.setTimeout(30000);

// Mock console methods to reduce test noise (optional)
global.console = {
  ...console,
  // Comment out these lines if you want to see console output during tests
  // log: jest.fn(),
  // error: jest.fn(),
  // warn: jest.fn(),
};

// Global test utilities
global.testUtils = {
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  createMockPlanner: () => ({
    createPlan: jest.fn(),
    validatePlan: jest.fn(),
    executePlan: jest.fn()
  }),
  
  createMockLLMClient: () => ({
    generateCompletion: jest.fn().mockResolvedValue({
      content: '{"type": "sequence", "steps": []}'
    })
  })
};

// Setup cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});
```

### **Step 6: Create Mock Providers**
```bash
# Create mock provider infrastructure
touch __tests__/utils/MockLLMClient.js
touch __tests__/utils/MockResourceManager.js
touch __tests__/utils/TestDataGenerator.js
```

**Content for `__tests__/utils/MockLLMClient.js`:**
```javascript
/**
 * Mock LLM Client for testing
 * Provides predictable responses for testing planning functionality
 */

export class MockLLMClient {
  constructor(responses = {}) {
    this.responses = responses;
    this.callHistory = [];
  }

  async generateCompletion(prompt, options = {}) {
    this.callHistory.push({ prompt, options });
    
    // Return predefined responses or default
    if (this.responses[prompt]) {
      return { content: this.responses[prompt] };
    }
    
    // Default successful plan response
    return {
      content: JSON.stringify({
        type: 'sequence',
        steps: [
          { type: 'action', tool: 'test_tool', params: {} }
        ]
      })
    };
  }

  getCallHistory() {
    return this.callHistory;
  }

  clearHistory() {
    this.callHistory = [];
  }
}
```

---

## 📊 Initial Test Creation

### **Step 7: Create Core Test Suites (TDD Foundation)**
```bash
# Create initial unit test files
touch __tests__/unit/PlannerCore.test.js
touch __tests__/unit/BTValidator.test.js  
touch __tests__/unit/PromptEngine.test.js
touch __tests__/unit/PlanExecutor.test.js

# Create initial integration test files
touch __tests__/integration/ComplexWorkflows.test.js
touch __tests__/integration/NodeRunnerIntegration.test.js
```

### **Step 8: Verify Test Infrastructure**
```bash
# Verify Jest can run (should pass with empty tests)
npm test -- --passWithNoTests

# Run with coverage to verify configuration
npm run test:coverage

# Verify test file discovery
npm test -- --listTests
```

---

## 🔧 Development Tools Setup

### **Step 9: Development Scripts Configuration**
Update `package.json` scripts section:
```json
{
  "scripts": {
    "test": "NODE_OPTIONS='--experimental-vm-modules' jest",
    "test:watch": "NODE_OPTIONS='--experimental-vm-modules' jest --watch",
    "test:coverage": "NODE_OPTIONS='--experimental-vm-modules' jest --coverage",
    "test:unit": "NODE_OPTIONS='--experimental-vm-modules' jest __tests__/unit",
    "test:integration": "NODE_OPTIONS='--experimental-vm-modules' jest __tests__/integration",
    "test:debug": "NODE_OPTIONS='--experimental-vm-modules' jest --verbose --no-coverage",
    "lint": "eslint src/ __tests__/",
    "lint:fix": "eslint src/ __tests__/ --fix",
    "dev": "node --watch src/index.js",
    "build": "echo 'ES modules - no build step required'"
  }
}
```

### **Step 10: VS Code Configuration (Optional)**
Create `.vscode/settings.json`:
```json
{
  "jest.jestCommandLine": "NODE_OPTIONS='--experimental-vm-modules' npx jest",
  "jest.autoRun": "off",
  "eslint.workingDirectories": ["src", "__tests__"],
  "javascript.suggest.includeCompletions": true,
  "typescript.suggest.includeCompletions": true
}
```

---

## 🏃 Ready to Start Development

### **Step 11: Baseline Validation**
```bash
# Verify everything is working
npm test -- --passWithNoTests  # Should pass
npm run lint                    # Should pass or show minor issues  
npm run test:coverage           # Should generate coverage report

# Verify package imports work
node -e "import('./src/index.js').then(console.log)" # Should show exports
```

### **Step 12: Create First TDD Test**
Create your first test following TDD principles:

**Example: `__tests__/unit/PlannerCore.test.js`**
```javascript
/**
 * @fileoverview Core Planner functionality tests
 * Following TDD methodology - tests written first
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockLLMClient } from '../utils/MockLLMClient.js';

// Note: Import will initially fail - this is expected in TDD
// import { PlannerCore } from '../../src/core/PlannerCore.js';

describe('PlannerCore', () => {
  let planner;
  let mockLLM;

  beforeEach(() => {
    mockLLM = new MockLLMClient();
    // planner = new PlannerCore({ llmClient: mockLLM });
  });

  describe('Plan Creation', () => {
    it('should create a simple sequential plan', async () => {
      // This test will fail initially - implement PlannerCore to make it pass
      expect(true).toBe(true); // Placeholder
    });
  });
});
```

---

## 📈 TDD Development Process

### **Step 13: Begin TDD Cycle**
1. **Red Phase**: Write failing test
   ```bash
   npm test __tests__/unit/PlannerCore.test.js
   # Should fail - no implementation yet
   ```

2. **Green Phase**: Implement minimal code to pass
   ```bash
   # Create src/core/PlannerCore.js with minimal implementation
   npm test __tests__/unit/PlannerCore.test.js  
   # Should now pass
   ```

3. **Iterate**: Add more tests and implementation
   ```bash
   npm test:watch  # Keep running tests during development
   ```

### **Step 14: Monitor Progress**
```bash
# Track test count growth (target: 300+)
find __tests__ -name "*.test.js" -exec grep -l "it(" {} \; | wc -l

# Monitor coverage (target: 70%+)
npm run test:coverage

# Verify integration health
npm test __tests__/integration/
```

---

## 🎯 Success Criteria Tracking

### **Daily Development Checklist**
- [ ] All tests passing (no regressions)
- [ ] Test count increasing toward 300+ target
- [ ] Coverage maintaining 70%+ target
- [ ] No critical issues introduced
- [ ] Documentation updated for new features

### **Weekly Milestone Validation**
- [ ] Weekly test count targets met (see IMPLEMENTATION_ROADMAP.md)
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Code quality standards maintained

---

## 🔍 Troubleshooting Guide

### **Common Setup Issues**

#### **Jest ES Modules Issues**
```bash
# If you see "SyntaxError: Cannot use import statement"
NODE_OPTIONS='--experimental-vm-modules' npm test

# Or update jest.config.js with proper ES modules support
```

#### **Package Import Issues**
```bash
# If Legion package imports fail, verify workspace setup
npm ls @legion/bt-validator  # Should show linked package
```

#### **Test Discovery Issues**
```bash
# Verify Jest finds all test files
npm test -- --listTests | grep -E "\.test\.js$"
```

### **Performance Issues**
```bash
# If tests are slow, use focused testing
npm test -- --testNamePattern="specific test name"
npm test -- __tests__/unit/specific-file.test.js
```

---

## ✅ Environment Verification Checklist

### **Pre-Development Verification**
- [ ] Node.js 18.0.0+ installed and verified
- [ ] Legion monorepo accessible with all packages
- [ ] Planning package dependencies installed
- [ ] Jest configuration working with ES modules
- [ ] Test infrastructure created and verified
- [ ] Mock providers created and functional
- [ ] Development scripts configured and tested
- [ ] Baseline test suite running successfully

### **Ready for TDD Development**
- [ ] First failing test written (Red phase)
- [ ] TDD cycle process understood and ready
- [ ] Test count tracking system in place
- [ ] Coverage monitoring configured
- [ ] Development environment fully operational

**Status: DEVELOPMENT ENVIRONMENT READY** ✅

Your Legion Planning Package development environment is now configured with the same robust testing infrastructure that made node-runner successful. You're ready to begin the TDD development process!

---

## 🚀 Next Steps

1. **Begin TDD Development**: Start with your first failing test
2. **Follow the Implementation Roadmap**: Use IMPLEMENTATION_ROADMAP.md for detailed steps
3. **Track Success Metrics**: Monitor progress against SUCCESS_METRICS.md criteria
4. **Build with Excellence**: Apply the same rigor that made node-runner production-ready

**The foundation is set for another Legion package success story!** 🎉

---

*Development Setup Guide v1.0*  
*Based on Node-Runner Success Model*  
*Ready for TDD Excellence*