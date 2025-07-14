/**
 * Configuration for LLM Planner tests
 * 
 * This file contains test scenarios and configurations for validating
 * the LLM planner's capability to generate structured plans.
 */

export const TEST_SCENARIOS = {
  // Simple scenarios for basic validation
  simple: [
    {
      name: 'Hello World Program',
      description: 'Create a simple Hello World program',
      inputs: ['programming-language'],
      requiredOutputs: ['hello-world-program'],
      allowableActions: [
        {
          type: 'create-file',
          inputs: ['file-content'],
          outputs: ['file-created']
        },
        {
          type: 'compile-program',
          inputs: ['source-code'],
          outputs: ['compiled-program']
        },
        {
          type: 'run-program',
          inputs: ['executable'],
          outputs: ['program-output']
        }
      ]
    },
    {
      name: 'Static Website',
      description: 'Create a static website with HTML, CSS, and JavaScript',
      inputs: ['design-requirements'],
      requiredOutputs: ['static-website'],
      allowableActions: [
        {
          type: 'create-html-file',
          inputs: ['html-content'],
          outputs: ['html-file']
        },
        {
          type: 'create-css-file',
          inputs: ['css-styles'],
          outputs: ['css-file']
        },
        {
          type: 'create-js-file',
          inputs: ['js-code'],
          outputs: ['js-file']
        },
        {
          type: 'create-directory',
          inputs: ['directory-name'],
          outputs: ['directory-created']
        },
        {
          type: 'optimize-assets',
          inputs: ['asset-files'],
          outputs: ['optimized-assets']
        }
      ]
    }
  ],

  // Medium complexity scenarios
  medium: [
    {
      name: 'REST API Server',
      description: 'Create a REST API server with authentication and database integration',
      inputs: ['api-requirements', 'database-schema'],
      requiredOutputs: ['api-server', 'api-documentation'],
      allowableActions: [
        {
          type: 'create-file',
          inputs: ['file-content'],
          outputs: ['file-created']
        },
        {
          type: 'create-directory',
          inputs: ['directory-name'],
          outputs: ['directory-created']
        },
        {
          type: 'install-dependencies',
          inputs: ['package-list'],
          outputs: ['dependencies-installed']
        },
        {
          type: 'setup-database',
          inputs: ['database-config'],
          outputs: ['database-ready']
        },
        {
          type: 'implement-auth',
          inputs: ['auth-strategy'],
          outputs: ['auth-system']
        },
        {
          type: 'create-routes',
          inputs: ['route-definitions'],
          outputs: ['routes-implemented']
        },
        {
          type: 'implement-middleware',
          inputs: ['middleware-config'],
          outputs: ['middleware-configured']
        },
        {
          type: 'write-tests',
          inputs: ['test-specs'],
          outputs: ['tests-written']
        },
        {
          type: 'generate-docs',
          inputs: ['code-base'],
          outputs: ['api-documentation']
        },
        {
          type: 'run-tests',
          inputs: ['test-suite'],
          outputs: ['test-results']
        }
      ]
    },
    {
      name: 'React Application',
      description: 'Build a React application with TypeScript, routing, and state management',
      inputs: ['project-requirements', 'ui-designs'],
      requiredOutputs: ['react-app', 'test-suite', 'build-config'],
      allowableActions: [
        {
          type: 'create-react-app',
          inputs: ['app-name'],
          outputs: ['react-project']
        },
        {
          type: 'setup-typescript',
          inputs: ['typescript-config'],
          outputs: ['typescript-configured']
        },
        {
          type: 'install-dependencies',
          inputs: ['package-list'],
          outputs: ['dependencies-installed']
        },
        {
          type: 'setup-routing',
          inputs: ['route-config'],
          outputs: ['routing-configured']
        },
        {
          type: 'setup-state-management',
          inputs: ['state-config'],
          outputs: ['state-management-ready']
        },
        {
          type: 'create-components',
          inputs: ['component-specs'],
          outputs: ['components-created']
        },
        {
          type: 'implement-features',
          inputs: ['feature-specs'],
          outputs: ['features-implemented']
        },
        {
          type: 'setup-styling',
          inputs: ['style-config'],
          outputs: ['styling-configured']
        },
        {
          type: 'write-tests',
          inputs: ['test-specs'],
          outputs: ['tests-written']
        },
        {
          type: 'setup-build',
          inputs: ['build-config'],
          outputs: ['build-configured']
        }
      ]
    }
  ],

  // Complex scenarios for advanced validation
  complex: [
    {
      name: 'Microservices Architecture',
      description: 'Create a microservices architecture with API gateway, user service, notification service, and monitoring',
      inputs: ['system-requirements', 'architecture-specs', 'scaling-requirements'],
      requiredOutputs: ['microservices-system', 'api-gateway', 'monitoring-setup', 'deployment-config'],
      allowableActions: [
        {
          type: 'create-service',
          inputs: ['service-spec'],
          outputs: ['service-created']
        },
        {
          type: 'setup-database',
          inputs: ['database-config'],
          outputs: ['database-ready']
        },
        {
          type: 'configure-api-gateway',
          inputs: ['gateway-config'],
          outputs: ['api-gateway']
        },
        {
          type: 'setup-message-queue',
          inputs: ['queue-config'],
          outputs: ['message-queue-ready']
        },
        {
          type: 'implement-service-discovery',
          inputs: ['discovery-config'],
          outputs: ['service-discovery-ready']
        },
        {
          type: 'setup-monitoring',
          inputs: ['monitoring-config'],
          outputs: ['monitoring-setup']
        },
        {
          type: 'configure-load-balancer',
          inputs: ['lb-config'],
          outputs: ['load-balancer-ready']
        },
        {
          type: 'setup-security',
          inputs: ['security-config'],
          outputs: ['security-configured']
        },
        {
          type: 'implement-caching',
          inputs: ['cache-config'],
          outputs: ['caching-configured']
        },
        {
          type: 'setup-logging',
          inputs: ['logging-config'],
          outputs: ['logging-configured']
        },
        {
          type: 'create-deployment-scripts',
          inputs: ['deployment-specs'],
          outputs: ['deployment-config']
        },
        {
          type: 'setup-ci-cd',
          inputs: ['ci-cd-config'],
          outputs: ['ci-cd-configured']
        },
        {
          type: 'write-integration-tests',
          inputs: ['integration-specs'],
          outputs: ['integration-tests']
        },
        {
          type: 'setup-performance-monitoring',
          inputs: ['performance-config'],
          outputs: ['performance-monitoring']
        }
      ]
    },
    {
      name: 'Full Stack E-commerce Platform',
      description: 'Build a complete e-commerce platform with user authentication, product catalog, shopping cart, payment processing, and admin dashboard',
      inputs: ['business-requirements', 'design-system', 'payment-gateway-config'],
      requiredOutputs: ['e-commerce-platform', 'admin-dashboard', 'mobile-app', 'deployment-config'],
      allowableActions: [
        {
          type: 'setup-backend-framework',
          inputs: ['framework-config'],
          outputs: ['backend-framework-ready']
        },
        {
          type: 'create-database-schema',
          inputs: ['schema-design'],
          outputs: ['database-schema-created']
        },
        {
          type: 'implement-user-auth',
          inputs: ['auth-requirements'],
          outputs: ['auth-system']
        },
        {
          type: 'create-product-catalog',
          inputs: ['catalog-requirements'],
          outputs: ['product-catalog']
        },
        {
          type: 'implement-shopping-cart',
          inputs: ['cart-requirements'],
          outputs: ['shopping-cart']
        },
        {
          type: 'integrate-payment-gateway',
          inputs: ['payment-config'],
          outputs: ['payment-system']
        },
        {
          type: 'create-frontend-app',
          inputs: ['frontend-requirements'],
          outputs: ['frontend-app']
        },
        {
          type: 'create-admin-dashboard',
          inputs: ['admin-requirements'],
          outputs: ['admin-dashboard']
        },
        {
          type: 'implement-search-functionality',
          inputs: ['search-requirements'],
          outputs: ['search-system']
        },
        {
          type: 'setup-email-notifications',
          inputs: ['email-config'],
          outputs: ['email-system']
        },
        {
          type: 'create-mobile-app',
          inputs: ['mobile-requirements'],
          outputs: ['mobile-app']
        },
        {
          type: 'implement-analytics',
          inputs: ['analytics-config'],
          outputs: ['analytics-system']
        },
        {
          type: 'setup-cdn',
          inputs: ['cdn-config'],
          outputs: ['cdn-configured']
        },
        {
          type: 'implement-caching-strategy',
          inputs: ['caching-requirements'],
          outputs: ['caching-system']
        },
        {
          type: 'setup-monitoring-alerting',
          inputs: ['monitoring-config'],
          outputs: ['monitoring-system']
        },
        {
          type: 'create-deployment-pipeline',
          inputs: ['deployment-requirements'],
          outputs: ['deployment-config']
        },
        {
          type: 'write-comprehensive-tests',
          inputs: ['testing-requirements'],
          outputs: ['test-suite']
        },
        {
          type: 'setup-backup-recovery',
          inputs: ['backup-config'],
          outputs: ['backup-system']
        }
      ]
    }
  ]
};

export const LLM_CONFIGS = {
  // Fast testing configuration
  fast: {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    maxRetries: 2,
    baseDelay: 500
  },
  
  // Balanced configuration
  balanced: {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    maxRetries: 3,
    baseDelay: 1000
  },
  
  // High-quality configuration
  quality: {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    maxRetries: 3,
    baseDelay: 1500
  },
  
  // Mock configuration for testing
  mock: {
    provider: 'mock',
    maxRetries: 1,
    baseDelay: 100
  }
};

export const PLANNER_CONFIGS = {
  // Quick testing
  quick: {
    maxSteps: 10,
    maxRetries: 2
  },
  
  // Standard configuration
  standard: {
    maxSteps: 20,
    maxRetries: 3
  },
  
  // Comprehensive configuration
  comprehensive: {
    maxSteps: 30,
    maxRetries: 5
  }
};