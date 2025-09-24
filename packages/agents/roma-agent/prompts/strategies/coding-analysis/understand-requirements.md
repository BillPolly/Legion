---
name: understand-requirements
description: Extract project type, features, and constraints from natural language description
variables:
  - taskDescription
responseSchema:
  type: object
  required: [projectType, features, constraints]
  properties:
    projectType:
      type: string
      enum: [api, webapp, cli, library, service, fullstack, script]
      description: The type of project being requested
    features:
      type: array
      items:
        type: object
        required: [name, description, priority]
        properties:
          name:
            type: string
            description: Short name for the feature
          description:
            type: string
            description: What this feature does
          priority:
            type: string
            enum: [critical, high, medium, low]
    constraints:
      type: object
      properties:
        technology:
          type: string
          description: Specific technology requirements (e.g., "Node.js", "React")
        performance:
          type: string
          description: Performance requirements if mentioned
        timeline:
          type: string
          description: Timeline or deadline if mentioned
        scalability:
          type: string
          description: Scalability requirements if mentioned
---

# Understand Requirements

Analyze this task description and extract the core requirements:

**Task Description:**
{{taskDescription}}

## Analysis Required:

1. **Project Type**: Determine what kind of project this is:
   - `api`: REST API or backend service with endpoints
   - `webapp`: Frontend web application with UI
   - `cli`: Command-line tool or script
   - `library`: Reusable code library/package
   - `service`: Background service or daemon
   - `fullstack`: Both frontend and backend
   - `script`: Simple automation script

2. **Features**: List all functional features mentioned or implied:
   - Extract explicit features mentioned
   - Infer implicit features that would be needed
   - Prioritize based on how critical they are to the core functionality

3. **Constraints**: Identify any constraints or requirements:
   - Technology stack if specified
   - Performance requirements
   - Timeline or urgency
   - Scalability needs

## Important:
- If the user says "API" or "REST" or mentions endpoints → projectType is "api"
- If they mention "server" with frontend → projectType is "fullstack"
- If they just say "server" → could be "api" or "service" based on context
- Look for implicit requirements (e.g., "user management" implies authentication)