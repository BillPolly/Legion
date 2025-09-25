# DataBasedAgent Design Document

## Overview

DataBasedAgent is a new type of agent that orchestrates the complete lifecycle of data-driven prompt execution. It extracts data from a DataStore, populates prompt templates with that data, executes the prompt via an LLM, and updates the DataStore with the results. All behavior is defined through declarative data specifications rather than imperative code.

## Core Concept

Traditional agents mix data access, prompt logic, and state management in code. DataBasedAgent separates these concerns through three declarative specifications:

1. **Query Specification** - Declares what data to extract from the DataStore
2. **Prompt Template** - Defines the prompt structure with variable placeholders
3. **Update Specification** - Declares how to update the DataStore with results

This creates a clean data flow: `DataStore → Query → Prompt → LLM → Response → Update → DataStore`

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       DataBasedAgent                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │QueryResolver │───▶│PromptPopulator│───▶│UpdateResolver│ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         ▲                    │                    ▼         │
│  ┌──────▼──────┐      ┌─────▼─────┐      ┌──────────────┐ │
│  │  DataStore  │      │ LLMClient │      │  DataStore   │ │
│  └─────────────┘      └───────────┘      └──────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Class Structure

```javascript
class DataBasedAgent {
  constructor({
    name,           // Agent identifier
    querySpec,      // Data extraction specification
    promptTemplate, // Prompt template (string or file path)
    updateSpec,     // Data update specification
    dataStore,      // DataStore instance
    llmClient      // LLM client instance
  })
  
  async execute(context)  // Execute the complete pipeline
}
```

## Query Specification

The query specification defines how to extract data from the DataStore for use in prompt templates.

### Format

```javascript
const querySpec = {
  // Direct entity reference by ID
  variableName: "entityId",
  
  // DataScript query
  variableName: {
    find: ['?attr1', '?attr2'],
    where: [
      ['?entity', ':namespace/attribute', '?value'],
      // ... more clauses
    ],
    in: [['?param', 'value']]  // Optional parameters
  }
}
```

### Variable Resolution

Variables can reference context values using template syntax:

- `"{{context.projectId}}"` - Direct context reference
- `"{{env.API_KEY}}"` - Environment variable reference
- `"{{now}}"` - Special variables (current timestamp)

### Examples

#### Simple Entity Lookup
```javascript
{
  project: "{{context.projectId}}"  // Fetch entity by ID
}
```

#### Complex Query
```javascript
{
  activeFiles: {
    find: ['?path', '?content', '?type'],
    where: [
      ['?file', ':file/project', '{{context.projectId}}'],
      ['?file', ':file/path', '?path'],
      ['?file', ':file/content', '?content'],
      ['?file', ':file/type', '?type'],
      ['?file', ':file/status', 'active']
    ]
  }
}
```

#### Aggregation Query
```javascript
{
  errorCount: {
    find: ['(count ?error)'],
    where: [
      ['?error', ':error/project', '{{context.projectId}}'],
      ['?error', ':error/resolved', false]
    ]
  }
}
```

## Update Specification

The update specification defines how to modify the DataStore based on the LLM response. It supports both simple direct mappings and complex transformations to handle sophisticated data structures and relationships.

### Transform Functions

Transform functions allow complex manipulation of LLM output before it's stored in the DataStore. This enables the LLM to produce data in its most natural format while still mapping correctly to the DataStore schema.

#### Basic Transform Syntax

```javascript
const updateSpec = {
  transform: {
    // Transform functions that process the raw LLM response
    extractedTasks: (response) => {
      // Parse tasks from natural language response
      const taskRegex = /\d+\.\s+(.+?)(?=\d+\.|$)/g;
      const matches = [...response.matchAll(taskRegex)];
      return matches.map(m => m[1].trim());
    },
    
    normalizedScore: (response) => {
      // Convert qualitative assessment to numeric score
      const scoreMap = {
        'excellent': 100,
        'good': 75,
        'fair': 50,
        'poor': 25
      };
      return scoreMap[response.quality] || 0;
    },
    
    structuredData: (response) => {
      // Extract structured data from unstructured text
      const lines = response.split('\n');
      const data = {};
      lines.forEach(line => {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          data[match[1].toLowerCase()] = match[2];
        }
      });
      return data;
    }
  },
  
  // Use transformed values in create/update operations
  create: [{
    type: 'assessment',
    data: {
      ':assessment/score': '{{transform.normalizedScore}}',
      ':assessment/tasks': '{{transform.extractedTasks}}',
      ':assessment/metadata': '{{transform.structuredData}}'
    }
  }]
}
```

#### Complex Transform Pipeline

```javascript
const updateSpec = {
  transform: {
    // Multi-stage transformation pipeline
    parsed: (response) => JSON.parse(response),
    
    entities: (response, { parsed }) => {
      // Access other transforms via context
      return parsed.entities.map(e => ({
        ...e,
        id: generateId(e.name),
        timestamp: Date.now()
      }));
    },
    
    relationships: (response, { parsed, entities }) => {
      // Build relationships from transformed entities
      const relationships = [];
      parsed.relationships.forEach(rel => {
        const source = entities.find(e => e.name === rel.from);
        const target = entities.find(e => e.name === rel.to);
        if (source && target) {
          relationships.push({
            source: source.id,
            target: target.id,
            type: rel.type
          });
        }
      });
      return relationships;
    }
  },
  
  // Create entities and relationships
  create: [
    {
      type: 'batch',
      foreach: '{{transform.entities}}',
      data: {
        ':entity/name': '{{item.name}}',
        ':entity/type': '{{item.type}}',
        ':entity/timestamp': '{{item.timestamp}}'
      }
    },
    {
      type: 'batch',
      foreach: '{{transform.relationships}}',
      data: {
        ':relationship/source': '{{item.source}}',
        ':relationship/target': '{{item.target}}',
        ':relationship/type': '{{item.type}}'
      }
    }
  ]
}
```

#### Built-in Transform Helpers

DataBasedAgent provides common transform utilities:

```javascript
const updateSpec = {
  transform: {
    // Use built-in helpers
    sanitizedText: ['sanitize', '{{response.userInput}}'],
    parsedJson: ['parseJson', '{{response.jsonString}}'],
    extractedUrls: ['extractUrls', '{{response.content}}'],
    summarized: ['summarize', '{{response.longText}}', { maxLength: 200 }],
    classified: ['classify', '{{response.text}}', { categories: ['bug', 'feature', 'question'] }]
  }
}
```

Available built-in transforms:
- `sanitize` - Remove dangerous HTML/scripts
- `parseJson` - Safe JSON parsing with fallback
- `extractUrls` - Extract URLs from text
- `extractEmails` - Extract email addresses
- `summarize` - Create text summary
- `classify` - Categorize text content
- `sentiment` - Analyze sentiment (positive/negative/neutral)
- `tokenize` - Split into tokens/words
- `normalize` - Normalize whitespace and casing

### Basic Format

```javascript
const updateSpec = {
  // Create new entities
  create: [{
    type: 'entityType',
    data: {
      ':namespace/attribute': 'value or {{variable}}'
    }
  }],
  
  // Update existing entities
  update: [{
    entityId: 'id or {{variable}}',
    data: {
      ':namespace/attribute': 'value or {{variable}}'
    }
  }],
  
  // Conditional operations
  conditional: [{
    if: 'condition expression',
    create: { /* create spec */ },
    update: { /* update spec */ }
  }]
}
```

### Variable Resolution

Update specs can reference:

- `{{response.field}}` - Fields from LLM response
- `{{context.field}}` - Original context values
- `{{query.variableName}}` - Results from query phase
- `{{now}}` - Current timestamp
- `{{uuid}}` - Generate UUID

### Examples

#### Simple Create
```javascript
{
  create: [{
    type: 'analysis',
    data: {
      ':analysis/requirement': '{{context.requirementId}}',
      ':analysis/features': '{{response.extractedFeatures}}',
      ':analysis/complexity': '{{response.complexity}}',
      ':analysis/timestamp': '{{now}}'
    }
  }]
}
```

#### Update with Create
```javascript
{
  update: [{
    entityId: '{{context.taskId}}',
    data: {
      ':task/status': 'completed',
      ':task/completedAt': '{{now}}'
    }
  }],
  create: [{
    type: 'result',
    data: {
      ':result/task': '{{context.taskId}}',
      ':result/output': '{{response.output}}',
      ':result/success': '{{response.success}}'
    }
  }]
}
```

### Conditional Transform Logic

Conditional transforms enable dynamic data processing based on LLM response content:

#### Pattern-Based Conditionals

```javascript
const updateSpec = {
  transform: {
    // Conditional transform based on response pattern
    processedData: (response) => {
      // Different processing based on response format
      if (typeof response === 'string' && response.includes('ERROR:')) {
        return {
          type: 'error',
          message: response.replace('ERROR:', '').trim(),
          severity: 'high'
        };
      } else if (response.success === false) {
        return {
          type: 'failure',
          reason: response.reason || 'Unknown',
          severity: 'medium'
        };
      } else {
        return {
          type: 'success',
          data: response.data || response,
          severity: 'low'
        };
      }
    },
    
    // Dynamic field extraction
    extractedFields: (response) => {
      const fields = {};
      
      // Extract different fields based on response type
      if (response.type === 'analysis') {
        fields.complexity = response.metrics?.complexity || 'unknown';
        fields.risks = response.risks || [];
        fields.recommendations = response.recommendations || [];
      } else if (response.type === 'validation') {
        fields.isValid = response.valid === true;
        fields.violations = response.violations || [];
        fields.suggestions = response.fixes || [];
      }
      
      return fields;
    }
  },
  
  // Use conditional logic in updates
  conditional: [
    {
      if: 'transform.processedData.type === "error"',
      create: {
        type: 'error',
        data: {
          ':error/message': '{{transform.processedData.message}}',
          ':error/severity': '{{transform.processedData.severity}}',
          ':error/timestamp': '{{now}}'
        }
      }
    },
    {
      if: 'transform.processedData.type === "success"',
      update: {
        entityId: '{{context.taskId}}',
        data: {
          ':task/status': 'completed',
          ':task/result': '{{transform.processedData.data}}'
        }
      }
    }
  ]
}
```

#### Validation-Based Transforms

```javascript
const updateSpec = {
  transform: {
    // Validate and clean data before storage
    validatedEmail: (response) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const email = response.email?.trim().toLowerCase();
      return emailRegex.test(email) ? email : null;
    },
    
    validatedPhone: (response) => {
      const phone = response.phone?.replace(/\D/g, '');
      return phone?.length === 10 ? phone : null;
    },
    
    // Transform with fallback logic
    safeCategory: (response) => {
      const validCategories = ['bug', 'feature', 'enhancement', 'documentation'];
      const category = response.category?.toLowerCase();
      return validCategories.includes(category) ? category : 'uncategorized';
    },
    
    // Compute derived values
    priority: (response) => {
      if (response.severity === 'critical' && response.impact === 'high') {
        return 'P1';
      } else if (response.severity === 'high' || response.impact === 'high') {
        return 'P2';
      } else if (response.severity === 'medium' || response.impact === 'medium') {
        return 'P3';
      } else {
        return 'P4';
      }
    }
  },
  
  create: [{
    type: 'issue',
    data: {
      ':issue/email': '{{transform.validatedEmail}}',
      ':issue/phone': '{{transform.validatedPhone}}',
      ':issue/category': '{{transform.safeCategory}}',
      ':issue/priority': '{{transform.priority}}'
    }
  }]
}
```

#### Aggregation Transforms

```javascript
const updateSpec = {
  transform: {
    // Aggregate multiple response fields
    summary: (response) => {
      const counts = {
        total: 0,
        errors: 0,
        warnings: 0,
        successes: 0
      };
      
      response.results?.forEach(result => {
        counts.total++;
        if (result.status === 'error') counts.errors++;
        else if (result.status === 'warning') counts.warnings++;
        else if (result.status === 'success') counts.successes++;
      });
      
      return counts;
    },
    
    // Group and restructure data
    groupedByType: (response) => {
      const groups = {};
      
      response.items?.forEach(item => {
        const type = item.type || 'unknown';
        if (!groups[type]) groups[type] = [];
        groups[type].push(item);
      });
      
      return groups;
    },
    
    // Calculate metrics
    metrics: (response) => {
      const items = response.items || [];
      return {
        count: items.length,
        avgScore: items.reduce((sum, item) => sum + (item.score || 0), 0) / items.length,
        maxScore: Math.max(...items.map(item => item.score || 0)),
        minScore: Math.min(...items.map(item => item.score || 0))
      };
    }
  }
}
```

#### Conditional Operations

```javascript
{
  conditional: [
    {
      if: '{{response.errors.length}} > 0',
      create: {
        type: 'error',
        data: {
          ':error/message': '{{response.errors[0].message}}',
          ':error/task': '{{context.taskId}}',
          ':error/timestamp': '{{now}}'
        }
      },
      update: {
        entityId: '{{context.taskId}}',
        data: {
          ':task/status': 'failed'
        }
      }
    },
    {
      if: '{{response.warnings.length}} > 0',
      create: {
        type: 'warning',
        data: {
          ':warning/message': '{{response.warnings[0]}}',
          ':warning/task': '{{context.taskId}}'
        }
      }
    }
  ]
}
```

## Prompt Template Integration

DataBasedAgent integrates with the existing PromptLoader system, supporting both inline templates and file-based templates. The template system uses Handlebars, providing full support for loops, conditionals, and object navigation.

### Inline Template
```javascript
const agent = new DataBasedAgent({
  promptTemplate: `
Analyze the following project:
Name: {{project.name}}
Type: {{project.type}}

Files:
{{#each activeFiles}}
- {{this.path}} ({{this.type}})
{{/each}}

Provide a complexity assessment.
`,
  // ... other config
});
```

### Handlebars Features

The template system supports all standard Handlebars features:

```handlebars
{{! Simple variable substitution }}
Project: {{project.name}}

{{! Object property access }}
Type: {{project.type}}
Status: {{task.status}}

{{! Loops }}
{{#each files}}
  - {{this.path}}: {{this.content}}
{{/each}}

{{! Conditionals }}
{{#if errors}}
  Errors found:
  {{#each errors}}
    - {{this.message}}
  {{/each}}
{{else}}
  No errors found.
{{/if}}

{{! Array access }}
First error: {{errors.[0].message}}

{{! Built-in helpers }}
Total files: {{files.length}}
```

### Custom Helpers for DataBasedAgent

DataBasedAgent can register custom Handlebars helpers for common data operations:

```javascript
// Custom helpers for data formatting
Handlebars.registerHelper('json', (value) => JSON.stringify(value, null, 2));
Handlebars.registerHelper('first', (array) => array?.[0]);
Handlebars.registerHelper('last', (array) => array?.[array.length - 1]);
Handlebars.registerHelper('count', (array) => array?.length || 0);
Handlebars.registerHelper('truncate', (str, len) => str?.substring(0, len) + '...');
```

Usage in templates:
```handlebars
{{! Format as JSON }}
Data: {{json queryResults}}

{{! Get first/last items }}
First file: {{first files}}
Latest error: {{last errors}}

{{! Count items }}
Total issues: {{count issues}}

{{! Truncate long strings }}
Summary: {{truncate description 100}}
```

### File-Based Template
```javascript
const agent = new DataBasedAgent({
  promptTemplate: 'prompts/analyze-project.md',
  // ... other config
});
```

The prompt file can include YAML frontmatter with response schema:

```markdown
---
name: analyze-project
description: Analyzes project complexity
responseSchema:
  type: object
  properties:
    complexity:
      type: string
      enum: [simple, moderate, complex]
    fileCount:
      type: number
    issues:
      type: array
---

Analyze this project...
```

## Complete Working Example

### Scenario: Code Review Agent

```javascript
// Define the agent
const codeReviewAgent = new DataBasedAgent({
  name: 'code-reviewer',
  
  // Extract recent files for review
  querySpec: {
    project: '{{context.projectId}}',
    recentFiles: {
      find: ['?id', '?path', '?content'],
      where: [
        ['?file', ':file/project', '{{context.projectId}}'],
        ['?file', ':file/modified', '?modified'],
        ['?file', ':file/path', '?path'],
        ['?file', ':file/content', '?content'],
        ['?file', ':db/id', '?id'],
        [(new Date() - '?modified'), '<', 3600000]  // Last hour
      ]
    },
    existingIssues: {
      find: ['?message'],
      where: [
        ['?error', ':error/project', '{{context.projectId}}'],
        ['?error', ':error/resolved', false],
        ['?error', ':error/message', '?message']
      ]
    }
  },
  
  // Prompt template
  promptTemplate: `
Review the following code files from project "{{project.name}}":

{{#each recentFiles}}
File: {{this.path}}
\`\`\`javascript
{{this.content}}
\`\`\`
{{/each}}

Known issues:
{{#each existingIssues}}
- {{this.message}}
{{/each}}

Identify any code quality issues, bugs, or improvements needed.

Respond with JSON:
{
  "issues": [
    {
      "fileId": "file entity ID",
      "line": "line number or null",
      "severity": "error|warning|info",
      "message": "description of issue"
    }
  ],
  "suggestions": ["improvement suggestions"],
  "overallQuality": "poor|fair|good|excellent"
}
`,
  
  // Update specification
  updateSpec: {
    create: [
      {
        type: 'assessment',
        data: {
          ':assessment/project': '{{context.projectId}}',
          ':assessment/score': '{{response.overallQuality}}',
          ':assessment/timestamp': '{{now}}',
          ':assessment/issues': '{{response.issues.length}}'
        }
      }
    ],
    conditional: [
      {
        if: '{{response.issues.length}} > 0',
        create: {
          type: 'batch',
          foreach: '{{response.issues}}',
          data: {
            ':error/file': '{{item.fileId}}',
            ':error/line': '{{item.line}}',
            ':error/severity': '{{item.severity}}',
            ':error/message': '{{item.message}}',
            ':error/project': '{{context.projectId}}',
            ':error/resolved': false,
            ':error/timestamp': '{{now}}'
          }
        }
      }
    ],
    update: [
      {
        entityId: '{{context.projectId}}',
        data: {
          ':project/lastReview': '{{now}}',
          ':project/qualityScore': '{{response.overallQuality}}'
        }
      }
    ]
  },
  
  dataStore: dataStore,
  llmClient: llmClient
});

// Execute the agent
const result = await codeReviewAgent.execute({
  projectId: 12345  // Entity ID of project to review
});

// Result contains the LLM response
// DataStore has been updated with assessment, errors, and project updates
```

## API Reference

### DataBasedAgent Constructor

```javascript
new DataBasedAgent({
  name: string,           // Unique agent identifier
  querySpec: object,      // Query specification
  promptTemplate: string, // Template string or file path
  updateSpec: object,     // Update specification
  dataStore: DataStore,   // DataStore instance
  llmClient: LLMClient   // LLM client instance
})
```

### execute(context)

Execute the agent's complete pipeline.

**Parameters:**
- `context`: Object containing contextual data for variable resolution

**Returns:**
- Promise resolving to the LLM response object

**Throws:**
- `QueryError`: If query execution fails
- `PromptError`: If prompt population fails
- `LLMError`: If LLM execution fails
- `UpdateError`: If DataStore update fails

### Query Specification Schema

```typescript
type QuerySpec = {
  [variableName: string]: string | DataScriptQuery
}

type DataScriptQuery = {
  find: Array<string>,
  where: Array<Array<any>>,
  in?: Array<Array<any>>
}
```

### Update Specification Schema

```typescript
type UpdateSpec = {
  create?: Array<CreateOp>,
  update?: Array<UpdateOp>,
  conditional?: Array<ConditionalOp>
}

type CreateOp = {
  type: string,
  data: { [attribute: string]: any },
  foreach?: string  // For batch operations
}

type UpdateOp = {
  entityId: string | number,
  data: { [attribute: string]: any }
}

type ConditionalOp = {
  if: string,  // Condition expression
  create?: CreateOp,
  update?: UpdateOp
}
```

## Integration with Existing Systems

### With ROMA Agent Strategies

Strategies can create and execute DataBasedAgents:

```javascript
// In SimpleNodeServerStrategy
const analysisAgent = new DataBasedAgent({
  name: 'requirements-analyzer',
  querySpec: { /* ... */ },
  promptTemplate: 'prompts/analyze-requirements.md',
  updateSpec: { /* ... */ },
  dataStore: this.context.dataStore,
  llmClient: this.config.llmClient
});

const analysis = await analysisAgent.execute({
  projectId: this.context.projectId,
  taskId: this.taskId
});
```

### With ProjectManagerStrategy

ProjectManagerStrategy owns the DataStore and creates agents:

```javascript
class ProjectManagerStrategy {
  async doWork() {
    // Create DataStore
    this.dataStore = new DataStore(combinedSchema);
    
    // Create project entity
    const { entityId: projectId } = this.dataStore.createEntity({
      ':project/name': this.description,
      ':project/type': 'webapp',
      ':project/status': 'planning'
    });
    
    // Create planning agent
    const planningAgent = new DataBasedAgent({
      querySpec: { project: projectId },
      promptTemplate: 'prompts/create-plan.md',
      updateSpec: { /* ... */ },
      dataStore: this.dataStore,
      llmClient: this.llmClient
    });
    
    // Execute planning
    await planningAgent.execute({ projectId });
    
    // Delegate to child strategies with DataStore context
    // ...
  }
}
```

### With DataStore Proxies

Agents can work with proxied DataStores for isolation:

```javascript
// Create a proxied view of the DataStore
const projectProxy = new EntityProxy(dataStore, projectId);
const filesProxy = new CollectionProxy(dataStore, filesQuery);

// Create agent with proxied store
const agent = new DataBasedAgent({
  querySpec: { /* queries run against proxy */ },
  promptTemplate: template,
  updateSpec: { /* updates go through proxy */ },
  dataStore: filesProxy,  // Limited view of data
  llmClient: llmClient
});
```

## Error Handling

DataBasedAgent provides detailed error information for debugging:

```javascript
try {
  await agent.execute(context);
} catch (error) {
  if (error instanceof QueryError) {
    console.error('Query failed:', error.query, error.cause);
  } else if (error instanceof UpdateError) {
    console.error('Update failed:', error.operation, error.cause);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.errors);
  }
}
```

## Transaction Support

All updates within a single agent execution are transactional:

```javascript
// All these operations succeed or fail together
updateSpec: {
  create: [/* multiple entities */],
  update: [/* multiple updates */]
}
// If any operation fails, all are rolled back
```

## Summary

DataBasedAgent provides a clean, declarative way to orchestrate data-driven AI agents. By separating data access, prompt execution, and state updates into declarative specifications, it creates maintainable, testable, and reusable agent components that integrate seamlessly with the existing DataStore and prompt management systems.