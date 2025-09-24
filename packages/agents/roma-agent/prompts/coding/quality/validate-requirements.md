---
name: validate-requirements
description: Analyze code to check if it implements specified requirements
tags:
  - quality
  - validation
  - requirements
category: coding
variables:
  - requirements
  - code
responseSchema:
  type: object
  properties:
    features:
      type: array
      items:
        type: string
    issues:
      type: array
      items:
        type: string
    score:
      type: number
      minimum: 0
      maximum: 10
  required: [features, issues, score]
---

Analyze this code and check if it implements these requirements:

# Requirements
{{requirements}}

# Code to Analyze
```javascript
{{code}}
```

# Analysis Guidelines

## Feature Detection
Identify which requirements have been implemented:
- Look for function definitions matching feature names
- Check for route handlers implementing API endpoints
- Identify data models and schemas for data management features
- Find authentication/authorization logic where required
- Verify validation and error handling implementations

## Issue Identification
Check for common implementation problems:
- Missing error handling for edge cases
- Incomplete feature implementations
- Security vulnerabilities (e.g., missing input validation)
- Performance issues (e.g., synchronous I/O in critical paths)
- Code quality problems (e.g., hardcoded values, no comments)

## Score Calculation (0-10)
- 10: All requirements fully implemented with excellent quality
- 8-9: All requirements implemented with minor issues
- 6-7: Most requirements implemented with some issues
- 4-5: Some requirements implemented or major issues present
- 2-3: Few requirements implemented or critical issues
- 0-1: Requirements not met or code non-functional

