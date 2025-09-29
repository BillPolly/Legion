---
name: filesystem-gloss-generator
description: Generate descriptive glosses for filesystem handles (files, directories)
tags: [gloss, filesystem, file, semantic-search]
category: handle-analysis
handleType: filesystem
variables:
  - resourceDescription
  - filePath
  - fileType
  - glossCount
querySpec:
  bindings:
    resourceDescription:
      path: "resourceDescription"
      fallback: "File or directory resource"
    filePath:
      path: "path"
      fallback: "unknown path"
    fileType:
      value: "file"
    glossCount:
      value: 3
  contextVariables:
    handleType:
      value: "filesystem"
responseSchema:
  type: object
  properties:
    glosses:
      type: array
      items:
        type: object
        properties:
          perspective:
            type: string
          description:
            type: string
            minLength: 20
          keywords:
            type: array
            items:
              type: string
        required: [perspective, description, keywords]
  required: [glosses]
---

You are analyzing a {{@handleType}} resource. Based on the extracted information, generate {{glossCount}} distinct descriptive perspectives (30-100 words each).

**RESOURCE INFORMATION:**
- Type: {{@handleType}}
- Path: {{filePath}}
- Description: {{resourceDescription}}

**TASK:**
Generate EXACTLY {{glossCount}} glosses describing this resource. Each gloss must strictly follow this format:
- perspective: MUST be one of: "functional", "contextual", or "use-case" (exactly these words, lowercase)
- description: MUST be 30-100 words (count them!)
- keywords: Array of 3-5 relevant keywords

**IMPORTANT CONSTRAINTS:**
- Use ONLY the exact perspective values: "functional", "contextual", or "use-case"
- Description MUST be between 30 and 100 words - count the words carefully
- Focus on practical, business-oriented descriptions
- Describe WHAT the resource is, not WHERE it is

{{outputPrompt}}