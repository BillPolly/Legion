---
name: analyze-server-requirements
description: Analyze Node.js server request and extract requirements
tags: [node, server, requirements, analysis, api]
category: strategies
subcategory: simple-node-server
variables:
  - taskDescription
responseSchema:
  type: object
  properties:
    serverType:
      type: string
      enum: [express, fastify, http]
      description: Type of Node.js server framework
    endpoints:
      type: array
      items:
        type: object
        properties:
          method:
            type: string
            enum: [GET, POST, PUT, DELETE, PATCH]
          path:
            type: string
          description:
            type: string
        required: [method, path, description]
    middleware:
      type: array
      items:
        type: string
    database:
      type: string
      enum: [mongodb, postgresql, mysql, none]
    authentication:
      type: boolean
  required: [serverType, endpoints]
examples:
  - input:
      taskDescription: "Create a REST API for user management with CRUD operations"
    output:
      serverType: "express"
      endpoints:
        - method: "GET"
          path: "/api/users"
          description: "Get all users"
        - method: "POST"
          path: "/api/users"
          description: "Create a new user"
        - method: "PUT"
          path: "/api/users/:id"
          description: "Update user by ID"
        - method: "DELETE"
          path: "/api/users/:id"
          description: "Delete user by ID"
      middleware: ["cors", "body-parser", "helmet"]
      database: "mongodb"
      authentication: true
responseProcessor:
  type: json
  validation: strict
  retries: 3
outputPrompt: "Return a JSON object with the analyzed server requirements matching the schema above."
---

Analyze this Node.js server request and extract requirements:

Task: "{{taskDescription}}"

Extract:
1. Server type (Express, HTTP, Fastify, Koa)
2. API endpoints needed
3. Middleware requirements
4. Database/storage needs
5. Authentication requirements

