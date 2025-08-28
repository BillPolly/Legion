/**
 * FrontendArchitecturePlannerConfig - Configuration for frontend architecture planning
 * 
 * Defines the allowable actions and constraints for creating comprehensive frontend
 * architectures including component hierarchy, state management, and styling.
 */

export const FrontendArchitecturePlannerConfig = {
  name: 'FrontendArchitecturePlanner',
  description: 'Plans frontend architecture and component design for optimal user experience',
  
  allowableActions: [
    {
      type: 'analyze_components',
      description: 'Analyze required components based on features',
      inputs: ['features_list', 'project_requirements'],
      outputs: ['component_analysis'],
      parameters: {
        componentNames: {
          type: 'array',
          description: 'List of component names to create'
        },
        componentTypes: {
          type: 'array',
          description: 'Types of components (container, display, form, etc.)'
        }
      }
    },
    {
      type: 'create_component',
      description: 'Create a component specification',
      inputs: ['component_requirements', 'component_hierarchy'],
      outputs: ['component_specification'],
      parameters: {
        name: {
          type: 'string',
          description: 'Name of the component'
        },
        type: {
          type: 'string',
          enum: ['container', 'display', 'form', 'navigation', 'interactive', 'layout'],
          description: 'Type of component'
        },
        props: {
          type: 'array',
          description: 'List of component properties'
        },
        state: {
          type: 'object',
          description: 'Component state requirements'
        },
        children: {
          type: 'array',
          description: 'Child components'
        },
        description: {
          type: 'string',
          description: 'Description of component purpose'
        }
      }
    },
    {
      type: 'analyze_component_hierarchy',
      description: 'Analyze the hierarchical relationships between components',
      inputs: ['component_list', 'feature_requirements'],
      outputs: ['component_hierarchy'],
      parameters: {
        hierarchy: {
          type: 'object',
          description: 'Hierarchical structure of components'
        },
        relationships: {
          type: 'array',
          description: 'Parent-child relationships'
        },
        depth: {
          type: 'number',
          description: 'Maximum depth of component hierarchy'
        }
      }
    },
    {
      type: 'define_state_management',
      description: 'Define state management strategy and structure',
      inputs: ['component_hierarchy', 'complexity_level'],
      outputs: ['state_management_plan'],
      parameters: {
        strategy: {
          type: 'string',
          enum: ['local', 'centralized', 'modular'],
          description: 'State management strategy'
        },
        globalState: {
          type: 'object',
          description: 'Global state structure'
        },
        stateFlow: {
          type: 'array',
          description: 'State flow patterns'
        }
      }
    },
    {
      type: 'plan_data_flow',
      description: 'Plan data flow patterns between components',
      inputs: ['component_hierarchy', 'api_requirements'],
      outputs: ['data_flow_plan'],
      parameters: {
        dataFlow: {
          type: 'object',
          description: 'Data flow patterns'
        },
        apiCalls: {
          type: 'array',
          description: 'API call patterns'
        },
        eventHandling: {
          type: 'object',
          description: 'Event handling patterns'
        }
      }
    },
    {
      type: 'configure_styling',
      description: 'Configure styling architecture and organization',
      inputs: ['component_list', 'design_requirements'],
      outputs: ['styling_architecture'],
      parameters: {
        approach: {
          type: 'string',
          enum: ['global', 'modular', 'component-scoped', 'utility-first'],
          description: 'CSS organization approach'
        },
        structure: {
          type: 'object',
          description: 'CSS file structure'
        },
        conventions: {
          type: 'array',
          description: 'Naming conventions and standards'
        }
      }
    },
    {
      type: 'setup_routing',
      description: 'Setup routing configuration for multi-page applications',
      inputs: ['component_hierarchy', 'navigation_requirements'],
      outputs: ['routing_configuration'],
      parameters: {
        routes: {
          type: 'array',
          description: 'List of application routes'
        },
        routeComponents: {
          type: 'object',
          description: 'Mapping of routes to components'
        },
        navigationPattern: {
          type: 'string',
          enum: ['hash', 'history', 'memory'],
          description: 'Navigation pattern to use'
        }
      }
    },
    {
      type: 'optimize_performance',
      description: 'Plan performance optimization strategies',
      inputs: ['component_hierarchy', 'performance_requirements'],
      outputs: ['performance_plan'],
      parameters: {
        optimizations: {
          type: 'array',
          description: 'List of performance optimizations'
        },
        lazyLoading: {
          type: 'boolean',
          description: 'Whether to implement lazy loading'
        },
        caching: {
          type: 'object',
          description: 'Caching strategies'
        }
      }
    },
    {
      type: 'plan_accessibility',
      description: 'Plan accessibility features and compliance',
      inputs: ['component_specifications', 'accessibility_requirements'],
      outputs: ['accessibility_plan'],
      parameters: {
        features: {
          type: 'array',
          description: 'Accessibility features to implement'
        },
        compliance: {
          type: 'string',
          enum: ['WCAG-A', 'WCAG-AA', 'WCAG-AAA'],
          description: 'WCAG compliance level'
        },
        testing: {
          type: 'array',
          description: 'Accessibility testing strategies'
        }
      }
    },
    {
      type: 'validate_architecture',
      description: 'Validate the frontend architecture for consistency and best practices',
      inputs: ['architecture_specification'],
      outputs: ['validation_result'],
      parameters: {
        isValid: {
          type: 'boolean',
          description: 'Whether the architecture is valid'
        },
        errors: {
          type: 'array',
          description: 'List of validation errors'
        },
        warnings: {
          type: 'array',
          description: 'List of warnings'
        },
        suggestions: {
          type: 'array',
          description: 'List of improvement suggestions'
        }
      }
    }
  ],
  
  constraints: [
    'Components must have clear responsibilities and single purpose',
    'Component hierarchy should not exceed 6 levels deep',
    'State management strategy must match project complexity',
    'Data flow must be unidirectional for predictability',
    'Styling approach must be consistent across components',
    'Routing must be configured for multi-page applications',
    'Performance optimizations must not compromise maintainability',
    'Accessibility features must be planned from the start',
    'Component names must follow consistent naming conventions',
    'Each component should have clear props and state definitions'
  ],
  
  componentTypes: {
    container: {
      description: 'High-level components that manage state and coordinate child components',
      patterns: ['app', 'page', 'layout', 'wrapper'],
      responsibilities: ['state management', 'data fetching', 'event coordination']
    },
    display: {
      description: 'Components that display data without managing state',
      patterns: ['list', 'table', 'grid', 'card', 'item'],
      responsibilities: ['data presentation', 'formatting', 'rendering']
    },
    form: {
      description: 'Components for user input and form handling',
      patterns: ['form', 'input', 'field', 'submit', 'search'],
      responsibilities: ['input validation', 'form submission', 'user interaction']
    },
    navigation: {
      description: 'Components for navigation and routing',
      patterns: ['nav', 'menu', 'header', 'footer', 'sidebar'],
      responsibilities: ['navigation', 'routing', 'menu management']
    },
    interactive: {
      description: 'Components for user interaction and feedback',
      patterns: ['button', 'modal', 'dialog', 'dropdown', 'toggle'],
      responsibilities: ['user interaction', 'feedback', 'state changes']
    },
    layout: {
      description: 'Components for layout and structure',
      patterns: ['header', 'footer', 'main', 'aside', 'section'],
      responsibilities: ['layout management', 'responsive design', 'content organization']
    }
  },
  
  examples: [
    {
      input: {
        projectType: 'frontend',
        complexity: 'low',
        features: ['form', 'list'],
        technologies: ['html', 'javascript', 'css']
      },
      expectedOutput: {
        components: [
          {
            name: 'TodoForm',
            type: 'form',
            props: ['onSubmit'],
            state: { inputValue: 'string' },
            description: 'Form for adding new todos'
          },
          {
            name: 'TodoList',
            type: 'display',
            props: ['todos', 'onDelete'],
            state: {},
            description: 'Display list of todos'
          }
        ],
        stateManagement: {
          strategy: 'local',
          globalState: {}
        },
        dataFlow: {
          pattern: 'parent-to-child',
          eventHandling: 'callback-props'
        }
      }
    }
  ],
  
  mockResponses: {
    'simple-frontend': {
      components: [
        {
          name: 'App',
          type: 'container',
          props: [],
          state: { todos: 'array' },
          children: ['TodoForm', 'TodoList'],
          description: 'Main application container'
        },
        {
          name: 'TodoForm',
          type: 'form',
          props: ['onSubmit'],
          state: { inputValue: 'string' },
          children: [],
          description: 'Form for adding new todos'
        },
        {
          name: 'TodoList',
          type: 'display',
          props: ['todos', 'onDelete'],
          state: {},
          children: ['TodoItem'],
          description: 'Display list of todos'
        },
        {
          name: 'TodoItem',
          type: 'interactive',
          props: ['todo', 'onDelete'],
          state: {},
          children: [],
          description: 'Individual todo item'
        }
      ],
      componentHierarchy: {
        'App': ['TodoForm', 'TodoList'],
        'TodoList': ['TodoItem'],
        'TodoForm': [],
        'TodoItem': []
      },
      stateManagement: {
        strategy: 'local',
        globalState: {},
        stateFlow: ['top-down']
      },
      dataFlow: {
        pattern: 'unidirectional',
        apiCalls: [],
        eventHandling: {
          pattern: 'callback-props',
          events: ['onSubmit', 'onDelete']
        }
      },
      styling: {
        approach: 'global',
        structure: {
          main: 'style.css',
          components: []
        },
        conventions: ['kebab-case', 'BEM methodology']
      },
      routing: {
        enabled: false,
        routes: [],
        routeComponents: {}
      },
      metadata: {
        planner: 'FrontendArchitecturePlanner',
        plannedAt: 1234567890,
        complexity: 'low',
        mockScenario: 'simple-frontend'
      }
    },
    'modular-frontend': {
      components: [
        {
          name: 'App',
          type: 'container',
          props: [],
          state: { user: 'object', loading: 'boolean' },
          children: ['Header', 'Main', 'Footer'],
          description: 'Main application container'
        },
        {
          name: 'Header',
          type: 'navigation',
          props: ['user', 'onLogout'],
          state: {},
          children: ['NavMenu'],
          description: 'Application header with navigation'
        },
        {
          name: 'Main',
          type: 'layout',
          props: ['currentPage'],
          state: {},
          children: ['ProductList', 'ProductForm'],
          description: 'Main content area'
        },
        {
          name: 'ProductList',
          type: 'display',
          props: ['products', 'onEdit', 'onDelete'],
          state: { selectedProduct: 'object' },
          children: ['ProductCard'],
          description: 'List of products'
        },
        {
          name: 'ProductCard',
          type: 'interactive',
          props: ['product', 'onEdit', 'onDelete'],
          state: {},
          children: [],
          description: 'Individual product card'
        }
      ],
      componentHierarchy: {
        'App': ['Header', 'Main', 'Footer'],
        'Header': ['NavMenu'],
        'Main': ['ProductList', 'ProductForm'],
        'ProductList': ['ProductCard'],
        'ProductCard': [],
        'ProductForm': []
      },
      stateManagement: {
        strategy: 'centralized',
        globalState: {
          user: 'object',
          products: 'array',
          ui: 'object'
        },
        stateFlow: ['unidirectional', 'state-actions']
      },
      dataFlow: {
        pattern: 'flux-like',
        apiCalls: ['getProducts', 'createProduct', 'updateProduct', 'deleteProduct'],
        eventHandling: {
          pattern: 'action-dispatching',
          events: ['USER_LOGIN', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED']
        }
      },
      styling: {
        approach: 'modular',
        structure: {
          main: 'css/main.css',
          components: ['css/components/', 'css/layout/'],
          utilities: 'css/utilities.css'
        },
        conventions: ['component-scoped', 'CSS modules']
      },
      routing: {
        enabled: true,
        routes: [
          { path: '/', component: 'ProductList' },
          { path: '/products/new', component: 'ProductForm' },
          { path: '/products/:id', component: 'ProductDetail' }
        ],
        routeComponents: {
          'ProductList': 'components/ProductList',
          'ProductForm': 'components/ProductForm',
          'ProductDetail': 'components/ProductDetail'
        },
        navigationPattern: 'history'
      },
      metadata: {
        planner: 'FrontendArchitecturePlanner',
        plannedAt: 1234567890,
        complexity: 'medium',
        mockScenario: 'modular-frontend'
      }
    }
  }
};