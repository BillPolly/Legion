---
name: generate-test-script
description: Create test runner configuration for Node.js project
tags: [node, jest, testing, config, npm-scripts]
category: strategies
subcategory: simple-node-test
variables:
  - testFiles
responseSchema:
  type: object
  properties:
    scripts:
      type: object
      properties:
        test:
          type: string
          description: Basic test command
        "test:watch":
          type: string
          description: Watch mode test command
        "test:coverage":
          type: string
          description: Test with coverage command
      required: [test, "test:watch", "test:coverage"]
    jestConfig:
      type: object
      properties:
        testEnvironment:
          type: string
        verbose:
          type: boolean
        collectCoverage:
          type: boolean
        coverageDirectory:
          type: string
        testMatch:
          type: array
          items:
            type: string
        transform:
          type: object
        moduleNameMapping:
          type: object
      required: [testEnvironment, verbose, testMatch]
  required: [scripts, jestConfig]
examples:
  - input:
      testFiles: ["__tests__/*.test.js", "src/**/*.test.js"]
    output:
      scripts:
        test: "NODE_OPTIONS='--experimental-vm-modules' jest"
        "test:watch": "NODE_OPTIONS='--experimental-vm-modules' jest --watch"
        "test:coverage": "NODE_OPTIONS='--experimental-vm-modules' jest --coverage"
      jestConfig:
        testEnvironment: "node"
        verbose: true
        collectCoverage: false
        coverageDirectory: "coverage"
        testMatch: ["**/__tests__/**/*.test.js", "**/?(*.)+(spec|test).js"]
        transform: {}
        moduleNameMapping: {}
responseProcessor:
  type: json
  validation: strict
  retries: 3
---

Create a test runner script for Node.js project:

Test framework: Jest
Test files: {{testFiles}}

Include:
- npm test script
- Coverage reporting
- Watch mode option

Generate:
1. NPM scripts for package.json (test, test:watch, test:coverage)
2. Jest configuration object with:
   - Test environment: node
   - Coverage settings
   - Test match patterns
   - Module settings for ESM
   - Verbose output