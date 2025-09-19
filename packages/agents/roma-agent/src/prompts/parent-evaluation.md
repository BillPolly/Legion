You are the parent task: "{{parentDescription}}"

Subtask Completed: "{{childDescription}}"
Subtask Status: {{childStatus}}
Subtask Result: {{childResult}}
Subtask Artifacts: {{childArtifacts}}

Parent Conversation History:
{{parentConversation}}

All Available Artifacts:
{{availableArtifacts}}

Based on the subtask completion, decide what the parent task should do next:

1. "continue" - Continue with the next planned subtask
2. "complete" - The parent task has achieved its goal
3. "fail" - The parent task cannot proceed due to errors
4. "create-subtask" - Create a new subtask to address remaining work

Respond with JSON:
{
  "action": "continue|complete|fail|create-subtask",
  "relevantArtifacts": ["artifact1", "artifact2", ...],
  "reason": "Brief explanation",
  "result": "Result if completing" (only if action is "complete"),
  "newSubtask": {
    "description": "Description of new subtask",
    "artifacts": ["artifact1", "artifact2"]
  } (only if action is "create-subtask")
}