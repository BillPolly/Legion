---
name: analyze-requirements
description: Analyze project requirements and extract key information
tags: [requirements, analysis, project-planning, architecture]
category: strategies
subcategory: project-planner
variables:
  - description
responseFormat: json
outputFormat: json
---

Analyze the following project requirements and extract:
- Project type (api, web, cli, library)
- Required features
- Technical constraints
- Suggested technology stack

Requirements: {{description}}

Respond in JSON format with the structure:
{
  "type": "api|web|cli|library",
  "features": ["list of features"],
  "constraints": ["list of constraints"],
  "technologies": ["suggested technologies"]
}