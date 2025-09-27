---
name: interpret-message
description: Interpret user message into goal stack action
variables:
  - userMessage
  - currentGoal
  - evidence
responseSchema:
  type: object
  properties:
    action:
      type: string
      enum: [new_goal, add_evidence, abandon_goal, continue]
      description: The action to take based on user message
    goal:
      type: object
      properties:
        gloss:
          type: string
          description: Natural language goal summary
        context:
          type: object
          description: Additional context for the goal
      description: New goal to create (if action is new_goal)
    evidence:
      type: object
      properties:
        key:
          type: string
          description: Evidence key name
        value:
          description: Evidence value
      description: Evidence to add (if action is add_evidence)
    reasoning:
      type: string
      description: Explanation of the interpretation
  required: [action, reasoning]
---

Interpret this user message in the context of the current goal.

User message: {{userMessage}}

{{#if currentGoal}}
Current goal: {{currentGoal}}
Evidence collected: {{evidence}}
{{else}}
No current goal active.
{{/if}}

Determine if the user is:
1. **Starting a new goal** (action: new_goal)
   - User is asking for help with a new task
   - User is requesting something to be done
   
2. **Providing information for current goal** (action: add_evidence)
   - User is answering a question
   - User is providing data needed for current goal
   
3. **Abandoning the current goal** (action: abandon_goal)
   - User wants to stop or cancel
   - User says "never mind" or "forget it"
   
4. **Just conversing** (action: continue)
   - User is clarifying or asking questions
   - User is acknowledging without providing new information

Return the appropriate action with goal or evidence details as needed.