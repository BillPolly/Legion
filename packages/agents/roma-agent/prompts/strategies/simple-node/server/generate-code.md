---
name: generate-server-code
description: Generate Node.js server code with specified endpoints
tags: [node, server, code-generation, express, http]
category: strategies
subcategory: simple-node-server
variables:
  - serverType
  - endpoints
responseFormat: delimited
outputFormat: delimited
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