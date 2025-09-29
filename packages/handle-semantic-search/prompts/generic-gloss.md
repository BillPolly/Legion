---
name: generic-gloss-generator
description: Generate descriptive glosses for generic/unknown handle types
tags: [gloss, generic, semantic-search]
category: handle-analysis
handleType: generic
variables:
  - resourceDescription
  - capabilities
  - glossCount
querySpec:
  bindings:
    resourceDescription:
      path: "resourceDescription"
      fallback: "Generic resource"
    capabilities:
      path: "capabilities"
      transform: "join"
      options:
        separator: ", "
      fallback: "unknown capabilities"
    glossCount:
      value: 2
  contextVariables:
    handleType:
      value: "generic"
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

You are analyzing a {{@handleType}} resource with limited information. Based on the available information, generate {{glossCount}} descriptive perspectives (30-100 words each).

**RESOURCE INFORMATION:**
- Type: {{@handleType}}
- Description: {{resourceDescription}}
- Capabilities: {{capabilities}}

**TASK:**
Generate EXACTLY {{glossCount}} glosses describing this resource. Each gloss must strictly follow this format:
- perspective: MUST be one of: "functional" or "use-case" (exactly these words, lowercase)
- description: MUST be 30-100 words (count them!)
- keywords: Array of 3-5 relevant keywords

**IMPORTANT CONSTRAINTS:**
- Use ONLY the exact perspective values: "functional" or "use-case"
- Description MUST be between 30 and 100 words - count the words carefully
- Focus on the resource's purpose and potential uses
- Be descriptive but concise

{{outputPrompt}}