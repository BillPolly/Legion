---
name: analyze-error
description: Analyze Node.js error and identify the issue
tags: [node, debug, error, analysis, troubleshooting]
category: strategies
subcategory: simple-node-debug
variables:
  - errorMessage
  - stackTrace
  - codeContext
responseFormat: json
outputFormat: json
---

Analyze this Node.js error and identify the issue:

Error Message:
{{errorMessage}}

Stack Trace:
{{stackTrace}}

Code Context (if available):
{{codeContext}}

Analyze this specific error and return a single analysis object with:
1. Root cause
2. Error type
3. Affected code location
4. Suggested fix

Return ONE analysis object (not an array) with the following structure:
{
  "rootCause": "What caused the error",
  "errorType": "TypeError|ReferenceError|SyntaxError|etc",
  "location": {
    "file": "filename.js",
    "line": 42,
    "function": "functionName"
  },
  "suggestedFix": "How to fix the error",
  "confidence": "high|medium|low"
}