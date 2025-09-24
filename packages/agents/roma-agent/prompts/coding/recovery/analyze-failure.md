---
name: analyze-failure
description: Analyze task failure and provide recovery recommendations
tags:
  - recovery
  - error-analysis
  - debugging
category: coding
variables:
  - task
  - error
  - errorType
responseSchema:
  type: object
  properties:
    reason:
      type: string
    missingItems:
      type: array
      items:
        type: string
    failedApproaches:
      type: array
      items:
        type: string
    suggestedConstraints:
      type: object
  required: [reason, failedApproaches, suggestedConstraints]
---

Analyze this task failure and provide recovery recommendations:

# Failed Task
```json
{{task}}
```

# Error Details
- **Message**: {{error}}
- **Type**: {{errorType}}

# Failure Analysis Framework

## Root Cause Categories
1. **Missing Dependencies**: Required packages, modules, or resources not available
2. **Configuration Issues**: Incorrect settings, paths, or environment variables
3. **Logic Errors**: Bugs in implementation, incorrect algorithms, or flawed approach
4. **Resource Constraints**: Memory, disk space, or permission issues
5. **External Failures**: API failures, network issues, or third-party service problems
6. **Validation Failures**: Input validation, schema mismatches, or type errors

## Analysis Steps
1. Identify the specific failure point in the task execution
2. Determine which category the error falls into
3. List any missing prerequisites or dependencies
4. Identify which approaches have already failed
5. Suggest constraints to avoid similar failures

## Recovery Strategy Guidelines
- For missing dependencies: List specific packages or resources needed
- For configuration issues: Specify correct configuration values
- For logic errors: Suggest alternative implementation approaches
- For resource constraints: Recommend resource management strategies
- For external failures: Propose fallback mechanisms or retries
- For validation failures: Define proper input constraints

