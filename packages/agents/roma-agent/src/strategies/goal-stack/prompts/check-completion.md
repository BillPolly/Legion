---
name: check-completion
description: Check if a predicate condition is satisfied
variables:
  - predicate
  - evidence
  - context
responseSchema:
  type: object
  properties:
    satisfied:
      type: boolean
      description: Whether the condition is satisfied
    reasoning:
      type: string
      description: Explanation of the decision
  required: [satisfied, reasoning]
---

Check if this condition is satisfied based on the evidence.

Predicate: {{predicate}}
Evidence: {{evidence}}
Context: {{context}}

Determine if the predicate is true given the evidence and context.