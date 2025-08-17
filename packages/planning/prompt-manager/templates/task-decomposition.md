# Task Decomposition

## Task to Decompose
{{taskDescription}}

{{#domain}}
## Domain
{{domain}}
{{/domain}}

{{#parentOutputs}}
## Available from Parent Task
{{join parentOutputs ", "}}
{{/parentOutputs}}

## Instructions
Break this task down into 2-5 subtasks that together accomplish the goal.

For each subtask, provide:
1. A clear description
2. Suggested inputs (what data/artifacts it needs)
3. Suggested outputs (what it produces)
4. Brief reasoning for why this subtask is needed

The inputs and outputs should be informal natural language descriptions that:
- Help understand task dependencies
- Show data flow between tasks
- Guide further decomposition if needed
- Provide hints for tool discovery

## Response Format
Return the decomposition as JSON:
```json
{
  "task": "Original task description",
  "subtasks": [
    {
      "id": "unique-id",
      "description": "Clear subtask description",
      "suggestedInputs": ["input1", "input2"],
      "suggestedOutputs": ["output1", "output2"],
      "reasoning": "Why this subtask is needed"
    }
  ]
}
```

Return ONLY the JSON object, no additional text.