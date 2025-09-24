---
name: analyze-requirements
description: Analyze project requirements and extract type, features, constraints, and technologies
tags:
  - requirements
  - analysis
  - project-planning
category: coding
variables:
  - requirements
responseSchema:
  type: object
  properties:
    type:
      type: string
      enum: [api, web, cli, library]
    features:
      type: array
      items:
        type: string
    constraints:
      type: array
      items:
        type: string
    technologies:
      type: array
      items:
        type: string
  required: [type, features, constraints, technologies]
examples:
  - type: api
    features: [authentication, CRUD operations, validation]
    constraints: [secure, scalable]
    technologies: [nodejs, express, mongodb, jsonwebtoken]
  - type: web
    features: [dashboard, charts, user management]
    constraints: [responsive, accessible]
    technologies: [nodejs, react, tailwind]
---

Analyze the following project requirements and extract:
1. Project type (api, web, cli, or library)
2. Key features required
3. Technical constraints
4. Recommended technology stack

# Requirements
{{requirements}}

# Analysis Guidelines

## Project Type Classification
- **api**: REST APIs, GraphQL services, backend services, microservices
- **web**: Web applications, frontend apps, SPAs, full-stack applications
- **cli**: Command-line tools, terminal utilities, scripts
- **library**: NPM packages, utilities, shared modules, frameworks

## Feature Extraction
Extract specific functional requirements and capabilities:
- Core functionality (e.g., authentication, data management, file processing)
- User-facing features (e.g., dashboard, reports, notifications)
- Technical features (e.g., caching, logging, monitoring)
- Integration requirements (e.g., third-party APIs, databases)

## Constraint Identification
Identify technical and business constraints:
- Performance requirements (e.g., scalable, fast, real-time)
- Security requirements (e.g., secure, encrypted, compliant)
- Deployment constraints (e.g., cloud, containerized, serverless)
- Development constraints (e.g., timeline, testing, documentation)

## Technology Stack Recommendation
Suggest appropriate technologies based on:
- Project type and scale
- Feature requirements
- Technical constraints
- Industry best practices

