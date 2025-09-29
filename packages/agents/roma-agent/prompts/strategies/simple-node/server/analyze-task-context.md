---
name: analyze-task-with-context
description: Analyze a task using contextual data extraction from Handle objects
tags: [task, analysis, context, handle]
category: strategies
subcategory: simple-node-server
variables:
  - taskDescription
  - contextData
  - priority
querySpec:
  bindings:
    taskDescription:
      path: "description"
      required: true
    contextData:
      path: "context.metadata"
      fallback: "No context available"
    priority:
      path: "priority"
      transform: "uppercase"
      fallback: "NORMAL"
    tags:
      path: "tags"
      filter:
        category: "server"
      transform: "join"
      options:
        separator: ", "
  contextVariables:
    environment:
      value: "development"
    timestamp:
      path: "createdAt"
responseSchema:
  type: object
  properties:
    analysisResult:
      type: string
      description: The analysis of the task
    complexity:
      type: string
      enum: [low, medium, high]
    estimatedHours:
      type: number
      minimum: 0.5
      maximum: 40
    recommendedApproach:
      type: string
  required: [analysisResult, complexity, estimatedHours]
examples:
  - input:
      taskDescription: "Create a REST API with authentication"
      contextData: "Node.js project with Express framework"
      priority: "HIGH"
    output:
      analysisResult: "Complex API development task requiring authentication middleware"
      complexity: "high"
      estimatedHours: 12
      recommendedApproach: "Use Express with JWT authentication and middleware"
responseProcessor:
  type: json
  validation: strict
  retries: 3
---

Analyze the following task with extracted context:

**Task:** {{taskDescription}}

**Context Information:** {{contextData}}

**Priority Level:** {{priority}}

**Tags:** {{tags}}

**Environment:** {{@environment}}
**Created:** {{@timestamp}}

Provide a comprehensive analysis including:
1. Task complexity assessment
2. Time estimation
3. Recommended technical approach
4. Key considerations or challenges

{{outputPrompt}}