---
name: rate-code-quality
description: Rate the quality of code on a scale of 0-10
tags:
  - quality
  - code-review
  - metrics
category: coding
variables:
  - code
responseFormat: json
schema:
  type: object
  properties:
    score:
      type: number
      minimum: 0
      maximum: 10
    issues:
      type: array
      items:
        type: string
    strengths:
      type: array
      items:
        type: string
  required: [score]
---

Rate the quality of the following code on a scale of 0-10:

# Code to Review
```javascript
{{code}}
```

# Quality Assessment Criteria

## Code Structure (Weight: 30%)
- Clear module organization
- Proper separation of concerns
- Logical file and function naming
- Appropriate abstraction levels

## Best Practices (Weight: 25%)
- Error handling and edge cases
- Input validation and sanitization
- Proper async/await or Promise usage
- Resource cleanup and memory management

## Readability (Weight: 20%)
- Clear variable and function names
- Helpful comments where needed
- Consistent formatting
- Simple, understandable logic

## Maintainability (Weight: 15%)
- Modular, reusable code
- No hardcoded values
- Proper configuration management
- Testable design

## Performance (Weight: 10%)
- Efficient algorithms
- Appropriate data structures
- No obvious bottlenecks
- Proper caching where beneficial

# Scoring Guidelines

- **9-10**: Production-ready, exceptional quality
- **7-8**: Good quality with minor improvements needed
- **5-6**: Acceptable but needs refinement
- **3-4**: Significant issues, needs major work
- **1-2**: Poor quality, requires rewrite
- **0**: Non-functional or severely flawed

# Response Format

Return your assessment as JSON:

```json
{
  "score": 7.5,
  "issues": ["optional list of specific issues found"],
  "strengths": ["optional list of code strengths"]
}
```

**Important:**
- Return ONLY valid JSON
- Score must be a number between 0 and 10
- Issues and strengths are optional but helpful