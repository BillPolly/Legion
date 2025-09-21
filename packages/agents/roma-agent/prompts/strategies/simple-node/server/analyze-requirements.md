---
name: analyze-server-requirements
description: Analyze Node.js server request and extract requirements
tags: [node, server, requirements, analysis, api]
category: strategies
subcategory: simple-node-server
variables:
  - taskDescription
responseFormat: json
outputFormat: json
---

Analyze this Node.js server request and extract requirements:

Task: "{{taskDescription}}"

Extract:
1. Server type (Express, HTTP, Fastify, Koa)
2. API endpoints needed
3. Middleware requirements
4. Database/storage needs
5. Authentication requirements

Return a JSON object with the following structure:
{
  "serverType": "express|http|fastify|koa",
  "endpoints": [
    {
      "method": "GET|POST|PUT|DELETE|PATCH",
      "path": "/api/example",
      "description": "What this endpoint does"
    }
  ],
  "middleware": ["cors", "body-parser", "helmet"],
  "database": "mongodb|postgresql|mysql|none",
  "authentication": true|false
}