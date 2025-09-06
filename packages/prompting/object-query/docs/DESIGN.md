# Object-Query Design Document

## Overview

The `@legion/object-query` package provides intelligent data extraction from complex root objects using declarative JSON query definitions. This package serves as the data preparation layer in the Legion prompting pipeline, transforming nested data structures into labeled inputs ready for prompt-builder processing.

### Problem Statement

Modern LLM applications work with complex, nested data structures:
- **User profiles** with deep object hierarchies
- **Chat histories** with hundreds of messages and metadata
- **Code projects** with multiple files and complex structures
- **Context data** scattered across different object branches

Preparing this data for prompt generation requires:
- **Intelligent selection** of relevant information
- **Smart summarization** of large content
- **Flexible extraction** from various object structures
- **Binding generation** with proper naming for prompt placeholders

### Solution Approach

An `ObjectQuery` processor that:
1. **Takes JSON query definitions** specifying what to extract
2. **Traverses complex objects** using flexible path syntax
3. **Applies smart transformations** (summarization, filtering, formatting)
4. **Generates labeled inputs** ready for prompt-builder consumption
5. **Handles context variables** for LLM reference

## Core Concepts

### JSON Query Language

Declarative query specifications using JSON syntax:

```javascript
const querySpec = {
  bindings: {
    bindingName: {
      path: "object.path.to.data",
      transform: "transformationType",
      options: { /* transformation options */ }
    }
  },
  contextVariables: {
    varName: { path: "path.to.context.data" }
  },
  conditions: {
    // Conditional extraction rules
  }
};
```

### Path Traversal System

**Flexible Path Syntax:**
- `user.profile.name` - Simple object navigation
- `messages[0].content` - Array index access
- `files[-3:]` - Array slicing (last 3 items)
- `*.content` - Wildcard matching across object/array items
- `conversations.**.mentions` - Deep recursive search
- `messages[type='user'].content` - Conditional filtering

### Data Transformations

**Smart Content Processing:**
- `summary` - Intelligent content summarization
- `recent` - Select most recent items from arrays
- `concatenate` - Combine multiple values
- `filter` - Apply filtering rules
- `passthrough` - Use value without modification
- `format` - Apply formatting rules
- `prioritize` - Order by importance/relevance

### Binding Generation

**Labeled Input Creation:**
- Extract data according to query specification
- Apply transformations and constraints
- Generate properly named bindings for prompt placeholders
- Include context variables for LLM reference

## API Design

### Core Class

#### ObjectQuery

Main interface for data extraction:

```javascript
class ObjectQuery {
  constructor(querySpecification)
  
  // MAIN FUNCTION: Execute query on root object
  execute(rootObject, options = {})
  
  // UTILITIES
  validateQuery(querySpec)         // Validate query specification
  analyzeObject(rootObject)        // Analyze object structure
  estimateExtractionSize()         // Estimate result size
  getRequiredPaths()              // Get all paths referenced in query
}
```

**Constructor Query Specification:**
```javascript
{
  bindings: {                      // Data extraction definitions
    bindingName: {
      path: "object.path",         // Path to extract data
      transform: "summary",        // Transformation to apply
      maxLength: 500,             // Size constraints
      required: true,             // Whether binding is required
      fallback: "default value"  // Fallback if path not found
    }
  },
  contextVariables: {             // Context variable definitions
    varName: {
      path: "path.to.data",
      description: "Variable description for LLM"
    }
  },
  globalOptions: {                // Global processing options
    maxTotalSize: 10000,         // Maximum total extraction size
    summarizationStrategy: "intelligent",
    errorHandling: "skip" | "error" | "fallback"
  }
}
```

**execute() Options:**
```javascript
{
  strict: false,                  // Strict path validation
  includeMetadata: false,         // Include extraction metadata
  dryRun: false,                 // Validate without extracting
  prioritizeBindings: ['binding1', ...], // Priority order
  maxIterations: 1000           // Prevent infinite loops in wildcards
}
```

### Supporting Classes

#### PathTraversal

Advanced path navigation:

```javascript
class PathTraversal {
  static traverse(object, path, options = {})
  static validatePath(path)
  static expandWildcards(object, path)
  static applySlicing(array, sliceNotation)
  static conditionalFilter(array, condition)
}
```

#### DataTransformations

Content processing and transformation:

```javascript
class DataTransformations {
  static summary(content, options = {})
  static recent(array, count = 10)
  static concatenate(items, separator = '\n')
  static filter(items, criteria)
  static prioritize(items, strategy)
  static format(content, formatType)
}
```

#### QueryProcessor

Query execution engine:

```javascript
class QueryProcessor {
  constructor(querySpec)
  
  processBinding(bindingDef, rootObject)
  processContextVariable(varDef, rootObject)
  validateBindingResult(result, bindingDef)
  applyTransformations(data, transformDef)
}
```

## Path Syntax Specification

### Basic Path Navigation

```javascript
// Simple object traversal
"user.profile.name"              // → "John Doe"
"user.settings.preferences"      // → { theme: "dark", ... }

// Array access
"messages[0]"                    // → First message
"messages[-1]"                   // → Last message
"users[1].name"                  // → Name of second user
```

### Advanced Path Features

```javascript
// Array slicing
"messages[-10:]"                 // → Last 10 messages
"files[0:5]"                    // → First 5 files
"conversations[2:-2]"           // → All except first 2 and last 2

// Wildcard matching
"*.name"                        // → All name properties at current level
"files.*.content"               // → Content of all files
"messages.*.author.name"        // → All message author names

// Deep search
"conversations.**.mentions"     // → All mentions in any conversation level
"project.**.dependencies"       // → All dependencies at any depth

// Conditional filtering
"messages[type='user']"         // → Only user messages
"files[extension='js']"         // → Only JavaScript files
"users[role='admin'].email"     // → Admin user emails
```

### Path Options

```javascript
{
  path: "messages[-20:]",
  pathOptions: {
    filterEmpty: true,            // Skip empty/null values
    unique: true,                // Remove duplicates
    sortBy: "timestamp",         // Sort results
    sortOrder: "desc"            // Descending order
  }
}
```

## Data Transformation System

### Summary Transformation

**Intelligent Content Summarization:**

```javascript
// Configuration
{
  transform: "summary",
  options: {
    maxLength: 300,              // Target summary length
    preserveStructure: true,     // Maintain document structure
    extractKeyPoints: true,      // Highlight important information
    includeExamples: false      // Include/exclude examples
  }
}

// Processing Logic
1. Analyze content structure and identify main topics
2. Extract key points and important information
3. Preserve critical context and relationships
4. Compress to target length while maintaining coherence
```

### Recent Transformation

**Smart Recent Item Selection:**

```javascript
// Configuration
{
  transform: "recent",
  options: {
    count: 10,                  // Number of items to select
    timeField: "timestamp",     // Field to use for recency
    prioritizeImportant: true,  // Weight important items higher
    includeContext: true       // Add context from older items
  }
}

// Processing Logic
1. Sort items by recency (timestamp or position)
2. Select most recent N items
3. Optionally include context from older items
4. Preserve conversation flow and coherence
```

### Concatenate Transformation

**Intelligent Content Combination:**

```javascript
// Configuration
{
  transform: "concatenate",
  options: {
    separator: "\n\n",          // Separator between items
    maxTotalLength: 1000,       // Maximum combined length
    preserveHeaders: true,      // Include item headers
    addIndex: true             // Number items
  }
}

// Processing Logic
1. Combine multiple content pieces intelligently
2. Add appropriate separators and formatting
3. Include headers or indices for clarity
4. Apply size constraints with smart truncation
```

### Filter Transformation

**Advanced Filtering Capabilities:**

```javascript
// Configuration
{
  transform: "filter", 
  options: {
    criteria: {
      type: "user",              // Simple equality
      timestamp: { gte: "2024-01-01" }, // Comparison operators
      content: { contains: "error" },    // Text matching
      author: { in: ["john", "jane"] }   // Set membership
    },
    limit: 50,                   // Maximum results
    sortBy: "relevance"         // Sort filtered results
  }
}
```

## Query Specification Examples

### Web Development Context Query

```javascript
const webDevQuery = {
  bindings: {
    projectOverview: {
      path: "project.description", 
      transform: "summary",
      maxLength: 200
    },
    currentCode: {
      path: "project.files",
      filter: { extension: "js" },
      transform: "concatenate", 
      options: {
        maxFiles: 5,
        includeHeaders: true,
        preserveStructure: true
      }
    },
    chatHistory: {
      path: "conversation.messages",
      transform: "recent",
      options: {
        count: 8,
        summarizeOlder: true,
        preserveUserIntent: true
      }
    },
    requirements: {
      path: "task.requirements",
      transform: "passthrough"
    },
    outputInstructions: {
      value: outputSchemaInstructions, // Direct value
      transform: "passthrough"
    }
  },
  contextVariables: {
    techStack: { 
      path: "project.technologies",
      description: "Technology stack being used"
    },
    userGoals: {
      path: "user.objectives", 
      description: "User's project goals"
    },
    timeline: {
      path: "project.deadline",
      description: "Project timeline and deadlines"
    }
  }
}
```

### Code Review Context Query

```javascript
const codeReviewQuery = {
  bindings: {
    sourceCode: {
      path: "review.targetFile.content",
      transform: "passthrough" // Code needs no transformation
    },
    relatedFiles: {
      path: "review.relatedFiles", 
      transform: "concatenate",
      options: {
        maxFiles: 3,
        includeHeaders: true,
        maxLinesPerFile: 30
      }
    },
    reviewHistory: {
      path: "review.previousComments",
      transform: "recent",
      options: {
        count: 5,
        prioritizeByAuthor: "user"
      }
    },
    staticAnalysis: {
      path: "review.analysis.issues",
      transform: "prioritize",
      options: {
        orderBy: "severity",
        maxIssues: 10
      }
    }
  },
  contextVariables: {
    reviewFocus: { path: "review.focusAreas" },
    codeStandards: { path: "project.codingStandards" }
  }
}
```

### User Support Context Query

```javascript
const supportQuery = {
  bindings: {
    userIssue: {
      path: "ticket.description",
      transform: "passthrough"
    },
    userContext: {
      path: "user",
      transform: "summary",
      options: {
        includeFields: ["plan", "usage", "preferences"],
        maxLength: 150
      }
    },
    chatHistory: {
      path: "conversation.messages",
      transform: "recent",
      options: {
        count: 12,
        includeSystemMessages: false
      }
    },
    relatedTickets: {
      path: "user.recentTickets",
      filter: { status: "resolved", similarity: { gte: 0.7 } },
      transform: "summarize",
      options: { maxTickets: 3 }
    },
    systemStatus: {
      path: "system.status",
      transform: "passthrough"
    }
  },
  contextVariables: {
    userTier: { path: "user.subscription.tier" },
    systemHealth: { path: "system.health.overall" }
  }
}
```

## Advanced Query Features

### Conditional Extraction

**Dynamic Data Selection:**

```javascript
{
  bindings: {
    codeContext: {
      conditions: [
        {
          if: { path: "request.type", equals: "debug" },
          then: { 
            path: "logs.errors[-50:]",
            transform: "concatenate"
          }
        },
        {
          if: { path: "request.type", equals: "review" },
          then: {
            path: "code.files",
            transform: "concatenate",
            options: { maxFiles: 3 }
          }
        },
        {
          else: {
            path: "project.overview",
            transform: "summary"
          }
        }
      ]
    }
  }
}
```

### Dependency Management

**Inter-Binding Dependencies:**

```javascript
{
  bindings: {
    userLevel: {
      path: "user.experience.level" // Extract first
    },
    documentation: {
      path: "docs",
      transform: "filter",
      options: {
        difficulty: { dependsOn: "userLevel" }, // Use previous binding
        maxComplexity: "{{userLevel}}"          // Reference syntax
      }
    }
  }
}
```

### Aggregation Operations

**Multi-Source Data Combination:**

```javascript
{
  bindings: {
    projectSummary: {
      aggregate: [
        { path: "project.description", weight: 0.4 },
        { path: "project.goals", weight: 0.3 },
        { path: "project.constraints", weight: 0.3 }
      ],
      transform: "summary",
      maxLength: 250
    }
  }
}
```

## Data Transformation Algorithms

### Intelligent Summarization

**Context-Aware Content Reduction:**

```javascript
// Summary transformation processing
function summarizeContent(content, options) {
  // 1. Analyze content structure
  const structure = analyzeContentStructure(content);
  
  // 2. Extract key information
  const keyPoints = extractKeyPoints(content, structure);
  
  // 3. Preserve critical context
  const criticalContext = preserveCriticalContext(content, keyPoints);
  
  // 4. Generate coherent summary
  const summary = generateCoherentSummary(keyPoints, criticalContext, options);
  
  // 5. Validate and optimize
  return validateAndOptimize(summary, options);
}
```

### Smart Array Processing

**Intelligent Item Selection:**

```javascript
// Recent transformation for arrays
function selectRecentItems(items, options) {
  // 1. Sort by recency or position
  const sorted = sortByRecency(items, options.timeField);
  
  // 2. Select target count
  const recent = sorted.slice(0, options.count);
  
  // 3. Add context from older items if requested
  if (options.includeContext) {
    const context = generateContextFromOlder(sorted.slice(options.count));
    return { recent, context };
  }
  
  return recent;
}
```

### Code-Specific Processing

**Syntax-Aware Code Handling:**

```javascript
// Code transformation
function processCodeContent(files, options) {
  // 1. Filter by file type/extension
  const filteredFiles = filterByType(files, options.filter);
  
  // 2. Analyze code structure and dependencies
  const analyzed = analyzeCodeStructure(filteredFiles);
  
  // 3. Prioritize important files/functions
  const prioritized = prioritizeByImportance(analyzed, options);
  
  // 4. Concatenate with proper headers and formatting
  return concatenateWithHeaders(prioritized, options);
}
```

## Error Handling and Validation

### Path Validation

**Robust Path Processing:**
- Validate path syntax at query creation time
- Handle missing paths gracefully with fallbacks
- Provide clear error messages for invalid paths
- Support optional vs required bindings

### Data Validation

**Content Quality Assurance:**
- Validate extracted data types match expectations
- Check for empty or null extraction results
- Verify transformation results are valid
- Ensure binding names are properly formatted

### Error Recovery Strategies

**Graceful Failure Handling:**
- Skip failed bindings with warnings
- Use fallback values when primary paths fail
- Provide partial results when some extractions fail
- Clear error reporting for debugging

## Integration with Legion Framework

### Prompt-Builder Integration

**Seamless Pipeline Integration:**

```javascript
// Complete pipeline example
const query = new ObjectQuery(querySpec);
const labeledInputs = query.execute(rootObject);

const promptBuilder = new PromptBuilder({
  template: promptTemplate,
  maxTokens: 4000
});

const prompt = promptBuilder.build(labeledInputs);
```

### Output-Schema Integration

**Response Validation Chain:**

```javascript
// Query extracts data → Prompt-Builder formats → Output-Schema validates
const labeledInputs = query.execute(rootObject);
labeledInputs.outputInstructions = responseValidator.generateInstructions(exampleData);

const prompt = promptBuilder.build(labeledInputs);
const response = await llm.complete(prompt);
const result = responseValidator.process(response);
```

### ResourceManager Compatibility

**Legion Framework Integration:**

```javascript
// Access via ResourceManager
const resourceManager = await ResourceManager.getInstance();
const ObjectQuery = resourceManager.get('ObjectQuery');

// Configuration from environment
const defaultConfig = resourceManager.get('objectQueryDefaults');
```

## Usage Examples

### Basic Data Extraction

```javascript
import { ObjectQuery } from '@legion/object-query';

// Root object with complex nested data
const rootObject = {
  user: {
    profile: { name: "John Developer", role: "Senior Engineer" },
    preferences: { theme: "dark", notifications: true },
    activity: {
      recent: [
        { action: "code_review", timestamp: "2024-01-15T10:30:00Z" },
        { action: "commit", timestamp: "2024-01-15T09:15:00Z" }
      ]
    }
  },
  project: {
    name: "E-commerce Platform",
    files: [
      { name: "UserService.js", content: "class UserService { ... }" },
      { name: "ProductService.js", content: "class ProductService { ... }" }
    ],
    technologies: ["React", "Node.js", "MongoDB"]
  },
  conversation: {
    messages: [
      { role: "user", content: "Can you help me optimize the UserService?", timestamp: "2024-01-15T10:00:00Z" },
      { role: "assistant", content: "I'll analyze the code for optimization opportunities", timestamp: "2024-01-15T10:01:00Z" }
    ]
  }
};

// Query specification
const querySpec = {
  bindings: {
    userContext: {
      path: "user.profile",
      transform: "summary",
      maxLength: 100
    },
    codeFiles: {
      path: "project.files",
      filter: { extension: "js" },
      transform: "concatenate",
      options: { maxFiles: 3, includeHeaders: true }
    },
    chatHistory: {
      path: "conversation.messages",
      transform: "recent",
      options: { count: 5 }
    }
  },
  contextVariables: {
    techStack: { path: "project.technologies" },
    userRole: { path: "user.profile.role" }
  }
};

// Execute query
const query = new ObjectQuery(querySpec);
const labeledInputs = query.execute(rootObject);

console.log(labeledInputs);
// Result:
// {
//   userContext: "Senior Engineer John Developer with dark theme preferences",
//   codeFiles: "UserService.js:\nclass UserService { ... }\n\nProductService.js:\nclass ProductService { ... }",
//   chatHistory: [...recent messages],
//   techStack: "React, Node.js, MongoDB",
//   userRole: "Senior Engineer"
// }
```

### Complex Web Development Query

```javascript
const complexWebQuery = {
  bindings: {
    projectContext: {
      aggregate: [
        { path: "project.description", weight: 0.4 },
        { path: "project.requirements", weight: 0.4 },
        { path: "project.constraints", weight: 0.2 }
      ],
      transform: "summary",
      maxLength: 300
    },
    activeCode: {
      path: "workspace.openFiles",
      filter: { modified: { gte: "today" } },
      transform: "concatenate",
      options: {
        maxFiles: 4,
        maxLinesPerFile: 50,
        prioritizeByActivity: true
      }
    },
    userFeedback: {
      path: "conversation.messages",
      filter: { role: "user", type: "feedback" },
      transform: "recent",
      options: { count: 6 }
    },
    errorLogs: {
      conditions: [
        {
          if: { path: "task.type", equals: "debug" },
          then: {
            path: "logs.errors[-20:]",
            transform: "concatenate"
          }
        },
        {
          else: { value: null }
        }
      ]
    },
    performanceData: {
      path: "monitoring.performance",
      transform: "filter",
      options: {
        metrics: ["responseTime", "memoryUsage", "errorRate"],
        timeframe: "last24hours"
      }
    }
  },
  contextVariables: {
    currentSprint: { path: "project.currentSprint" },
    teamSize: { path: "team.members.length" },
    deploymentEnv: { path: "infrastructure.environment" }
  }
}
```

### Chat-Driven Development Query

```javascript
const chatDrivenQuery = {
  bindings: {
    conversationFlow: {
      path: "conversation.messages",
      transform: "intelligent_selection",
      options: {
        maxMessages: 12,
        preserveUserQuestions: true,
        includeTechnicalDiscussions: true,
        summarizeRepetitive: true
      }
    },
    codeEvolution: {
      path: "codeChanges.history",
      transform: "recent",
      options: {
        count: 5,
        includeCommitMessages: true,
        showDiffs: false // Too verbose for prompts
      }
    },
    userIntent: {
      path: "conversation.extractedIntent",
      transform: "summary",
      maxLength: 150
    },
    technicalContext: {
      aggregate: [
        { path: "project.architecture", weight: 0.3 },
        { path: "project.dependencies", weight: 0.3 },
        { path: "project.constraints", weight: 0.4 }
      ],
      transform: "summary",
      maxLength: 200
    }
  },
  contextVariables: {
    userExperience: { path: "user.skillLevel" },
    projectPhase: { path: "project.phase" },
    urgency: { path: "task.urgency" }
  }
}
```

## Performance and Optimization

### Efficient Object Traversal

**Optimized Path Processing:**
- Lazy evaluation of paths (only traverse when needed)
- Caching of frequently accessed paths
- Efficient wildcard expansion algorithms
- Minimal memory footprint for large objects

### Smart Content Processing

**Intelligent Resource Management:**
- Progressive loading for large content
- Streaming processing for massive arrays
- Incremental summarization algorithms
- Memory-efficient transformation pipelines

### Query Optimization

**Performance Enhancements:**
- Query plan analysis and optimization
- Path dependency resolution
- Parallel processing of independent bindings
- Result caching for repeated queries

## Architecture Integration

### Data Flow Pipeline

```
Complex Root Object → Object Query → Labeled Inputs → Prompt Builder → Optimized Prompt → LLM → Output Schema → Validated Response
```

### Package Responsibilities

**Clear Separation of Concerns:**
- **Object-Query**: Data extraction and preparation (THIS PACKAGE)
- **Prompt-Builder**: Template processing and intelligent formatting
- **Output-Schema**: Response validation and parsing
- **Prompt-Manager**: Complete orchestration with retry logic (FUTURE)

### Configuration Inheritance

**Hierarchical Settings:**
- Global Legion configuration (data access patterns, size limits)
- Package-level defaults (transformation strategies, caching)
- Query-specific settings (extraction rules, binding names)
- Runtime options (execution mode, validation level)

This design creates a powerful data preparation engine that transforms complex nested objects into the exact labeled inputs that prompt-builder needs, completing the intelligent prompting pipeline architecture.