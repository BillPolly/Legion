# Task Complexity Classification

## Task to Classify
{{taskDescription}}

{{#context}}
## Context
Domain: {{domain}}
Parent Task: {{parentTask}}
{{/context}}

## Instructions
Analyze the above task and classify it as either SIMPLE or COMPLEX.

### SIMPLE Tasks
- Can be completed in a single step
- Has a clear, direct implementation
- Doesn't require breaking down into subtasks
- Examples: "Write to a file", "Call an API endpoint", "Parse JSON data"

### COMPLEX Tasks
- Requires multiple steps or components
- Needs to be broken down into subtasks
- Involves coordination of multiple operations
- Examples: "Build a REST API", "Create an authentication system", "Implement a data pipeline"

## Response Format
Provide your classification in the following JSON format:
```json
{
  "complexity": "SIMPLE or COMPLEX",
  "reasoning": "Brief explanation of why this classification was chosen"
}
```

Return ONLY the JSON object, no additional text.