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
responseSchema:
  type: object
  properties:
    rootCause:
      type: string
      description: What caused the error
    errorType:
      type: string
      enum: [TypeError, ReferenceError, SyntaxError, RangeError, URIError, EvalError, InternalError, UnhandledPromiseRejectionWarning, ModuleNotFoundError]
      description: Type of JavaScript error
    location:
      type: object
      properties:
        file:
          type: string
          description: Filename where error occurred
        line:
          type: integer
          description: Line number of error
        function:
          type: string
          description: Function name where error occurred
      required: [file]
    suggestedFix:
      type: string
      description: How to fix the error
    confidence:
      type: string
      enum: [high, medium, low]
      description: Confidence level in the analysis
  required: [rootCause, errorType, location, suggestedFix, confidence]
examples:
  - input:
      errorMessage: "Cannot read properties of undefined (reading 'name')"
      stackTrace: "TypeError: Cannot read properties of undefined (reading 'name')\n    at getUserName (/app/user.js:15:23)\n    at Object.<anonymous> (/app/server.js:8:17)"
      codeContext: "function getUserName(user) {\n  return user.name;\n}\n\nconst name = getUserName();"
    output:
      rootCause: "Function getUserName called without required user parameter"
      errorType: "TypeError"
      location:
        file: "user.js"
        line: 15
        function: "getUserName"
      suggestedFix: "Pass a valid user object to getUserName function or add null/undefined check"
      confidence: "high"
responseProcessor:
  type: json
  validation: strict
  retries: 3
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