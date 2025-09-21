---
name: generate-package-json
description: Create package.json for a Node.js server project
tags: [node, package, dependencies, npm, config]
category: strategies
subcategory: simple-node-server
variables:
  - serverType
  - dependencies
responseFormat: json
outputFormat: json
---

Create package.json for a Node.js server:

Server type: {{serverType}}
Dependencies needed: {{dependencies}}

Include:
- Scripts: start, dev, test
- Type: module
- Node version: >=18

Generate a complete package.json with:
- Appropriate name and version
- Essential scripts for development and production
- All required dependencies for {{serverType}} server
- Development dependencies if needed
- Engine requirements

Return as a JSON object that can be directly saved as package.json.