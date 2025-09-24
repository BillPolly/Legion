---
name: generate-package-json
description: Create package.json for a Node.js server project
tags: [node, package, dependencies, npm, config]
category: strategies
subcategory: simple-node-server
variables:
  - serverType
  - dependencies
responseSchema:
  type: object
  properties:
    name:
      type: string
    version:
      type: string
    description:
      type: string
    main:
      type: string
    type:
      type: string
      enum: [module, commonjs]
    scripts:
      type: object
      properties:
        start:
          type: string
        dev:
          type: string
        test:
          type: string
    dependencies:
      type: object
    devDependencies:
      type: object
    engines:
      type: object
      properties:
        node:
          type: string
  required: [name, version, main, dependencies]
examples:
  - input:
      serverType: "express"
      dependencies: ["express", "cors"]
    output:
      name: "my-express-server"
      version: "1.0.0"
      description: "Express.js server application"
      main: "server.js"
      type: "module"
      scripts:
        start: "node server.js"
        dev: "nodemon server.js"
        test: "npm run test"
      dependencies:
        express: "^4.18.0"
        cors: "^2.8.5"
      devDependencies:
        nodemon: "^2.0.0"
      engines:
        node: ">=18.0.0"
responseProcessor:
  type: json
  validation: strict
  retries: 3
outputPrompt: "Return a complete package.json object that can be directly saved as a file."
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