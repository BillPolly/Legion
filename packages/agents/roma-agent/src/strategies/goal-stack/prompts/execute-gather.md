---
name: execute-gather
description: Generate question to gather information from user
variables:
  - paramName
  - paramPrompt
  - context
responseSchema:
  type: object
  properties:
    question:
      type: string
      description: The question to ask the user
    suggestions:
      type: array
      items:
        type: string
      description: Optional suggestions or examples
  required: [question]
---

Generate a natural question to gather this information from the user.

Parameter needed: {{paramName}}
{{#if paramPrompt}}
Prompt: {{paramPrompt}}
{{/if}}

Current context: {{context}}

Create a clear, conversational question that asks the user for this information.