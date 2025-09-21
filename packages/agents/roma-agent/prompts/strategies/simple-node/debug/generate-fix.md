---
name: generate-fix
description: Fix Node.js code issue based on error analysis
tags: [node, debug, fix, code-repair, solution]
category: strategies
subcategory: simple-node-debug
variables:
  - problem
  - rootCause
  - originalCode
responseFormat: delimited
outputFormat: delimited
---

Fix this Node.js code issue:

Problem: {{problem}}
Root Cause: {{rootCause}}

Original Code:
{{originalCode}}

Generate:
1. Fixed code
2. Explanation of changes
3. How to test the fix

Provide the complete fixed code with proper error handling and defensive programming.