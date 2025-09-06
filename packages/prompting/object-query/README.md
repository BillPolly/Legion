# @legion/object-query

Intelligent data extraction from root objects using JSON query definitions.

This package provides powerful data extraction capabilities, transforming complex nested objects into prepared labeled inputs ready for prompt-builder processing. It serves as the data preparation layer in the Legion prompting pipeline.

## Key Features

- **JSON Query Language**: Declarative syntax for data extraction specifications
- **Smart Path Traversal**: Deep object navigation with array handling and wildcards
- **Data Transformations**: Summarization, filtering, and content processing
- **Binding Generation**: Produces labeled inputs with proper names
- **Context Variables**: Extracts named variables for LLM reference
- **Conditional Logic**: Extract different data based on object state
- **Legion Integration**: Seamless work with prompt-builder and output-schema

## Quick Start

```javascript
import { ObjectQuery } from '@legion/object-query';

// Define query specification
const querySpec = {
  bindings: {
    userProfile: {
      path: "user.profile",
      transform: "summary",
      maxLength: 100
    },
    recentChats: {
      path: "conversation.messages",
      transform: "recent",
      maxItems: 10
    },
    codeFiles: {
      path: "project.files",
      filter: "*.js",
      transform: "concatenate"
    }
  },
  contextVariables: {
    userGoals: { path: "user.objectives" },
    techStack: { path: "project.technologies" }
  }
};

// Create query processor
const query = new ObjectQuery(querySpec);

// Execute on root object
const labeledInputs = query.execute(rootDataObject);

// Result ready for prompt-builder
// { userProfile: "...", recentChats: [...], codeFiles: "...", userGoals: "...", techStack: "..." }
```

## Documentation

See the [Design Document](./docs/DESIGN.md) for comprehensive specifications and examples.