/**
 * Declarative Strategy Example - Simple object-based data flow
 * 
 * Shows how parent contexts declaratively supply and route data
 * to/from child tasks using query and update specifications.
 */

// Example 1: Simple data extraction and routing
const simpleExample = {
  strategy: 'declarative',
  description: 'Process user data with multiple child tasks',
  
  // Parent context data
  context: {
    user: {
      id: 123,
      name: 'John Doe',
      email: 'john@example.com',
      profile: {
        age: 30,
        location: 'NYC',
        preferences: {
          theme: 'dark',
          notifications: true
        }
      }
    },
    settings: {
      maxRetries: 3,
      timeout: 5000
    },
    results: {}  // Will be populated by child tasks
  },
  
  // Declarative configuration for child tasks
  declarativeConfig: {
    children: [
      {
        id: 'validate-user',
        description: 'Validate user data',
        strategy: 'validation',
        
        // Query spec: what data to pull from parent context
        querySpec: {
          // Simple path queries
          userId: 'user.id',
          userEmail: 'user.email',
          userName: 'user.name'
        },
        
        // Update spec: how to route results back to parent
        updateSpec: {
          set: {
            'results.validation': '$result'  // $result is the child's return value
          }
        }
      },
      
      {
        id: 'process-preferences',
        description: 'Process user preferences',
        strategy: 'preferences',
        
        // More complex query with multiple sources
        querySpec: {
          queries: {
            preferences: 'user.profile.preferences',
            location: 'user.profile.location',
            config: {
              path: 'settings',
              transform: (settings) => ({
                retries: settings.maxRetries,
                timeoutMs: settings.timeout
              })
            }
          }
        },
        
        // Update multiple paths
        updateSpec: {
          updates: [
            {
              path: 'results.preferences',
              value: '$result.processed'
            },
            {
              path: 'results.metadata.processedAt',
              value: () => new Date().toISOString()
            }
          ]
        }
      }
    ]
  }
};

// Example 2: Conditional data flow
const conditionalExample = {
  strategy: 'declarative',
  description: 'Process order with conditional child tasks',
  
  context: {
    order: {
      id: 'ORD-123',
      items: [
        { id: 1, name: 'Widget', price: 29.99, quantity: 2 },
        { id: 2, name: 'Gadget', price: 49.99, quantity: 1 }
      ],
      customer: {
        id: 'CUST-456',
        tier: 'premium'
      },
      shipping: {
        method: 'express',
        address: '123 Main St'
      }
    },
    processing: {
      steps: []
    }
  },
  
  declarativeConfig: {
    children: [
      {
        id: 'calculate-total',
        description: 'Calculate order total',
        strategy: 'calculation',
        
        // Query with computation
        querySpec: {
          items: 'order.items',
          customerTier: 'order.customer.tier',
          // Can include computed values
          subtotal: (context) => {
            const items = context.order.items;
            return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          }
        },
        
        // Update with transformation
        updateSpec: (contextRM, result) => {
          contextRM.update({
            path: 'order.total',
            value: result.total
          });
          contextRM.update({
            path: 'order.discount',
            value: result.discount
          });
        }
      },
      
      {
        id: 'apply-shipping',
        description: 'Calculate shipping costs',
        strategy: 'shipping',
        
        // Query dependent on previous child's results
        querySpec: {
          method: 'order.shipping.method',
          address: 'order.shipping.address',
          total: 'order.total'  // Set by previous child
        },
        
        // Transaction-style update
        updateSpec: {
          transaction: [
            { type: 'set', path: 'order.shipping.cost' },
            { type: 'push', path: 'processing.steps', value: 'shipping-calculated' }
          ]
        }
      }
    ]
  }
};

// Example 3: Using fluent query API
const fluentQueryExample = {
  strategy: 'declarative',
  description: 'Process collection data with fluent queries',
  
  context: {
    products: [
      { id: 1, name: 'Product A', category: 'electronics', price: 99.99, inStock: true },
      { id: 2, name: 'Product B', category: 'electronics', price: 149.99, inStock: false },
      { id: 3, name: 'Product C', category: 'books', price: 19.99, inStock: true },
      { id: 4, name: 'Product D', category: 'books', price: 29.99, inStock: true }
    ],
    filters: {
      category: 'electronics',
      maxPrice: 150
    },
    analysis: {}
  },
  
  declarativeConfig: {
    children: [
      {
        id: 'analyze-inventory',
        description: 'Analyze product inventory',
        strategy: 'inventory',
        
        // Using fluent query builder
        querySpec: {
          builder: [
            { method: 'where', args: [(item) => item.inStock] },
            { method: 'where', args: [(item) => item.category === 'electronics'] },
            { method: 'orderBy', args: ['price', 'desc'] },
            { method: 'limit', args: [5] }
          ]
        },
        
        updateSpec: {
          set: {
            'analysis.inStockElectronics': '$result'
          }
        }
      },
      
      {
        id: 'price-analysis',
        description: 'Analyze pricing',
        strategy: 'pricing',
        
        // Complex query with aggregation
        querySpec: (contextRM) => {
          const handle = contextRM.getHandle();
          const products = handle.path('products').value();
          
          return {
            categories: [...new Set(products.map(p => p.category))],
            avgPrice: products.reduce((sum, p) => sum + p.price, 0) / products.length,
            priceRange: {
              min: Math.min(...products.map(p => p.price)),
              max: Math.max(...products.map(p => p.price))
            },
            filtered: products.filter(p => 
              p.price <= handle.path('filters.maxPrice').value()
            )
          };
        },
        
        updateSpec: {
          set: {
            'analysis.pricing': '$result'
          }
        }
      }
    ]
  }
};

// Example 4: Nested context updates
const nestedUpdateExample = {
  strategy: 'declarative',
  description: 'Build report with nested updates',
  
  context: {
    report: {
      title: 'Monthly Report',
      sections: {},
      metadata: {
        created: new Date().toISOString(),
        version: 1
      }
    },
    data: {
      sales: [100, 150, 200, 175],
      costs: [50, 60, 70, 65]
    }
  },
  
  declarativeConfig: {
    children: [
      {
        id: 'sales-section',
        description: 'Generate sales section',
        strategy: 'report-section',
        
        querySpec: {
          sales: 'data.sales',
          title: 'report.title'
        },
        
        // Nested object update
        updateSpec: {
          set: {
            'report.sections.sales': {
              title: 'Sales Analysis',
              data: '$result.analysis',
              charts: '$result.charts',
              summary: '$result.summary'
            }
          }
        }
      },
      
      {
        id: 'profit-section',
        description: 'Generate profit section',
        strategy: 'report-section',
        
        // Query both original data and previous child results
        querySpec: {
          sales: 'data.sales',
          costs: 'data.costs',
          salesAnalysis: 'report.sections.sales.data'
        },
        
        // Merge update (preserves existing data)
        updateSpec: {
          transaction: [
            { 
              type: 'merge', 
              path: 'report.sections.profit',
              value: '$result'
            },
            {
              type: 'set',
              path: 'report.metadata.lastUpdated',
              value: () => new Date().toISOString()
            }
          ]
        }
      }
    ]
  }
};

// Export examples
export const declarativeExamples = {
  simple: simpleExample,
  conditional: conditionalExample,
  fluentQuery: fluentQueryExample,
  nestedUpdate: nestedUpdateExample
};

// Usage demonstration
export function demonstrateDeclarativeStrategy() {
  console.log('Declarative Strategy Examples:');
  console.log('==============================\n');
  
  // Simple example
  console.log('1. Simple Data Extraction:');
  console.log('   - Parent has user data');
  console.log('   - Child "validate-user" queries: user.id, user.email, user.name');
  console.log('   - Results routed to: results.validation\n');
  
  // Conditional example
  console.log('2. Conditional Data Flow:');
  console.log('   - Parent has order data');
  console.log('   - Child "calculate-total" computes subtotal');
  console.log('   - Child "apply-shipping" uses computed total');
  console.log('   - Updates are transactional\n');
  
  // Fluent query example
  console.log('3. Fluent Query API:');
  console.log('   - Parent has products collection');
  console.log('   - Child uses fluent: where().orderBy().limit()');
  console.log('   - Results stored in analysis object\n');
  
  // Nested update example
  console.log('4. Nested Updates:');
  console.log('   - Parent has report structure');
  console.log('   - Children build report sections');
  console.log('   - Updates merge into nested objects');
  console.log('   - Metadata tracked automatically\n');
}