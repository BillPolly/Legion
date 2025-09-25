# DS-Update Design Document

## Overview

DS-Update is a transformation function that converts declarative update specifications combined with input data (typically LLM responses) into DataStore-compatible update objects. It serves as the bridge between natural, flexible LLM outputs and the structured requirements of the DataStore.

## Core Concept

LLMs produce data in their most natural format - often unstructured text, nested JSON, or domain-specific formats. DS-Update transforms this data according to a declarative specification to produce properly formatted DataStore updates.

```
Declarative Spec + Input Data → transformUpdate() → DataStore Update Object
```

## Function Signature

```javascript
/**
 * Transform a declarative update specification with input data into a DataStore update
 * @param {Object} updateSpec - The declarative update specification
 * @param {Object} data - Input data (e.g., LLM response)
 * @param {Object} context - Additional context (query results, original context, etc.)
 * @returns {Object} DataStore-compatible update object
 */
export function transformUpdate(updateSpec, data, context = {}) {
  // Transform logic
}
```

## Examples: Simple to Complex

### Example 1: Simple Direct Mapping

**Input Data (LLM Response):**
```javascript
{
  "summary": "The code has 3 critical issues",
  "score": 65,
  "status": "needs-review"
}
```

**Update Spec:**
```javascript
{
  update: {
    entityId: "{{context.projectId}}",
    data: {
      ":project/summary": "{{response.summary}}",
      ":project/score": "{{response.score}}",
      ":project/status": "{{response.status}}"
    }
  }
}
```

**Output (DataStore Update):**
```javascript
{
  ":db/id": 12345,
  ":project/summary": "The code has 3 critical issues",
  ":project/score": 65,
  ":project/status": "needs-review"
}
```

### Example 2: Simple Transform Operations

**Input Data (LLM Response):**
```javascript
{
  "quality": "excellent",
  "issues": "No major issues found. Code is well-structured."
}
```

**Update Spec:**
```javascript
{
  transform: {
    // Convert qualitative to quantitative using mapping
    score: {
      type: "map",
      input: "{{response.quality}}",
      mapping: {
        "excellent": 100,
        "good": 75,
        "fair": 50,
        "poor": 25
      },
      default: 0
    },
    
    // Extract boolean from text using contains check
    hasIssues: {
      type: "not",
      input: {
        type: "contains",
        text: "{{response.issues}}",
        search: "no major issues",
        caseSensitive: false
      }
    }
  },
  
  update: {
    entityId: "{{context.taskId}}",
    data: {
      ":task/score": "{{transform.score}}",
      ":task/hasIssues": "{{transform.hasIssues}}",
      ":task/reviewNotes": "{{response.issues}}"
    }
  }
}
```

**Output (DataStore Update):**
```javascript
{
  ":db/id": 456,
  ":task/score": 100,
  ":task/hasIssues": false,
  ":task/reviewNotes": "No major issues found. Code is well-structured."
}
```

### Example 3: Parsing Natural Language to Structured Data

**Input Data (LLM Response):**
```javascript
{
  "analysis": "Found 3 bugs:\n1. Memory leak in UserService.js line 45\n2. Null pointer in auth.js line 23\n3. Race condition in data-sync.js line 89\n\nAlso found 2 improvements needed."
}
```

**Update Spec:**
```javascript
{
  transform: {
    // Parse bugs from natural language using regex extraction
    bugs: {
      type: "regex_extract_all",
      input: "{{response.analysis}}",
      pattern: "(\\d+)\\.\\s+(.+?)\\s+in\\s+(\\S+)\\s+line\\s+(\\d+)",
      output: {
        description: "$2",
        file: "$3",
        line: {
          type: "parseInt",
          input: "$4"
        }
      }
    },
    
    // Count statistics
    bugCount: {
      type: "length",
      input: "{{transform.bugs}}"
    },
    
    // Extract improvement count
    improvementCount: {
      type: "regex_extract",
      input: "{{response.analysis}}",
      pattern: "(\\d+)\\s+improvements?\\s+needed",
      capture: 1,
      parseAs: "number",
      default: 0
    }
  },
  
  create: [
    {
      type: "batch",
      foreach: "{{transform.bugs}}",
      data: {
        ":bug/description": "{{item.description}}",
        ":bug/file": "{{item.file}}",
        ":bug/line": "{{item.line}}",
        ":bug/project": "{{context.projectId}}",
        ":bug/severity": "high",
        ":bug/timestamp": "{{now}}"
      }
    },
    {
      type: "single",
      data: {
        ":analysis/project": "{{context.projectId}}",
        ":analysis/bugCount": "{{transform.bugCount}}",
        ":analysis/improvementCount": "{{transform.improvementCount}}",
        ":analysis/rawText": "{{response.analysis}}",
        ":analysis/timestamp": "{{now}}"
      }
    }
  ]
}
```

**Output (DataStore Update):**
```javascript
[
  {
    ":bug/description": "Memory leak",
    ":bug/file": "UserService.js",
    ":bug/line": 45,
    ":bug/project": 123,
    ":bug/severity": "high",
    ":bug/timestamp": 1703001234567
  },
  {
    ":bug/description": "Null pointer",
    ":bug/file": "auth.js",
    ":bug/line": 23,
    ":bug/project": 123,
    ":bug/severity": "high",
    ":bug/timestamp": 1703001234567
  },
  {
    ":bug/description": "Race condition",
    ":bug/file": "data-sync.js",
    ":bug/line": 89,
    ":bug/project": 123,
    ":bug/severity": "high",
    ":bug/timestamp": 1703001234567
  },
  {
    ":analysis/project": 123,
    ":analysis/bugCount": 3,
    ":analysis/improvementCount": 2,
    ":analysis/rawText": "Found 3 bugs:\n1. Memory leak...",
    ":analysis/timestamp": 1703001234567
  }
]
```

### Example 4: Conditional Updates Based on Content

**Input Data (LLM Response):**
```javascript
{
  "testResults": {
    "passed": 45,
    "failed": 5,
    "skipped": 2,
    "errors": ["Timeout in test suite A", "Connection error in integration tests"]
  }
}
```

**Update Spec:**
```javascript
{
  transform: {
    // Calculate success rate
    total: {
      type: "add",
      values: ["{{response.testResults.passed}}", "{{response.testResults.failed}}"]
    },
    successRate: {
      type: "round",
      input: {
        type: "multiply",
        values: [
          {
            type: "divide",
            dividend: "{{response.testResults.passed}}",
            divisor: "{{transform.total}}"
          },
          100
        ]
      }
    },
    
    // Determine status based on results using conditional
    status: {
      type: "conditional",
      conditions: [
        {
          if: { type: "equals", left: "{{response.testResults.failed}}", right: 0 },
          then: "success"
        },
        {
          if: { type: "greater", left: "{{response.testResults.failed}}", right: 10 },
          then: "critical"
        }
      ],
      else: "warning"
    },
    
    // Check if we should create error entities
    hasErrors: {
      type: "and",
      conditions: [
        { type: "exists", value: "{{response.testResults.errors}}" },
        { type: "greater", left: { type: "length", input: "{{response.testResults.errors}}" }, right: 0 }
      ]
    }
  },
  
  update: {
    entityId: "{{context.buildId}}",
    data: {
      ":build/testsPassed": "{{response.testResults.passed}}",
      ":build/testsFailed": "{{response.testResults.failed}}",
      ":build/testsSkipped": "{{response.testResults.skipped}}",
      ":build/successRate": "{{transform.successRate}}",
      ":build/status": "{{transform.status}}"
    }
  },
  
  conditional: [
    {
      if: "transform.hasErrors",
      create: {
        type: "batch",
        foreach: "{{response.testResults.errors}}",
        data: {
          ":error/message": "{{item}}",
          ":error/build": "{{context.buildId}}",
          ":error/type": "test-failure",
          ":error/timestamp": "{{now}}"
        }
      }
    },
    {
      if: "transform.status === 'critical'",
      create: {
        type: "single",
        data: {
          ":alert/type": "build-failure",
          ":alert/severity": "critical",
          ":alert/build": "{{context.buildId}}",
          ":alert/message": "Build has {{response.testResults.failed}} failing tests",
          ":alert/timestamp": "{{now}}"
        }
      }
    }
  ]
}
```

**Output (DataStore Update) when status is 'critical':**
```javascript
[
  {
    ":db/id": 789,
    ":build/testsPassed": 45,
    ":build/testsFailed": 5,
    ":build/testsSkipped": 2,
    ":build/successRate": 90,
    ":build/status": "warning"
  },
  {
    ":error/message": "Timeout in test suite A",
    ":error/build": 789,
    ":error/type": "test-failure",
    ":error/timestamp": 1703001234567
  },
  {
    ":error/message": "Connection error in integration tests",
    ":error/build": 789,
    ":error/type": "test-failure",
    ":error/timestamp": 1703001234567
  }
]
```

### Example 5: Complex Multi-Entity Creation with Relationships

**Input Data (LLM Response):**
```javascript
{
  "projectPlan": {
    "name": "E-Commerce Platform",
    "phases": [
      {
        "name": "Planning",
        "duration": 2,
        "tasks": ["Requirements gathering", "Architecture design", "Tech stack selection"]
      },
      {
        "name": "Development",
        "duration": 8,
        "tasks": ["Backend API", "Frontend UI", "Database design", "Integration"]
      },
      {
        "name": "Testing",
        "duration": 2,
        "tasks": ["Unit tests", "Integration tests", "User acceptance"]
      }
    ],
    "team": {
      "lead": "Alice Johnson",
      "developers": ["Bob Smith", "Carol White"],
      "qa": ["David Brown"]
    }
  }
}
```

**Update Spec:**
```javascript
{
  transform: {
    // Calculate total duration using sum operation
    totalDuration: {
      type: "sum",
      array: "{{response.projectPlan.phases}}",
      field: "duration"
    },
    
    // Flatten all tasks with phase info using map operations
    allTasks: {
      type: "flatMap",
      array: "{{response.projectPlan.phases}}",
      mapper: {
        type: "map",
        array: "{{item.tasks}}",
        mapper: {
          name: "{{subItem}}",
          phase: "{{item.name}}",
          phaseIndex: "{{index}}",
          order: "{{subIndex}}",
          estimatedDuration: {
            type: "round",
            input: {
              type: "multiply",
              values: [
                {
                  type: "divide",
                  dividend: "{{item.duration}}",
                  divisor: { type: "length", input: "{{item.tasks}}" }
                },
                5
              ]
            }
          }
        }
      }
    },
    
    // Create team member list with roles using concat operation
    teamMembers: {
      type: "concat",
      arrays: [
        [{
          name: "{{response.projectPlan.team.lead}}",
          role: "lead"
        }],
        {
          type: "map",
          array: "{{response.projectPlan.team.developers}}",
          mapper: {
            name: "{{item}}",
            role: "developer"
          }
        },
        {
          type: "map",
          array: "{{response.projectPlan.team.qa}}",
          mapper: {
            name: "{{item}}",
            role: "qa"
          }
        }
      ]
    },
    
    // Generate project ID using string template
    projectId: {
      type: "template",
      template: "proj_{{timestamp}}",
      values: {
        timestamp: "{{now}}"
      }
    }
  },
  
  create: [
    // Create the main project
    {
      type: "single",
      data: {
        ":project/id": "{{transform.projectId}}",
        ":project/name": "{{response.projectPlan.name}}",
        ":project/totalDuration": "{{transform.totalDuration}}",
        ":project/phaseCount": "{{response.projectPlan.phases.length}}",
        ":project/status": "planning",
        ":project/createdAt": "{{now}}"
      },
      as: "project"  // Save reference for relationships
    },
    
    // Create phases
    {
      type: "batch",
      foreach: "{{response.projectPlan.phases}}",
      data: {
        ":phase/name": "{{item.name}}",
        ":phase/duration": "{{item.duration}}",
        ":phase/project": "{{refs.project}}",
        ":phase/order": "{{index}}",
        ":phase/status": "pending"
      },
      as: "phases"  // Save references
    },
    
    // Create tasks
    {
      type: "batch",
      foreach: "{{transform.allTasks}}",
      data: {
        ":task/name": "{{item.name}}",
        ":task/phase": "{{item.phase}}",
        ":task/project": "{{refs.project}}",
        ":task/estimatedDuration": "{{item.estimatedDuration}}",
        ":task/order": "{{item.order}}",
        ":task/status": "not-started",
        ":task/assignee": null
      }
    },
    
    // Create team members
    {
      type: "batch",
      foreach: "{{transform.teamMembers}}",
      data: {
        ":member/name": "{{item.name}}",
        ":member/role": "{{item.role}}",
        ":member/project": "{{refs.project}}",
        ":member/active": true,
        ":member/joinedAt": "{{now}}"
      }
    }
  ]
}
```

**Output (DataStore Update):**
```javascript
[
  // Main project entity
  {
    ":project/id": "proj_1703001234567",
    ":project/name": "E-Commerce Platform",
    ":project/totalDuration": 12,
    ":project/phaseCount": 3,
    ":project/status": "planning",
    ":project/createdAt": 1703001234567
  },
  
  // Phase entities
  {
    ":phase/name": "Planning",
    ":phase/duration": 2,
    ":phase/project": 1001, // Reference to created project
    ":phase/order": 0,
    ":phase/status": "pending"
  },
  {
    ":phase/name": "Development",
    ":phase/duration": 8,
    ":phase/project": 1001,
    ":phase/order": 1,
    ":phase/status": "pending"
  },
  {
    ":phase/name": "Testing",
    ":phase/duration": 2,
    ":phase/project": 1001,
    ":phase/order": 2,
    ":phase/status": "pending"
  },
  
  // Task entities
  {
    ":task/name": "Requirements gathering",
    ":task/phase": "Planning",
    ":task/project": 1001,
    ":task/estimatedDuration": 3,
    ":task/order": 0,
    ":task/status": "not-started",
    ":task/assignee": null
  },
  // ... more tasks ...
  
  // Team member entities
  {
    ":member/name": "Alice Johnson",
    ":member/role": "lead",
    ":member/project": 1001,
    ":member/active": true,
    ":member/joinedAt": 1703001234567
  },
  {
    ":member/name": "Bob Smith",
    ":member/role": "developer",
    ":member/project": 1001,
    ":member/active": true,
    ":member/joinedAt": 1703001234567
  }
  // ... more team members ...
]
```

### Example 6: Data Validation and Sanitization

**Input Data (LLM Response):**
```javascript
{
  "userInput": {
    "email": "JOHN.DOE@EXAMPLE.COM  ",
    "phone": "1-555-123-4567",
    "website": "example.com",
    "bio": "<script>alert('xss')</script>John is a developer",
    "tags": "javascript, react,  nodejs,  , python"
  }
}
```

**Update Spec:**
```javascript
{
  transform: {
    // Normalize and validate email using declarative operations
    email: {
      type: "pipe",
      operations: [
        {
          type: "trim",
          input: "{{response.userInput.email}}"
        },
        {
          type: "lowercase"
        },
        {
          type: "conditional",
          if: {
            type: "regex_match",
            pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
          },
          then: "{{_value}}",
          else: null
        }
      ]
    },
    
    // Clean and format phone number using declarative operations
    phone: {
      type: "pipe",
      operations: [
        {
          type: "regex_replace",
          input: "{{response.userInput.phone}}",
          pattern: "\\D",
          replacement: "",
          global: true
        },
        {
          type: "regex_replace",
          pattern: "^1",
          replacement: ""
        }
      ]
    },
    
    // Add protocol to website if missing using conditional
    website: {
      type: "conditional",
      if: {
        type: "or",
        conditions: [
          {
            type: "startsWith",
            input: "{{response.userInput.website}}",
            prefix: "http://"
          },
          {
            type: "startsWith",
            input: "{{response.userInput.website}}",
            prefix: "https://"
          }
        ]
      },
      then: "{{response.userInput.website}}",
      else: {
        type: "concat",
        values: ["https://", "{{response.userInput.website}}"]
      }
    },
    
    // Sanitize HTML/scripts from bio using regex operations
    bio: {
      type: "pipe",
      operations: [
        {
          type: "regex_replace",
          input: "{{response.userInput.bio}}",
          pattern: "<script\\b[^<]*(?:(?!</script>)<[^<]*)*</script>",
          replacement: "",
          global: true,
          flags: "gi"
        },
        {
          type: "regex_replace",
          pattern: "<[^>]+>",
          replacement: "",
          global: true
        },
        {
          type: "trim"
        }
      ]
    },
    
    // Parse and clean tags using declarative operations
    tags: {
      type: "pipe",
      operations: [
        {
          type: "split",
          input: "{{response.userInput.tags}}",
          delimiter: ","
        },
        {
          type: "map",
          mapper: {
            type: "trim",
            input: "{{item}}"
          }
        },
        {
          type: "filter",
          predicate: {
            type: "greater",
            left: {
              type: "length",
              input: "{{item}}"
            },
            right: 0
          }
        },
        {
          type: "unique"
        }
      ]
    },
    
    // Validation flags using declarative conditions
    isValid: {
      type: "and",
      conditions: [
        {
          type: "notEquals",
          left: "{{transform.email}}",
          right: null
        },
        {
          type: "equals",
          left: {
            type: "length",
            input: "{{transform.phone}}"
          },
          right: 10
        }
      ]
    }
  },
  
  conditional: [
    {
      if: "transform.isValid",
      update: {
        entityId: "{{context.userId}}",
        data: {
          ":user/email": "{{transform.email}}",
          ":user/phone": "{{transform.phone}}",
          ":user/website": "{{transform.website}}",
          ":user/bio": "{{transform.bio}}",
          ":user/tags": "{{transform.tags}}",
          ":user/profileComplete": true,
          ":user/updatedAt": "{{now}}"
        }
      }
    },
    {
      if: "!transform.isValid",
      create: {
        type: "single",
        data: {
          ":validation/user": "{{context.userId}}",
          ":validation/errors": ["Invalid email or phone format"],
          ":validation/timestamp": "{{now}}"
        }
      }
    }
  ]
}
```

**Output (DataStore Update) when valid:**
```javascript
{
  ":db/id": 999,
  ":user/email": "john.doe@example.com",
  ":user/phone": "5551234567",
  ":user/website": "https://example.com",
  ":user/bio": "John is a developer",
  ":user/tags": ["javascript", "react", "nodejs", "python"],
  ":user/profileComplete": true,
  ":user/updatedAt": 1703001234567
}
```

### Example 7: Aggregation and Summary Statistics

**Input Data (LLM Response):**
```javascript
{
  "codeReview": {
    "files": [
      { "path": "src/index.js", "issues": 3, "coverage": 85 },
      { "path": "src/utils.js", "issues": 0, "coverage": 95 },
      { "path": "src/api.js", "issues": 5, "coverage": 70 },
      { "path": "src/auth.js", "issues": 1, "coverage": 90 }
    ],
    "comments": [
      "Consider using TypeScript for better type safety",
      "Add more unit tests for edge cases",
      "Good separation of concerns"
    ]
  }
}
```

**Update Spec:**
```javascript
{
  transform: {
    // Calculate aggregated statistics using declarative operations
    totalIssues: {
      type: "sum",
      array: "{{response.codeReview.files}}",
      field: "issues"
    },
    
    averageCoverage: {
      type: "round",
      input: {
        type: "divide",
        dividend: {
          type: "sum",
          array: "{{response.codeReview.files}}",
          field: "coverage"
        },
        divisor: {
          type: "length",
          input: "{{response.codeReview.files}}"
        }
      }
    },
    
    filesWithIssues: {
      type: "pipe",
      operations: [
        {
          type: "filter",
          array: "{{response.codeReview.files}}",
          predicate: {
            type: "greater",
            left: "{{item.issues}}",
            right: 0
          }
        },
        {
          type: "map",
          mapper: {
            path: "{{item.path}}",
            issueCount: "{{item.issues}}",
            severity: {
              type: "conditional",
              conditions: [
                {
                  if: { type: "greater", left: "{{item.issues}}", right: 3 },
                  then: "high"
                },
                {
                  if: { type: "greater", left: "{{item.issues}}", right: 1 },
                  then: "medium"
                }
              ],
              else: "low"
            }
          }
        }
      ]
    },
    
    // Determine overall health score using declarative math operations
    healthScore: {
      type: "max",
      values: [
        0,
        {
          type: "round",
          input: {
            type: "subtract",
            left: 100,
            right: {
              type: "add",
              values: [
                {
                  type: "multiply",
                  values: ["{{transform.totalIssues}}", 3]
                },
                {
                  type: "multiply",
                  values: [
                    {
                      type: "subtract",
                      left: 100,
                      right: "{{transform.averageCoverage}}"
                    },
                    0.5
                  ]
                }
              ]
            }
          }
        }
      ]
    },
    
    // Extract action items from comments using declarative operations
    actionItems: {
      type: "filter",
      array: "{{response.codeReview.comments}}",
      predicate: {
        type: "or",
        conditions: [
          {
            type: "contains",
            text: {
              type: "lowercase",
              input: "{{item}}"
            },
            search: "consider"
          },
          {
            type: "contains",
            text: {
              type: "lowercase",
              input: "{{item}}"
            },
            search: "add"
          },
          {
            type: "contains",
            text: {
              type: "lowercase",
              input: "{{item}}"
            },
            search: "refactor"
          },
          {
            type: "contains",
            text: {
              type: "lowercase",
              input: "{{item}}"
            },
            search: "improve"
          },
          {
            type: "contains",
            text: {
              type: "lowercase",
              input: "{{item}}"
            },
            search: "fix"
          }
        ]
      }
    }
  },
  
  create: [
    {
      type: "single",
      data: {
        ":review/project": "{{context.projectId}}",
        ":review/totalIssues": "{{transform.totalIssues}}",
        ":review/averageCoverage": "{{transform.averageCoverage}}",
        ":review/healthScore": "{{transform.healthScore}}",
        ":review/fileCount": "{{response.codeReview.files.length}}",
        ":review/timestamp": "{{now}}"
      }
    },
    {
      type: "batch",
      foreach: "{{transform.filesWithIssues}}",
      data: {
        ":fileIssue/path": "{{item.path}}",
        ":fileIssue/count": "{{item.issueCount}}",
        ":fileIssue/severity": "{{item.severity}}",
        ":fileIssue/project": "{{context.projectId}}",
        ":fileIssue/reviewedAt": "{{now}}"
      }
    },
    {
      type: "batch",
      foreach: "{{transform.actionItems}}",
      data: {
        ":actionItem/description": "{{item}}",
        ":actionItem/project": "{{context.projectId}}",
        ":actionItem/status": "pending",
        ":actionItem/source": "code-review",
        ":actionItem/createdAt": "{{now}}"
      }
    }
  ]
}
```

**Output (DataStore Update):**
```javascript
[
  // Review summary
  {
    ":review/project": 123,
    ":review/totalIssues": 9,
    ":review/averageCoverage": 85,
    ":review/healthScore": 66,
    ":review/fileCount": 4,
    ":review/timestamp": 1703001234567
  },
  
  // File issues
  {
    ":fileIssue/path": "src/index.js",
    ":fileIssue/count": 3,
    ":fileIssue/severity": "medium",
    ":fileIssue/project": 123,
    ":fileIssue/reviewedAt": 1703001234567
  },
  {
    ":fileIssue/path": "src/api.js",
    ":fileIssue/count": 5,
    ":fileIssue/severity": "high",
    ":fileIssue/project": 123,
    ":fileIssue/reviewedAt": 1703001234567
  },
  {
    ":fileIssue/path": "src/auth.js",
    ":fileIssue/count": 1,
    ":fileIssue/severity": "low",
    ":fileIssue/project": 123,
    ":fileIssue/reviewedAt": 1703001234567
  },
  
  // Action items
  {
    ":actionItem/description": "Consider using TypeScript for better type safety",
    ":actionItem/project": 123,
    ":actionItem/status": "pending",
    ":actionItem/source": "code-review",
    ":actionItem/createdAt": 1703001234567
  },
  {
    ":actionItem/description": "Add more unit tests for edge cases",
    ":actionItem/project": 123,
    ":actionItem/status": "pending",
    ":actionItem/source": "code-review",
    ":actionItem/createdAt": 1703001234567
  }
]
```

## Predefined Transform Operations

The transformation engine provides a comprehensive library of declarative operations that can be composed:

### String Operations

```javascript
{
  transform: {
    // Basic string operations
    trimmed: {
      type: "trim",
      input: "{{response.text}}"
    },
    
    lowercased: {
      type: "lowercase",
      input: "{{response.name}}"
    },
    
    uppercased: {
      type: "uppercase", 
      input: "{{response.code}}"
    },
    
    // String manipulation
    replaced: {
      type: "regex_replace",
      input: "{{response.text}}",
      pattern: "\\s+",
      replacement: " ",
      global: true
    },
    
    // Extraction operations
    extracted: {
      type: "regex_extract",
      input: "{{response.text}}",
      pattern: "(\\d{4})-(\\d{2})-(\\d{2})",
      capture: 1
    },
    
    // String checks
    hasKeyword: {
      type: "contains",
      text: "{{response.description}}",
      search: "urgent",
      caseSensitive: false
    },
    
    startsWithPrefix: {
      type: "startsWith",
      input: "{{response.url}}",
      prefix: "https://"
    }
  }
}
```

### Mathematical Operations

```javascript
{
  transform: {
    // Basic arithmetic
    total: {
      type: "add",
      values: ["{{response.price}}", "{{response.tax}}"]
    },
    
    difference: {
      type: "subtract",
      left: "{{response.original}}",
      right: "{{response.discount}}"
    },
    
    product: {
      type: "multiply",
      values: ["{{response.quantity}}", "{{response.unitPrice}}"]
    },
    
    quotient: {
      type: "divide",
      dividend: "{{response.total}}",
      divisor: "{{response.count}}"
    },
    
    // Rounding and formatting
    rounded: {
      type: "round",
      input: "{{response.value}}",
      decimals: 2
    },
    
    // Min/max operations
    highest: {
      type: "max",
      values: ["{{response.score1}}", "{{response.score2}}", "{{response.score3}}"]
    },
    
    lowest: {
      type: "min",
      values: ["{{response.values}}"]
    }
  }
}
```

### Array Operations

```javascript
{
  transform: {
    // Array aggregation
    totalCount: {
      type: "length",
      input: "{{response.items}}"
    },
    
    summed: {
      type: "sum",
      array: "{{response.scores}}",
      field: "value"  // Optional for array of objects
    },
    
    averaged: {
      type: "average",
      array: "{{response.ratings}}"
    },
    
    // Array transformation
    mapped: {
      type: "map",
      array: "{{response.users}}",
      mapper: {
        name: "{{item.firstName}} {{item.lastName}}",
        age: "{{item.age}}"
      }
    },
    
    filtered: {
      type: "filter",
      array: "{{response.items}}",
      predicate: {
        type: "greater",
        left: "{{item.score}}",
        right: 50
      }
    },
    
    // Array utilities
    flattened: {
      type: "flatMap",
      array: "{{response.groups}}",
      mapper: "{{item.members}}"
    },
    
    unique: {
      type: "unique",
      array: "{{response.tags}}"
    },
    
    concatenated: {
      type: "concat",
      arrays: ["{{response.list1}}", "{{response.list2}}"]
    }
  }
}
```

### Logical Operations

```javascript
{
  transform: {
    // Boolean operations
    allTrue: {
      type: "and",
      conditions: [
        "{{response.hasLicense}}",
        "{{response.isActive}}",
        "{{response.verified}}"
      ]
    },
    
    anyTrue: {
      type: "or",
      conditions: [
        "{{response.isPremium}}",
        "{{response.isTrial}}",
        "{{response.hasPromo}}"
      ]
    },
    
    negated: {
      type: "not",
      input: "{{response.disabled}}"
    },
    
    // Comparisons
    isEqual: {
      type: "equals",
      left: "{{response.status}}",
      right: "active"
    },
    
    isGreater: {
      type: "greater",
      left: "{{response.score}}",
      right: 80
    },
    
    isInRange: {
      type: "and",
      conditions: [
        {
          type: "greaterOrEqual",
          left: "{{response.age}}",
          right: 18
        },
        {
          type: "lessOrEqual",
          left: "{{response.age}}",
          right: 65
        }
      ]
    }
  }
}
```

### Conditional Operations

```javascript
{
  transform: {
    // Simple conditional
    status: {
      type: "conditional",
      if: {
        type: "greater",
        left: "{{response.score}}",
        right: 90
      },
      then: "excellent",
      else: "needs improvement"
    },
    
    // Multi-condition conditional
    grade: {
      type: "conditional",
      conditions: [
        {
          if: { type: "greaterOrEqual", left: "{{response.score}}", right: 90 },
          then: "A"
        },
        {
          if: { type: "greaterOrEqual", left: "{{response.score}}", right: 80 },
          then: "B"
        },
        {
          if: { type: "greaterOrEqual", left: "{{response.score}}", right: 70 },
          then: "C"
        }
      ],
      else: "F"
    }
  }
}
```

### Parsing Operations

```javascript
{
  transform: {
    // Parse numbers
    parsedInt: {
      type: "parseInt",
      input: "{{response.stringNumber}}"
    },
    
    parsedFloat: {
      type: "parseFloat",
      input: "{{response.decimalString}}"
    },
    
    // Parse JSON
    parsedData: {
      type: "parseJson",
      input: "{{response.jsonString}}"
    },
    
    // Parse dates
    parsedDate: {
      type: "parseDate",
      input: "{{response.dateString}}",
      format: "YYYY-MM-DD"
    }
  }
}
```

### Composition with Pipe

```javascript
{
  transform: {
    // Chain multiple operations
    processedEmail: {
      type: "pipe",
      operations: [
        {
          type: "trim",
          input: "{{response.email}}"
        },
        {
          type: "lowercase"
        },
        {
          type: "conditional",
          if: {
            type: "regex_match",
            pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
          },
          then: "{{_value}}",
          else: null
        }
      ]
    },
    
    // Complex pipeline
    processedData: {
      type: "pipe",
      operations: [
        {
          type: "split",
          input: "{{response.csv}}",
          delimiter: ","
        },
        {
          type: "map",
          mapper: {
            type: "trim",
            input: "{{item}}"
          }
        },
        {
          type: "filter",
          predicate: {
            type: "greater",
            left: {
              type: "length",
              input: "{{item}}"
            },
            right: 0
          }
        },
        {
          type: "unique"
        }
      ]
    }
  }
}
```

### Template Operations

```javascript
{
  transform: {
    // String template
    fullName: {
      type: "template",
      template: "{{firstName}} {{lastName}}",
      values: {
        firstName: "{{response.first}}",
        lastName: "{{response.last}}"
      }
    },
    
    // ID generation
    uniqueId: {
      type: "template",
      template: "user_{{timestamp}}_{{random}}",
      values: {
        timestamp: "{{now}}",
        random: {
          type: "random",
          min: 1000,
          max: 9999
        }
      }
    }
  }
}
```

### Data Validation Operations

```javascript
{
  transform: {
    // Check existence
    hasValue: {
      type: "exists",
      value: "{{response.optionalField}}"
    },
    
    // Type checking
    isNumber: {
      type: "isType",
      value: "{{response.field}}",
      expectedType: "number"
    },
    
    // Format validation
    isValidEmail: {
      type: "regex_match",
      input: "{{response.email}}",
      pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
    },
    
    // Range validation
    isInRange: {
      type: "and",
      conditions: [
        {
          type: "greaterOrEqual",
          left: "{{response.value}}",
          right: 0
        },
        {
          type: "lessOrEqual",
          left: "{{response.value}}",
          right: 100
        }
      ]
    }
  }
}
```

### Variable Resolution

The system supports various variable references:

- `{{response.field}}` - Fields from the input data (LLM response)
- `{{transform.name}}` - Results of transform functions
- `{{context.field}}` - Values from the provided context
- `{{item}}` - Current item in foreach loops
- `{{index}}` - Current index in foreach loops
- `{{now}}` - Current timestamp
- `{{uuid}}` - Generate a UUID
- `{{refs.name}}` - Reference to previously created entities

### Conditional Logic

Conditions are evaluated using simple JavaScript expressions:

```javascript
{
  conditional: [
    {
      // Simple equality
      if: "response.status === 'error'",
      create: { /* ... */ }
    },
    {
      // Numeric comparison
      if: "transform.score > 80",
      update: { /* ... */ }
    },
    {
      // Boolean check
      if: "transform.hasErrors",
      create: { /* ... */ }
    },
    {
      // Complex condition
      if: "response.count > 10 && context.level === 'critical'",
      create: { /* ... */ }
    },
    {
      // Negation
      if: "!transform.isValid",
      create: { /* ... */ }
    }
  ]
}
```

## Output Format

The transformation function produces DataStore-compatible updates in one of these formats:

### Single Entity Update
```javascript
{
  ":db/id": 123,
  ":namespace/attr1": "value1",
  ":namespace/attr2": "value2"
}
```

### Multiple Entity Creation (Array)
```javascript
[
  {
    ":entity/attr1": "value1",
    ":entity/attr2": "value2"
  },
  {
    ":entity/attr1": "value3",
    ":entity/attr2": "value4"
  }
]
```

### Mixed Operations (Array)
```javascript
[
  {
    ":db/id": 123,  // Update existing
    ":entity/status": "updated"
  },
  {
    // Create new
    ":newentity/name": "New Entity",
    ":newentity/created": 1703001234567
  }
]
```

## Error Handling

The transformation function handles various error scenarios:

1. **Missing Required Fields**: Returns null for missing transforms
2. **Invalid Expressions**: Safely evaluates to undefined
3. **Transform Errors**: Catches and logs transform function errors
4. **Type Mismatches**: Attempts type coercion where sensible

## Usage with DataBasedAgent

The ds-update transformation is used by DataBasedAgent:

```javascript
import { transformUpdate } from '@legion/ds-update';

class DataBasedAgent {
  async execute(context) {
    // ... query data from DataStore ...
    
    // Execute LLM with prompt
    const llmResponse = await this.llmClient.execute(prompt);
    
    // Transform the response using ds-update
    const dataStoreUpdate = transformUpdate(
      this.updateSpec,
      llmResponse,
      {
        ...context,
        query: queryResults
      }
    );
    
    // Apply update to DataStore
    if (Array.isArray(dataStoreUpdate)) {
      // Multiple operations
      for (const update of dataStoreUpdate) {
        if (update[':db/id']) {
          await this.dataStore.updateEntity(update[':db/id'], update);
        } else {
          await this.dataStore.createEntity(update);
        }
      }
    } else {
      // Single operation
      if (dataStoreUpdate[':db/id']) {
        await this.dataStore.updateEntity(dataStoreUpdate[':db/id'], dataStoreUpdate);
      } else {
        await this.dataStore.createEntity(dataStoreUpdate);
      }
    }
  }
}
```

## Summary

The ds-update package provides a powerful yet simple transformation function that bridges the gap between flexible LLM outputs and structured DataStore requirements. Through declarative specifications with transform functions, conditionals, and batch operations, it enables complex data transformations while maintaining clarity and maintainability.

The transformation is:
- **Pure**: No side effects, deterministic output
- **Flexible**: Handles any data structure from LLMs
- **Powerful**: Supports complex transformations and logic
- **Simple**: Single function with clear input/output