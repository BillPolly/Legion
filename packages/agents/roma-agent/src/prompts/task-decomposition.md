Break down this complex task into simpler subtasks that can be executed independently.

Task: "{{taskDescription}}"

{{classificationReasoning}}
{{suggestedApproach}}

{{artifactsSection}}

Create a plan with clear, actionable subtasks. Each subtask should:
1. Have a specific, well-defined goal
2. Be executable with available tools
3. Produce clear outputs or artifacts that can be used by other subtasks

Respond with JSON:
{
  "decompose": true,
  "subtasks": [
    {
      "description": "Clear description of what this subtask does",
      "outputs": "@artifact_name"  // Optional: save this subtask's result as artifact
    }
  ]
}

Notes:
- Subtasks will be executed in order
- Use @artifact_name in later subtasks to reference outputs from earlier ones
- Keep subtasks focused and atomic - each should do one thing well