---
name: analyze-code-for-testing
description: Analyze Node.js code to identify test targets
tags: [node, testing, analysis, jest, unit-test]
category: strategies
subcategory: simple-node-test
variables:
  - code
responseFormat: json
outputFormat: json
---

Analyze this Node.js code and identify what needs testing:

Code:
{{code}}

Identify:
1. Functions/methods to test
2. API endpoints to test
3. Edge cases to cover
4. Error scenarios

Return a JSON object with:
{
  "testTargets": [
    {
      "name": "functionOrEndpointName",
      "type": "function|endpoint|class",
      "description": "What this does"
    }
  ],
  "edgeCases": ["empty input", "null values", "boundary conditions"],
  "errorScenarios": ["database fails", "invalid input", "network timeout"]
}