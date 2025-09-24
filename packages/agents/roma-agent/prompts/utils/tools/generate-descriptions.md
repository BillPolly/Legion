---
name: generate-tool-descriptions
description: Generate tool descriptions for task-based tool discovery
tags: [tools, discovery, semantic-search]
category: utils
variables: 
  - taskDescription
  - minDescriptions
  - maxDescriptions
responseSchema:
  type: array
  items:
    type: string
    minLength: 10
    maxLength: 200
  minItems: 3
  maxItems: 10
examples:
  - "Write JavaScript code to implement the solution"
  - "Generate Node.js program file with the required logic"
  - "Create new file on disk with the endpoint code"
  - "Hash passwords using bcrypt algorithm"
  - "Generate and validate JWT tokens"
  - "Query database for user credentials"
  - "Validate request payload structure"
  - "Read CSV file from disk"
  - "Parse CSV format into structured data"
  - "Convert data structure to JSON format"
  - "Write JSON output to new file"
  - "Validate CSV column headers and data types"
  - "Handle file encoding and character sets"
responseProcessor:
  type: json
  validation: strict
  retries: 3
---

Given this task: "{{taskDescription}}"

Generate tool descriptions at TWO levels:

1. GENERAL/HIGH-LEVEL descriptions (2-3):
   - Code generation tools: "write JavaScript code", "generate Node.js program", "create TypeScript file"
   - File creation tools: "write file to disk", "create new file"
   - Think of tools that would GENERATE CODE or CREATE FILES

2. SPECIFIC/DETAILED descriptions (3-5):
   - Concrete action tools (e.g., "hash password", "read file", "parse JSON")
   - Step-by-step operation tools
   - Think of tools that would PERFORM SPECIFIC OPERATIONS

Total: {{minDescriptions}}-{{maxDescriptions}} descriptions mixing both levels.

Each description should:
- Be 1-2 sentences describing a tool capability
- Focus on the ACTION the tool performs
- Be searchable (avoid vague terms like "process" or "handle")

IMPORTANT: Include descriptions for BOTH code/file generation AND specific operations.