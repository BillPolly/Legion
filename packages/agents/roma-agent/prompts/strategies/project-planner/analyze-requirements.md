---
name: analyze-requirements
description: Analyze project requirements and extract key information
tags: [requirements, analysis, project-planning, architecture]
category: strategies
subcategory: project-planner
variables:
  - description
responseSchema:
  type: object
  properties:
    type:
      type: string
      enum: [api, web, cli, library]
      description: Project type classification
    features:
      type: array
      items:
        type: string
      description: List of required features
    constraints:
      type: array
      items:
        type: string
      description: List of technical constraints
    technologies:
      type: array
      items:
        type: string
      description: List of suggested technologies
  required: [type, features, constraints, technologies]
examples:
  - input:
      description: "Build a REST API for managing user accounts with authentication"
    output:
      type: "api"
      features: ["user registration", "authentication", "account management", "password reset"]
      constraints: ["security compliance", "scalability", "performance"]
      technologies: ["Node.js", "Express", "MongoDB", "JWT", "bcrypt"]
responseProcessor:
  type: json
  validation: strict
  retries: 3
---

Analyze the following project requirements and extract:
- Project type (api, web, cli, library)
- Required features
- Technical constraints
- Suggested technology stack

Requirements: {{description}}