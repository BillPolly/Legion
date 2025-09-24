---
name: identify-components
description: Determine what system components and architecture patterns are needed
variables:
  - projectType
  - features
responseSchema:
  type: object
  required: [components, architecture]
  properties:
    components:
      type: array
      items:
        type: object
        required: [name, type, purpose, required]
        properties:
          name:
            type: string
            description: Component name (e.g., "database", "auth", "api-gateway")
          type:
            type: string
            enum: [database, auth, api, frontend, messaging, cache, storage, monitoring]
          purpose:
            type: string
            description: Why this component is needed
          required:
            type: boolean
            description: Whether this is required vs nice-to-have
    architecture:
      type: object
      required: [pattern, layers]
      properties:
        pattern:
          type: string
          enum: [monolithic, microservices, serverless, client-server, mvc, event-driven]
        layers:
          type: array
          items:
            type: string
            enum: [presentation, business, data, infrastructure]
---

# Identify Components

Based on the project type and features, determine the system components needed:

**Project Type:** {{projectType}}

**Features:**
{{#each features}}
- {{name}}: {{description}}
{{/each}}

## Component Analysis:

Identify which components are needed:

1. **Database**: Does this need persistent data storage?
   - Look for features involving saving, retrieving, or managing data
   - User accounts, content management, history tracking all need a database

2. **Authentication**: Does this need user identity management?
   - Look for user-specific features, accounts, or permissions
   - APIs often need API key management

3. **API Layer**: Does this need external interfaces?
   - REST endpoints for client-server communication
   - GraphQL for complex data requirements

4. **Frontend**: Does this need a user interface?
   - Web UI, admin panels, dashboards

5. **Messaging/Queue**: Does this need async processing?
   - Background jobs, email sending, notifications

6. **Cache**: Does this need performance optimization?
   - High-traffic features, frequently accessed data

7. **File Storage**: Does this need to handle uploads/downloads?
   - Images, documents, media files

## Architecture Pattern:

Choose the most appropriate pattern:
- **monolithic**: Simple, all-in-one application
- **microservices**: Complex system with independent services  
- **serverless**: Event-driven, scalable functions
- **client-server**: Traditional frontend-backend split
- **mvc**: Model-View-Controller for web apps
- **event-driven**: Async, message-based architecture

## Layers:

Identify which architectural layers are needed based on complexity.