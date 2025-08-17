/**
 * DecompositionTreeComponent Integration Tests
 * Tests tree updates from planning decomposition and user interactions
 */

import { jest } from '@jest/globals';
import { DecompositionTreeComponent } from '../../src/components/tool-registry/components/panels/DecompositionTreeComponent.js';

describe('DecompositionTreeComponent Integration Tests', () => {
  let component;
  let mockUmbilical;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    document.body.appendChild(dom);

    // Create mock umbilical with tree event handlers
    mockUmbilical = {
      dom,
      onMount: jest.fn(),
      onNodeSelect: jest.fn(),
      onNodeExpand: jest.fn(),
      onNodeCollapse: jest.fn(),
      onNodeHover: jest.fn(),
      onComplexityChange: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await DecompositionTreeComponent.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  });

  describe('Tree Updates from Planning Decomposition', () => {
    test('should load and display hierarchical decomposition from planner', () => {
      const decompositionTree = {
        id: 'root',
        description: 'Build REST API for user management',
        complexity: 'COMPLEX',
        children: [
          {
            id: 'auth',
            description: 'Implement authentication system',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'auth-routes',
                description: 'Create authentication routes',
                complexity: 'SIMPLE',
                children: []
              },
              {
                id: 'jwt-tokens',
                description: 'Implement JWT token handling',
                complexity: 'SIMPLE',
                children: []
              }
            ]
          },
          {
            id: 'user-crud',
            description: 'Create user CRUD operations',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'user-routes',
                description: 'Create user API routes',
                complexity: 'SIMPLE',
                children: []
              },
              {
                id: 'user-validation',
                description: 'Add input validation',
                complexity: 'SIMPLE',
                children: []
              }
            ]
          },
          {
            id: 'database',
            description: 'Set up database integration',
            complexity: 'SIMPLE',
            children: []
          }
        ]
      };

      // Load the tree
      component.setTree(decompositionTree);

      // Verify tree is loaded
      const loadedTree = component.getTree();
      expect(loadedTree).toEqual(decompositionTree);

      // Check tree statistics
      const nodeCount = component.getNodeCount();
      expect(nodeCount).toBe(8); // 1 root + 3 level1 + 4 level2

      const depth = component.getTreeDepth();
      expect(depth).toBe(3);

      const complexityStats = component.getComplexityStats();
      expect(complexityStats.COMPLEX).toBe(3);
      expect(complexityStats.SIMPLE).toBe(5);
      expect(complexityStats.total).toBe(8);
    });

    test('should handle streaming updates during decomposition', () => {
      // Start with partial tree
      const partialTree = {
        id: 'root',
        description: 'Build web application',
        complexity: 'COMPLEX',
        children: []
      };

      component.setTree(partialTree);
      expect(component.getNodeCount()).toBe(1);

      // Simulate streaming update - add first level nodes
      const firstUpdate = {
        id: 'root',
        description: 'Build web application',
        complexity: 'COMPLEX',
        children: [
          {
            id: 'frontend',
            description: 'Build frontend interface',
            complexity: 'COMPLEX',
            children: []
          },
          {
            id: 'backend',
            description: 'Create backend services',
            complexity: 'COMPLEX',
            children: []
          }
        ]
      };

      component.setTree(firstUpdate);
      expect(component.getNodeCount()).toBe(3);

      // Simulate further decomposition - add second level
      const secondUpdate = {
        id: 'root',
        description: 'Build web application',
        complexity: 'COMPLEX',
        children: [
          {
            id: 'frontend',
            description: 'Build frontend interface',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'components',
                description: 'Create React components',
                complexity: 'SIMPLE',
                children: []
              },
              {
                id: 'routing',
                description: 'Set up routing',
                complexity: 'SIMPLE',
                children: []
              }
            ]
          },
          {
            id: 'backend',
            description: 'Create backend services',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'api',
                description: 'Build REST API',
                complexity: 'SIMPLE',
                children: []
              }
            ]
          }
        ]
      };

      component.setTree(secondUpdate);
      expect(component.getNodeCount()).toBe(6);

      // Verify all nodes are expanded by default for new decomposition
      const frontendNode = component.findNode('frontend');
      const backendNode = component.findNode('backend');
      expect(frontendNode.children.length).toBe(2);
      expect(backendNode.children.length).toBe(1);
    });

    test('should handle complex trees with deep nesting', () => {
      const deepTree = {
        id: 'enterprise-app',
        description: 'Build enterprise application',
        complexity: 'COMPLEX',
        children: [
          {
            id: 'microservices',
            description: 'Implement microservices architecture',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'user-service',
                description: 'User management service',
                complexity: 'COMPLEX',
                children: [
                  {
                    id: 'user-auth',
                    description: 'Authentication module',
                    complexity: 'COMPLEX',
                    children: [
                      {
                        id: 'oauth2',
                        description: 'OAuth2 implementation',
                        complexity: 'SIMPLE',
                        children: []
                      },
                      {
                        id: 'jwt',
                        description: 'JWT token handling',
                        complexity: 'SIMPLE',
                        children: []
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      component.setTree(deepTree);

      // Verify deep nesting is handled correctly
      expect(component.getTreeDepth()).toBe(5);
      expect(component.getNodeCount()).toBe(6);

      // Check leaf nodes
      const leafNodes = component.getLeafNodes();
      expect(leafNodes.length).toBe(2);
      expect(leafNodes.map(n => n.id)).toEqual(['oauth2', 'jwt']);

      // Verify node path calculation
      const pathToJWT = component.getNodePath('jwt');
      expect(pathToJWT).toEqual(['enterprise-app', 'microservices', 'user-service', 'user-auth', 'jwt']);
    });
  });

  describe('User Interaction Integration', () => {
    test('should handle node selection and notify umbilical', () => {
      const testTree = {
        id: 'root',
        description: 'Test project',
        complexity: 'COMPLEX',
        children: [
          {
            id: 'task1',
            description: 'First task',
            complexity: 'SIMPLE',
            children: []
          },
          {
            id: 'task2',
            description: 'Second task',
            complexity: 'SIMPLE',
            children: []
          }
        ]
      };

      component.setTree(testTree);

      // Select a node
      component.selectNode('task1');

      // Verify selection state
      expect(mockUmbilical.onNodeSelect).toHaveBeenCalledWith({
        id: 'task1',
        description: 'First task',
        complexity: 'SIMPLE',
        children: []
      });

      // Clear selection
      component.clearSelection();
      
      // Select different node
      component.selectNode('task2');
      expect(mockUmbilical.onNodeSelect).toHaveBeenCalledTimes(2);
    });

    test('should handle expand/collapse operations and notify umbilical', () => {
      const treeWithChildren = {
        id: 'parent',
        description: 'Parent task',
        complexity: 'COMPLEX',
        children: [
          { id: 'child1', description: 'Child 1', complexity: 'SIMPLE', children: [] },
          { id: 'child2', description: 'Child 2', complexity: 'SIMPLE', children: [] }
        ]
      };

      component.setTree(treeWithChildren);

      // Initially expanded by default, so collapse first
      component.collapseNode('parent');
      expect(mockUmbilical.onNodeCollapse).toHaveBeenCalledWith('parent');

      // Then expand
      component.expandNode('parent');
      expect(mockUmbilical.onNodeExpand).toHaveBeenCalledWith('parent');

      // Test toggle functionality
      component.toggleNodeExpansion('parent');
      expect(mockUmbilical.onNodeCollapse).toHaveBeenCalledTimes(2);

      component.toggleNodeExpansion('parent');
      expect(mockUmbilical.onNodeExpand).toHaveBeenCalledTimes(2);
    });

    test('should handle expand/collapse all operations efficiently', () => {
      const complexTree = {
        id: 'root',
        description: 'Complex project',
        complexity: 'COMPLEX',
        children: [
          {
            id: 'module1',
            description: 'Module 1',
            complexity: 'COMPLEX',
            children: [
              { id: 'task1', description: 'Task 1', complexity: 'SIMPLE', children: [] },
              { id: 'task2', description: 'Task 2', complexity: 'SIMPLE', children: [] }
            ]
          },
          {
            id: 'module2',
            description: 'Module 2',
            complexity: 'COMPLEX',
            children: [
              { id: 'task3', description: 'Task 3', complexity: 'SIMPLE', children: [] }
            ]
          }
        ]
      };

      component.setTree(complexTree);

      // Test collapse all
      component.collapseAll();
      
      // Verify no nodes are expanded (except implicitly expanded by having children)
      const expandedNodes = component.model.getState('expandedNodes');
      expect(expandedNodes.size).toBe(0);

      // Test expand all
      component.expandAll();
      
      // Verify all parent nodes are expanded
      expect(expandedNodes.has('root')).toBe(true);
      expect(expandedNodes.has('module1')).toBe(true);
      expect(expandedNodes.has('module2')).toBe(true);
    });

    test('should handle complexity highlighting', () => {
      const mixedComplexityTree = {
        id: 'root',
        description: 'Mixed complexity project',
        complexity: 'COMPLEX',
        children: [
          { id: 'simple1', description: 'Simple task 1', complexity: 'SIMPLE', children: [] },
          { id: 'complex1', description: 'Complex task 1', complexity: 'COMPLEX', children: [] },
          { id: 'simple2', description: 'Simple task 2', complexity: 'SIMPLE', children: [] }
        ]
      };

      component.setTree(mixedComplexityTree);

      // Highlight SIMPLE nodes
      component.highlightComplexity('SIMPLE');
      
      const simpleNodes = component.getNodesByComplexity('SIMPLE');
      expect(simpleNodes.length).toBe(2);
      expect(simpleNodes.map(n => n.id)).toEqual(['simple1', 'simple2']);

      // Highlight COMPLEX nodes
      component.highlightComplexity('COMPLEX');
      
      const complexNodes = component.getNodesByComplexity('COMPLEX');
      expect(complexNodes.length).toBe(2); // root + complex1
      expect(complexNodes.map(n => n.id)).toEqual(['root', 'complex1']);
    });
  });

  describe('Tree Modification Integration', () => {
    test('should update node properties and trigger re-render', () => {
      const modifiableTree = {
        id: 'root',
        description: 'Original description',
        complexity: 'SIMPLE',
        children: [
          { id: 'child', description: 'Child task', complexity: 'SIMPLE', children: [] }
        ]
      };

      component.setTree(modifiableTree);

      // Update node description
      component.updateNode('root', { 
        description: 'Updated description',
        complexity: 'COMPLEX'
      });

      const updatedNode = component.findNode('root');
      expect(updatedNode.description).toBe('Updated description');
      expect(updatedNode.complexity).toBe('COMPLEX');

      // Verify complexity change notification
      expect(mockUmbilical.onComplexityChange).toHaveBeenCalledWith('root', 'COMPLEX');
    });

    test('should add and remove nodes dynamically', () => {
      const baseTree = {
        id: 'root',
        description: 'Base project',
        complexity: 'COMPLEX',
        children: []
      };

      component.setTree(baseTree);
      expect(component.getNodeCount()).toBe(1);

      // Add child node
      const newChild = {
        id: 'new-task',
        description: 'Dynamically added task',
        complexity: 'SIMPLE',
        children: []
      };

      component.addChildNode('root', newChild);
      expect(component.getNodeCount()).toBe(2);

      const addedNode = component.findNode('new-task');
      expect(addedNode).toEqual(newChild);

      // Remove the node
      component.removeNode('new-task');
      expect(component.getNodeCount()).toBe(1);
      expect(component.findNode('new-task')).toBeNull();
    });

    test('should handle filtering operations', () => {
      const searchableTree = {
        id: 'root',
        description: 'Project with API and database components',
        complexity: 'COMPLEX',
        children: [
          { id: 'api', description: 'Build REST API', complexity: 'COMPLEX', children: [] },
          { id: 'database', description: 'Set up database', complexity: 'SIMPLE', children: [] },
          { id: 'frontend', description: 'Create user interface', complexity: 'COMPLEX', children: [] }
        ]
      };

      component.setTree(searchableTree);

      // Filter by term "API"
      component.filterNodes('API');
      
      // The filtering logic should be applied to the view
      // Note: The actual filtering is handled in the view layer
      expect(component.model.getState('filter')).toBe('API');

      // Clear filter
      component.clearFilter();
      expect(component.model.getState('filter')).toBeNull();
    });
  });

  describe('Integration with Planning System', () => {
    test('should receive decomposition updates from planning actor', () => {
      // Simulate receiving decomposition from planning system
      const planningResult = {
        hierarchy: {
          root: {
            id: 'build-ecommerce',
            description: 'Build e-commerce platform',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'product-catalog',
                description: 'Create product catalog',
                complexity: 'COMPLEX',
                children: [
                  {
                    id: 'product-listing',
                    description: 'Implement product listing',
                    complexity: 'SIMPLE',
                    children: []
                  }
                ]
              },
              {
                id: 'shopping-cart',
                description: 'Implement shopping cart',
                complexity: 'COMPLEX',
                children: []
              }
            ]
          }
        }
      };

      // Load the planning result
      component.setTree(planningResult.hierarchy.root);

      // Verify the decomposition is loaded correctly
      expect(component.getNodeCount()).toBe(4);
      expect(component.getTreeDepth()).toBe(3);

      // Check specific nodes
      const catalogNode = component.findNode('product-catalog');
      expect(catalogNode.children.length).toBe(1);

      const listingNode = component.findNode('product-listing');
      expect(listingNode.complexity).toBe('SIMPLE');
    });

    test('should handle validation states from planning validation', () => {
      const treeWithValidation = {
        id: 'root',
        description: 'Validated plan',
        complexity: 'COMPLEX',
        validation: {
          feasible: true,
          toolsAvailable: true,
          confidence: 0.95
        },
        children: [
          {
            id: 'task1',
            description: 'Feasible task',
            complexity: 'SIMPLE',
            validation: {
              feasible: true,
              toolsAvailable: true,
              confidence: 0.9
            },
            children: []
          },
          {
            id: 'task2',
            description: 'Problematic task',
            complexity: 'SIMPLE',
            validation: {
              feasible: false,
              toolsAvailable: false,
              confidence: 0.3,
              issues: ['No suitable tools found']
            },
            children: []
          }
        ]
      };

      component.setTree(treeWithValidation);

      // Verify validation data is preserved
      const task1 = component.findNode('task1');
      expect(task1.validation.feasible).toBe(true);

      const task2 = component.findNode('task2');
      expect(task2.validation.feasible).toBe(false);
      expect(task2.validation.issues).toContain('No suitable tools found');
    });

    test('should provide tree analysis for planning optimization', () => {
      const analysisTree = {
        id: 'root',
        description: 'Microservices project',
        complexity: 'COMPLEX',
        children: [
          {
            id: 'service1',
            description: 'User service',
            complexity: 'COMPLEX',
            children: [
              { id: 'auth', description: 'Authentication', complexity: 'SIMPLE', children: [] },
              { id: 'profile', description: 'User profiles', complexity: 'SIMPLE', children: [] }
            ]
          },
          {
            id: 'service2',
            description: 'Payment service',
            complexity: 'COMPLEX',
            children: [
              { id: 'billing', description: 'Billing logic', complexity: 'COMPLEX', children: [] },
              { id: 'receipts', description: 'Receipt generation', complexity: 'SIMPLE', children: [] }
            ]
          },
          { id: 'deployment', description: 'Deployment setup', complexity: 'SIMPLE', children: [] }
        ]
      };

      component.setTree(analysisTree);

      // Get complexity distribution
      const stats = component.getComplexityStats();
      expect(stats.COMPLEX).toBe(4); // root, service1, service2, billing
      expect(stats.SIMPLE).toBe(4); // auth, profile, receipts, deployment
      expect(stats.total).toBe(8);

      // Get leaf nodes (actionable tasks)
      const leafNodes = component.getLeafNodes();
      expect(leafNodes.length).toBe(5);
      expect(leafNodes.every(node => !node.children || node.children.length === 0)).toBe(true);

      // Analyze by complexity
      const simpleNodes = component.getNodesByComplexity('SIMPLE');
      expect(simpleNodes.length).toBe(4);

      const complexNodes = component.getNodesByComplexity('COMPLEX');
      expect(complexNodes.length).toBe(4);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty and null trees gracefully', () => {
      // Test with null tree
      component.setTree(null);
      expect(component.getTree()).toBeNull();
      expect(component.getNodeCount()).toBe(0);
      expect(component.getTreeDepth()).toBe(0);

      // Test with empty tree
      const emptyTree = { id: 'empty', description: 'Empty', complexity: 'SIMPLE', children: [] };
      component.setTree(emptyTree);
      expect(component.getNodeCount()).toBe(1);
      expect(component.getTreeDepth()).toBe(1);
    });

    test('should handle malformed tree structures', () => {
      const malformedTree = {
        id: 'root',
        description: 'Has issues',
        complexity: 'COMPLEX',
        children: [
          { id: 'missing-description', complexity: 'SIMPLE', children: [] },
          { description: 'Missing ID', complexity: 'SIMPLE', children: [] },
          { id: 'no-complexity', description: 'No complexity', children: [] }
        ]
      };

      // Should not throw
      expect(() => {
        component.setTree(malformedTree);
      }).not.toThrow();

      // Should still be able to work with valid parts
      expect(component.getNodeCount()).toBe(4);
    });

    test('should handle operations on non-existent nodes gracefully', () => {
      const simpleTree = {
        id: 'root',
        description: 'Simple tree',
        complexity: 'SIMPLE',
        children: []
      };

      component.setTree(simpleTree);

      // Operations on non-existent nodes should not crash
      expect(component.findNode('non-existent')).toBeNull();
      
      // Update non-existent node should fail silently
      component.updateNode('non-existent', { description: 'Updated' });
      
      // Remove non-existent node should not affect tree
      const originalCount = component.getNodeCount();
      component.removeNode('non-existent');
      expect(component.getNodeCount()).toBe(originalCount);

      // Select non-existent node should not trigger callbacks
      component.selectNode('non-existent');
      expect(mockUmbilical.onNodeSelect).not.toHaveBeenCalled();
    });

    test('should handle performance with large trees', () => {
      // Create a large tree
      const createLargeTree = (depth, breadth) => {
        const createNode = (id, level) => {
          const node = {
            id: `node-${id}`,
            description: `Node ${id}`,
            complexity: level % 2 === 0 ? 'COMPLEX' : 'SIMPLE',
            children: []
          };

          if (level < depth) {
            for (let i = 0; i < breadth; i++) {
              node.children.push(createNode(`${id}-${i}`, level + 1));
            }
          }

          return node;
        };

        return createNode('root', 0);
      };

      const largeTree = createLargeTree(4, 3); // 4 levels, 3 children each = 121 nodes

      const startTime = Date.now();
      component.setTree(largeTree);
      const loadTime = Date.now() - startTime;

      // Should load within reasonable time
      expect(loadTime).toBeLessThan(1000);

      // Verify tree structure
      expect(component.getNodeCount()).toBe(121); // 1 + 3 + 9 + 27 + 81
      expect(component.getTreeDepth()).toBe(5);

      // Test operations on large tree
      const operationStart = Date.now();
      component.expandAll();
      component.getComplexityStats();
      component.getLeafNodes();
      const operationTime = Date.now() - operationStart;

      expect(operationTime).toBeLessThan(2000);
    });
  });

  describe('State Consistency', () => {
    test('should maintain consistent state across operations', () => {
      const testTree = {
        id: 'root',
        description: 'State test',
        complexity: 'COMPLEX',
        children: [
          {
            id: 'branch1',
            description: 'Branch 1',
            complexity: 'COMPLEX',
            children: [
              { id: 'leaf1', description: 'Leaf 1', complexity: 'SIMPLE', children: [] }
            ]
          }
        ]
      };

      component.setTree(testTree);

      // Perform various operations
      component.selectNode('leaf1');
      component.collapseNode('branch1');
      component.highlightComplexity('SIMPLE');
      component.updateNode('leaf1', { description: 'Updated Leaf 1' });

      // Verify state consistency
      const selectedNode = component.findNode('leaf1');
      expect(selectedNode.description).toBe('Updated Leaf 1');

      // Tree structure should remain intact
      expect(component.getNodeCount()).toBe(3);
      expect(component.getTreeDepth()).toBe(3);
    });

    test('should handle state reset correctly', () => {
      const tree = {
        id: 'root',
        description: 'Test reset',
        complexity: 'COMPLEX',
        children: [
          { id: 'child', description: 'Child', complexity: 'SIMPLE', children: [] }
        ]
      };

      component.setTree(tree);
      component.selectNode('child');
      component.highlightComplexity('SIMPLE');

      // Reset state
      component.model.reset();

      // Verify reset
      expect(component.getTree()).toBeNull();
      expect(component.model.getState('selectedNodeId')).toBeNull();
      expect(component.model.getState('highlightedComplexity')).toBeNull();
    });
  });
});