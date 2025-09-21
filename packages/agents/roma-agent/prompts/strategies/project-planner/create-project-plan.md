---
name: create-project-plan
description: Create detailed phase-based project execution plan
tags: [planning, project, phases, tasks, dependencies]
category: strategies
subcategory: project-planner
variables:
  - requirements
responseFormat: json
outputFormat: json
---

Create a detailed project plan for the following requirements:
{{requirements}}

Generate a phase-based execution plan with tasks for each phase.
Include dependencies between tasks and estimated complexity.

Respond in JSON format matching the execution plan schema:
{
  "planId": "unique-plan-id",
  "phases": [
    {
      "phase": "phase-name",
      "priority": 1,
      "tasks": [
        {
          "id": "task-id",
          "action": "what to do",
          "dependencies": ["dependent-task-ids"]
        }
      ]
    }
  ]
}