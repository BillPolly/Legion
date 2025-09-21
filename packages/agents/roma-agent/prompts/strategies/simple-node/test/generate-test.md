---
name: generate-test-code
description: Generate Jest tests for Node.js code
tags: [node, jest, testing, unit-test, tdd]
category: strategies
subcategory: simple-node-test
variables:
  - targetName
  - targetType
  - targetDescription
  - edgeCases
responseFormat: delimited
outputFormat: delimited
---

Generate Jest tests for this Node.js code:

Target: {{targetName}} ({{targetType}})
Description: {{targetDescription}}

Edge cases to test:
{{edgeCases}}

Requirements:
- Use Jest framework
- Include describe/it blocks
- Test happy path and error cases
- Use async/await for async tests
- Include setup/teardown if needed

Generate clean, comprehensive test code with proper imports, describe blocks, and assertions.