/**
 * FrontendArchitecturePlannerConfig - Configuration for LLM-based frontend architecture planning
 * 
 * This configuration defines the prompt template, response schema, and examples
 * for planning frontend component hierarchies, state management, and data flow.
 */

export const FrontendArchitecturePlannerConfig = {
  name: 'FrontendArchitecturePlanner',
  description: 'Plans frontend architecture including components, state management, and data flow',
  
  // Template for generating prompts
  promptTemplate: `You are an expert frontend architect specializing in component design, state management, and user interface patterns. Your task is to create comprehensive frontend architectures based on project analysis.

## Project Analysis
{analysis}

## Frontend Architecture Planning Instructions

1. **Component Design**
   - Analyze features to identify needed components
   - Design component hierarchy and relationships
   - Specify component types (container, display, form, navigation, interactive, layout)
   - Define component responsibilities and interfaces

2. **State Management**
   - Choose appropriate state pattern based on complexity
   - Local: Simple component state for low complexity
   - Centralized: Application-wide state for medium complexity  
   - Modular: Feature-based state management for high complexity

3. **Data Flow**
   - Define how data flows between components
   - Specify parent-child relationships
   - Identify shared data and communication patterns
   - Plan event handling and user interactions

4. **Styling Architecture**
   - Choose CSS approach (inline, modular, utility-based)
   - Plan styling organization and structure
   - Define theme and design system if needed

5. **Routing (if applicable)**
   - Plan navigation structure
   - Define routes and page components
   - Specify routing patterns

## Component Type Classification

**Container Components:**
- App: Main application wrapper
- Page: Top-level page components
- Layout: Page layout containers
- Wrapper: Generic container components

**Display Components:**
- List: Display collections of items
- Table: Tabular data display
- Grid: Grid-based layouts
- Card: Individual item display
- Item: Single data item

**Form Components:**
- Form: Complete form containers
- Input: Input field components
- Field: Form field wrappers
- Submit: Form submission
- Search: Search functionality

**Navigation Components:**
- Nav: Main navigation
- Menu: Menu components
- Header: Page headers
- Footer: Page footers
- Sidebar: Side navigation

**Interactive Components:**
- Button: Action buttons
- Modal: Modal dialogs
- Dialog: Dialog boxes
- Dropdown: Dropdown menus
- Toggle: Toggle switches

**Layout Components:**
- Header: Page header sections
- Footer: Page footer sections
- Main: Main content areas
- Aside: Sidebar content
- Section: Content sections

## State Management Patterns

**Local State (Low Complexity):**
- Component-level state only
- Direct prop passing
- Simple event handling

**Centralized State (Medium Complexity):**
- Application-wide state store
- Centralized state updates
- Global state access

**Modular State (High Complexity):**
- Feature-based state modules
- Selective state sharing
- Complex state orchestration

## Response Format
Respond with a JSON object that exactly matches this structure:

{
  "components": [
    {
      "name": "ComponentName",
      "type": "container|display|form|navigation|interactive|layout",
      "description": "What this component does",
      "props": ["array of expected props"],
      "children": ["array of child component names"],
      "responsibilities": ["array of responsibilities"],
      "stateNeeds": "local|shared|none"
    }
  ],
  "componentHierarchy": {
    "App": {
      "children": ["Header", "Main", "Footer"],
      "level": 0
    },
    "Header": {
      "children": ["Navigation"],
      "level": 1,
      "parent": "App"
    }
  },
  "stateManagement": {
    "pattern": "local|centralized|modular",
    "complexity": "low|medium|high",
    "stateStructure": {
      "user": "object describing user state",
      "ui": "object describing UI state"
    },
    "actions": ["array of state actions needed"]
  },
  "dataFlow": {
    "patterns": ["prop-drilling", "state-lifting", "event-bubbling"],
    "communications": [
      {
        "from": "ParentComponent",
        "to": "ChildComponent", 
        "type": "props|events|state",
        "data": "description of data passed"
      }
    ]
  },
  "styling": {
    "approach": "modular|utility|inline|external",
    "organization": "description of CSS organization",
    "themes": true|false,
    "responsive": true|false
  },
  "routing": {
    "enabled": true|false,
    "routes": [
      {
        "path": "/path",
        "component": "ComponentName",
        "description": "Route description"
      }
    ]
  },
  "metadata": {
    "planner": "FrontendArchitecturePlanner",
    "plannedAt": 1234567890,
    "complexity": "low|medium|high"
  }
}

## Example Architectures

**Simple Todo App:**
```json
{
  "components": [
    {
      "name": "App",
      "type": "container",
      "description": "Main application container",
      "props": [],
      "children": ["Header", "TodoList", "TodoForm"],
      "responsibilities": ["application state", "component coordination"],
      "stateNeeds": "local"
    },
    {
      "name": "TodoForm",
      "type": "form",
      "description": "Form for adding new todos",
      "props": ["onSubmit"],
      "children": [],
      "responsibilities": ["input validation", "form submission"],
      "stateNeeds": "local"
    },
    {
      "name": "TodoList",
      "type": "display",
      "description": "List of todo items",
      "props": ["todos", "onToggle", "onDelete"],
      "children": ["TodoItem"],
      "responsibilities": ["todo display", "list management"],
      "stateNeeds": "none"
    },
    {
      "name": "TodoItem",
      "type": "display",
      "description": "Individual todo item",
      "props": ["todo", "onToggle", "onDelete"],
      "children": [],
      "responsibilities": ["todo rendering", "user interactions"],
      "stateNeeds": "none"
    }
  ],
  "stateManagement": {
    "pattern": "local",
    "complexity": "low",
    "stateStructure": {
      "todos": "array of todo objects",
      "inputValue": "current input field value"
    },
    "actions": ["addTodo", "toggleTodo", "deleteTodo", "updateInput"]
  },
  "styling": {
    "approach": "modular",
    "organization": "CSS modules per component",
    "themes": false,
    "responsive": true
  }
}
```

Please analyze the provided project analysis and create a comprehensive frontend architecture plan.`,

  // Schema for response validation
  responseSchema: {
    type: 'object',
    required: ['components', 'componentHierarchy', 'stateManagement', 'dataFlow', 'styling', 'metadata'],
    properties: {
      components: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'type', 'description'],
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: ['container', 'display', 'form', 'navigation', 'interactive', 'layout'] },
            description: { type: 'string' },
            props: { type: 'array', items: { type: 'string' } },
            children: { type: 'array', items: { type: 'string' } },
            responsibilities: { type: 'array', items: { type: 'string' } },
            stateNeeds: { type: 'string', enum: ['local', 'shared', 'none'] }
          }
        }
      },
      componentHierarchy: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            children: { type: 'array', items: { type: 'string' } },
            level: { type: 'number' },
            parent: { type: 'string' }
          }
        }
      },
      stateManagement: {
        type: 'object',
        required: ['pattern', 'complexity'],
        properties: {
          pattern: { type: 'string', enum: ['local', 'centralized', 'modular'] },
          complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
          stateStructure: { type: 'object' },
          actions: { type: 'array', items: { type: 'string' } }
        }
      },
      dataFlow: {
        type: 'object',
        properties: {
          patterns: { type: 'array', items: { type: 'string' } },
          communications: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                type: { type: 'string' },
                data: { type: 'string' }
              }
            }
          }
        }
      },
      styling: {
        type: 'object',
        required: ['approach'],
        properties: {
          approach: { type: 'string', enum: ['modular', 'utility', 'inline', 'external'] },
          organization: { type: 'string' },
          themes: { type: 'boolean' },
          responsive: { type: 'boolean' }
        }
      },
      routing: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          routes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                component: { type: 'string' },
                description: { type: 'string' }
              }
            }
          }
        }
      },
      metadata: {
        type: 'object',
        required: ['planner', 'plannedAt', 'complexity'],
        properties: {
          planner: { type: 'string' },
          plannedAt: { type: 'number' },
          complexity: { type: 'string', enum: ['low', 'medium', 'high'] }
        }
      }
    }
  },

  // Example inputs and expected outputs for testing
  examples: [
    {
      input: {
        analysis: {
          projectType: 'frontend',
          complexity: 'low',
          components: {
            frontend: {
              features: ['form', 'list'],
              technologies: ['html', 'css', 'javascript']
            }
          }
        }
      },
      expectedOutput: {
        components: [
          {
            name: 'App',
            type: 'container',
            description: 'Main application container',
            props: [],
            children: ['TodoForm', 'TodoList'],
            responsibilities: ['application state', 'component coordination'],
            stateNeeds: 'local'
          }
        ],
        stateManagement: {
          pattern: 'local',
          complexity: 'low'
        },
        metadata: {
          planner: 'FrontendArchitecturePlanner',
          plannedAt: 1234567890,
          complexity: 'low'
        }
      }
    }
  ],

  // Mock responses for testing
  mockResponses: {
    'simple-todo': {
      components: [
        {
          name: 'App',
          type: 'container',
          description: 'Main application container',
          props: [],
          children: ['TodoForm', 'TodoList'],
          responsibilities: ['application state', 'component coordination'],
          stateNeeds: 'local'
        },
        {
          name: 'TodoForm',
          type: 'form',
          description: 'Form for adding new todos',
          props: ['onSubmit'],
          children: [],
          responsibilities: ['input validation', 'form submission'],
          stateNeeds: 'local'
        },
        {
          name: 'TodoList',
          type: 'display',
          description: 'List of todo items',
          props: ['todos', 'onToggle', 'onDelete'],
          children: ['TodoItem'],
          responsibilities: ['todo display', 'list management'],
          stateNeeds: 'none'
        }
      ],
      componentHierarchy: {
        App: {
          children: ['TodoForm', 'TodoList'],
          level: 0
        },
        TodoForm: {
          children: [],
          level: 1,
          parent: 'App'
        },
        TodoList: {
          children: ['TodoItem'],
          level: 1,
          parent: 'App'
        }
      },
      stateManagement: {
        pattern: 'local',
        complexity: 'low',
        stateStructure: {
          todos: 'array of todo objects',
          inputValue: 'current input field value'
        },
        actions: ['addTodo', 'toggleTodo', 'deleteTodo', 'updateInput']
      },
      dataFlow: {
        patterns: ['prop-drilling', 'event-bubbling'],
        communications: [
          {
            from: 'App',
            to: 'TodoList',
            type: 'props',
            data: 'todos array and event handlers'
          }
        ]
      },
      styling: {
        approach: 'modular',
        organization: 'CSS modules per component',
        themes: false,
        responsive: true
      },
      routing: {
        enabled: false
      },
      metadata: {
        planner: 'FrontendArchitecturePlanner',
        plannedAt: Date.now(),
        complexity: 'low'
      }
    }
  },

  // Settings for LLM generation
  settings: {
    temperature: 0.2, // Slightly higher for creative component design
    maxTokens: 3000,
    systemPrompt: 'You are a frontend architecture expert. Always respond with valid JSON matching the exact schema provided.'
  }
};