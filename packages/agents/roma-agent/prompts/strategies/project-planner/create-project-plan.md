---
name: create-project-plan
description: Create detailed phase-based project execution plan
tags: [planning, project, phases, tasks, dependencies]
category: strategies
subcategory: project-planner
variables:
  - requirements
responseSchema:
  type: object
  properties:
    planId:
      type: string
      description: Unique identifier for the plan
      pattern: "^[a-z0-9-]+$"
    phases:
      type: array
      items:
        type: object
        properties:
          phase:
            type: string
            description: Name of the phase
          priority:
            type: integer
            minimum: 1
            description: Execution priority (1 = highest)
          tasks:
            type: array
            items:
              type: object
              properties:
                id:
                  type: string
                  description: Unique task identifier
                action:
                  type: string
                  description: What needs to be done
                dependencies:
                  type: array
                  items:
                    type: string
                  description: Task IDs this task depends on
              required: [id, action, dependencies]
        required: [phase, priority, tasks]
      minItems: 1
  required: [planId, phases]
examples:
  - input:
      requirements: "Create a Node.js REST API for user management with authentication"
    output:
      planId: "user-api-plan"
      phases:
        - phase: "setup"
          priority: 1
          tasks:
            - id: "setup-project"
              action: "Initialize Node.js project with package.json"
              dependencies: []
            - id: "install-deps"
              action: "Install Express, MongoDB driver, JWT libraries"
              dependencies: ["setup-project"]
        - phase: "development"
          priority: 2
          tasks:
            - id: "create-server"
              action: "Create Express server with basic setup"
              dependencies: ["install-deps"]
            - id: "auth-middleware"
              action: "Implement JWT authentication middleware"
              dependencies: ["create-server"]
            - id: "user-routes"
              action: "Create user CRUD endpoints"
              dependencies: ["auth-middleware"]
responseProcessor:
  type: json
  validation: strict
  retries: 3
---

Create a detailed project plan for the following requirements:
{{requirements}}

Generate a phase-based execution plan with tasks for each phase.
Include dependencies between tasks and estimated complexity.