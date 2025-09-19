Evaluate if this task is complete.

Task: "{{taskDescription}}"

Subtasks Completed:
{{subtasksCompleted}}

Conversation History:
{{conversationHistory}}

Available Artifacts:
{{availableArtifacts}}

Determine if this task has achieved its goal based on the completed subtasks.

Respond with JSON:
{
  "complete": true/false,
  "reason": "Brief explanation",
  "result": "Summary of accomplishment" (if complete),
  "additionalSubtask": {
    "description": "What still needs to be done",
    "artifacts": ["relevant artifacts"]
  } (if not complete)
}