---
name: generate-test-script
description: Create test runner configuration for Node.js project
tags: [node, jest, testing, config, npm-scripts]
category: strategies
subcategory: simple-node-test
variables:
  - testFiles
responseFormat: json
outputFormat: json
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

Return as JSON with:
{
  "scripts": {
    "test": "...",
    "test:watch": "...",
    "test:coverage": "..."
  },
  "jestConfig": {
    // Complete Jest configuration
  }
}