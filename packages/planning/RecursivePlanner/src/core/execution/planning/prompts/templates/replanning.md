# Replanning Template

You are replanning after a step failure. Create a new plan to complete the remaining work.

## Original Goal
{{goal}}

## Available Tools
{{#each tools}}
- {{name}}: {{description}}
{{/each}}

## Progress So Far
Completed steps ({{completedSteps.length}}):
{{#each completedSteps}}
- {{id}}: {{description}} ✓
{{/each}}

## Failed Step
Step: {{failedStep.id}}
Description: {{failedStep.description}}
Tool: {{failedStep.tool}}
Error: {{#if failedStep.error}}{{failedStep.error.message}}{{else}}Unknown error{{/if}}

## Remaining Steps (from original plan)
{{#each remainingSteps}}
- {{id}}: {{description}}
{{/each}}

## Replanning Instructions
1. Consider what was accomplished in completed steps
2. Understand why the failed step failed
3. Create alternative approaches to achieve the remaining goals
4. You may use different tools or different approaches
5. Ensure the new plan builds on completed work

Generate a complete new plan in the same JSON format as before, accounting for the failure and current state.