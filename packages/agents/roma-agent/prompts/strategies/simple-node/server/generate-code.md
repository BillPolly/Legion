---
name: generate-server-code
description: Generate Node.js server code with specified endpoints
tags: [node, server, code-generation, express, http]
category: strategies
subcategory: simple-node-server
variables:
  - serverType
  - endpoints
responseSchema:
  type: object
  properties:
    code:
      type: string
      description: Generated Node.js server code
    dependencies:
      type: array
      items:
        type: string
      description: NPM dependencies required
  required: [code]
examples:
  - input:
      serverType: "express"
      endpoints: 
        - method: "GET"
          path: "/api/health"
          description: "Health check endpoint"
    output:
      code: |
        import express from 'express';
        
        const app = express();
        const PORT = process.env.PORT || 3000;
        
        // Middleware
        app.use(express.json());
        
        // Health check endpoint
        app.get('/api/health', (req, res) => {
          res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });
        
        app.listen(PORT, () => {
          console.log(`Server running on port ${PORT}`);
        });
      dependencies: ["express"]
responseProcessor:
  type: json
  validation: strict
  retries: 3
---

Generate a simple Node.js {{serverType}} server with exactly these endpoints:

{{endpoints}}

Requirements:
- Use {{serverType}} framework
- Include error handling
- Add basic logging
- Port from environment variable (default 3000)
- Graceful shutdown handling

Generate clean, production-ready code with ONLY the endpoints listed above.