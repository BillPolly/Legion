---
name: analyze-code-for-testing
description: Analyze Node.js code to identify test targets
tags: [node, testing, analysis, jest, unit-test]
category: strategies
subcategory: simple-node-test
variables:
  - code
responseSchema:
  type: object
  properties:
    testTargets:
      type: array
      items:
        type: object
        properties:
          name:
            type: string
            description: Function or endpoint name
          type:
            type: string
            enum: [function, endpoint, class, method]
            description: Type of code element
          description:
            type: string
            description: What this code element does
        required: [name, type, description]
    edgeCases:
      type: array
      items:
        type: string
      description: Edge cases that should be tested
    errorScenarios:
      type: array
      items:
        type: string
      description: Error scenarios to test
  required: [testTargets, edgeCases, errorScenarios]
examples:
  - input:
      code: |
        export function calculateSum(a, b) {
          if (typeof a !== 'number' || typeof b !== 'number') {
            throw new Error('Invalid input');
          }
          return a + b;
        }
        
        app.get('/api/users/:id', (req, res) => {
          const userId = req.params.id;
          const user = database.getUser(userId);
          res.json(user);
        });
    output:
      testTargets:
        - name: "calculateSum"
          type: "function"
          description: "Calculates sum of two numbers with input validation"
        - name: "GET /api/users/:id"
          type: "endpoint"
          description: "Retrieves user by ID from database"
      edgeCases: ["negative numbers", "zero values", "non-existent user ID", "invalid user ID format"]
      errorScenarios: ["non-numeric input", "database connection failed", "null parameters"]
responseProcessor:
  type: json
  validation: strict
  retries: 3
---

Analyze this Node.js code and identify what needs testing:

Code:
{{code}}

Identify:
1. Functions/methods to test
2. API endpoints to test
3. Edge cases to cover
4. Error scenarios