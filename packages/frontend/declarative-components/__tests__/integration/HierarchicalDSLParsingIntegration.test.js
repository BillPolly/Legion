/**
 * Integration tests for Hierarchical DSL Parsing
 * Tests complete hierarchical DSL compilation workflow:
 * - End-to-end parsing with HierarchicalDSLParser
 * - Integration with ComponentCompiler
 * - Real-world DSL examples
 * - Error handling in complex scenarios
 */

import { jest } from '@jest/globals';
import { HierarchicalDSLParser } from '../../src/compiler/HierarchicalDSLParser.js';
import { ComponentCompiler } from '../../src/compiler/ComponentCompiler.js';

describe('HierarchicalDSLParsing Integration Tests', () => {
  let hierarchicalParser;
  let componentCompiler;

  beforeEach(() => {
    hierarchicalParser = new HierarchicalDSLParser();
    componentCompiler = new ComponentCompiler();
  });

  describe('End-to-End DSL Parsing Workflow', () => {
    it('should parse complete TodoApp DSL with all hierarchical features', () => {
      const todoAppDsl = `
        TodoApp :: app => div.todo-application {
          children {
            TodoHeader :: header => header.app-header { header.title }
            mountPoint: "header-area"
            stateProjection: {
              "title": "app.title"
            }
          }
          children {
            TodoItem :: item => li.todo-item { item.text }
            repeat: "app.todos"
            mountPoint: "todo-list"
            stateProjection: {
              "text": "app.todos[{index}].text",
              "completed": "app.todos[{index}].completed",
              "id": "app.todos[{index}].id"
            }
          }
          children {
            TodoFooter :: footer => footer.app-footer { footer.remainingCount }
            mountPoint: "footer-area"
            stateProjection: {
              "remainingCount": "app.todos.filter(t => !t.completed).length",
              "totalCount": "app.todos.length",
              "hasCompleted": "app.todos.some(t => t.completed)"
            }
          }
        }
      `;

      const ast = hierarchicalParser.parse(todoAppDsl);

      // Verify root component structure
      expect(ast.type).toBe('Component');
      expect(ast.name).toBe('TodoApp');
      expect(ast.entityParam).toBe('app');
      expect(ast.body.type).toBe('Element');
      expect(ast.body.tagName).toBe('div');
      expect(ast.body.classes).toContain('todo-application');

      // Verify children structure
      expect(ast.body.children).toBeDefined();
      expect(ast.body.children.length).toBe(3);

      // Header component verification
      const headerBlock = ast.body.children[0];
      expect(headerBlock.type).toBe('ChildrenBlock');
      expect(headerBlock.mountPoint).toBe('header-area');
      expect(headerBlock.children.length).toBe(1);
      
      const headerComponent = headerBlock.children[0];
      expect(headerComponent.name).toBe('TodoHeader');
      expect(headerComponent.entityParam).toBe('header');
      expect(headerComponent.body.tagName).toBe('header');
      expect(headerComponent.body.classes).toContain('app-header');
      
      expect(headerBlock.stateProjection.title).toBe('app.title');

      // Repeated TodoItem verification
      const itemBlock = ast.body.children[1];
      expect(itemBlock.type).toBe('ChildrenBlock');
      expect(itemBlock.repeat).toBe('app.todos');
      expect(itemBlock.mountPoint).toBe('todo-list');
      expect(itemBlock.children[0].name).toBe('TodoItem');
      expect(itemBlock.stateProjection.text).toBe('app.todos[{index}].text');
      expect(itemBlock.stateProjection.completed).toBe('app.todos[{index}].completed');
      expect(itemBlock.stateProjection.id).toBe('app.todos[{index}].id');

      // Footer component verification
      const footerBlock = ast.body.children[2];
      expect(footerBlock.type).toBe('ChildrenBlock');
      expect(footerBlock.mountPoint).toBe('footer-area');
      expect(footerBlock.children[0].name).toBe('TodoFooter');
      expect(footerBlock.stateProjection.remainingCount).toBe('app.todos.filter(t => !t.completed).length');
      expect(footerBlock.stateProjection.totalCount).toBe('app.todos.length');
      expect(footerBlock.stateProjection.hasCompleted).toBe('app.todos.some(t => t.completed)');
    });

    it('should handle simple nested hierarchy with state projections', () => {
      const nestedDsl = `
        AdminDashboard :: dashboard => div.admin-dashboard {
          children {
            MetricsPanel :: metrics => section.metrics { metrics.value }
            mountPoint: "main-content"
            stateProjection: {
              "value": "dashboard.analytics.totalUsers"
            }
          }
          children {
            UsersList :: users => aside.users-panel { users.count }
            mountPoint: "sidebar"
            stateProjection: {
              "count": "dashboard.users.length"
            }
          }
        }
      `;

      const ast = hierarchicalParser.parse(nestedDsl);

      expect(ast.name).toBe('AdminDashboard');
      expect(ast.body.children.length).toBe(2);

      // Verify metrics panel structure
      const metricsBlock = ast.body.children[0];
      expect(metricsBlock.mountPoint).toBe('main-content');
      expect(metricsBlock.children[0].name).toBe('MetricsPanel');
      expect(metricsBlock.stateProjection.value).toBe('dashboard.analytics.totalUsers');

      // Verify users panel structure
      const usersBlock = ast.body.children[1];
      expect(usersBlock.mountPoint).toBe('sidebar');
      expect(usersBlock.children[0].name).toBe('UsersList');
      expect(usersBlock.stateProjection.count).toBe('dashboard.users.length');
    });
  });

  describe('Integration with ComponentCompiler', () => {
    it('should seamlessly integrate hierarchical parsing with basic component compilation', () => {
      const mixedDsl = `
        AppShell :: shell => div.app-shell {
          children {
            PageContent :: content => main.page-content { content.bodyText }
            mountPoint: "main-area"
            stateProjection: {
              "bodyText": "shell.currentPage.content",
              "title": "shell.currentPage.title"
            }
          }
        }
      `;

      // Test with HierarchicalDSLParser
      const hierarchicalAst = hierarchicalParser.parse(mixedDsl);
      
      // Test with basic ComponentCompiler
      const basicAst = componentCompiler.parseOnly(mixedDsl);

      // Both should parse successfully
      expect(hierarchicalAst.type).toBe('Component');
      expect(basicAst.type).toBe('Component');
      
      // Basic structure should be the same
      expect(hierarchicalAst.name).toBe(basicAst.name);
      expect(hierarchicalAst.entityParam).toBe(basicAst.entityParam);
      
      // HierarchicalDSLParser should provide additional validation
      expect(hierarchicalAst.body.children).toBeDefined();
      expect(hierarchicalAst.body.children.length).toBe(1);
      
      const childBlock = hierarchicalAst.body.children[0];
      expect(childBlock.type).toBe('ChildrenBlock');
      expect(childBlock.mountPoint).toBe('main-area');
      expect(childBlock.stateProjection).toBeDefined();
      expect(childBlock.stateProjection.bodyText).toBe('shell.currentPage.content');
    });

    it('should provide enhanced error reporting compared to basic compiler', () => {
      const errorDsl = `
        ErrorTestComponent :: test => div {
          children {
            ChildComponent :: child => span { child.value }
            stateProjection: {
              "value": "test..invalid..path"
            }
          }
        }
      `;

      // HierarchicalDSLParser should catch state projection path errors
      expect(() => {
        hierarchicalParser.parse(errorDsl);
      }).toThrow('Invalid state projection path: "test..invalid..path". Paths cannot contain consecutive dots.');

      // Basic ComponentCompiler might not catch this specific validation
      expect(() => {
        componentCompiler.parseOnly(errorDsl);
      }).not.toThrow(); // Basic compiler doesn't validate state projection syntax
    });
  });

  describe('Real-World DSL Examples', () => {
    it('should parse simple e-commerce product catalog', () => {
      const ecommerceDsl = `
        ProductCatalog :: catalog => div.product-catalog {
          children {
            FilterPanel :: filters => aside.filters { filters.title }
            mountPoint: "sidebar"
            stateProjection: {
              "title": "catalog.filterTitle"
            }
          }
          children {
            ProductGrid :: products => section.products { products.count }
            mountPoint: "main-content"
            stateProjection: {
              "count": "catalog.products.length"
            }
          }
        }
      `;

      const ast = hierarchicalParser.parse(ecommerceDsl);

      expect(ast.name).toBe('ProductCatalog');
      expect(ast.body.children.length).toBe(2);

      // Verify filter panel structure
      const filtersBlock = ast.body.children[0];
      expect(filtersBlock.mountPoint).toBe('sidebar');
      expect(filtersBlock.children[0].name).toBe('FilterPanel');

      // Verify product grid structure
      const productsBlock = ast.body.children[1];
      expect(productsBlock.mountPoint).toBe('main-content');
      expect(productsBlock.children[0].name).toBe('ProductGrid');
    });

    it('should parse social media feed with simple structure', () => {
      const socialMediaDsl = `
        SocialFeed :: feed => div.social-feed {
          children {
            FeedPost :: post => article.feed-post { post.content }
            repeat: "feed.posts"
            mountPoint: "feed-container"
            stateProjection: {
              "content": "feed.posts[{index}].content",
              "author": "feed.posts[{index}].author",
              "timestamp": "feed.posts[{index}].createdAt"
            }
          }
        }
      `;

      const ast = hierarchicalParser.parse(socialMediaDsl);

      expect(ast.name).toBe('SocialFeed');
      expect(ast.body.children.length).toBe(1);

      const feedPostsBlock = ast.body.children[0];
      expect(feedPostsBlock.repeat).toBe('feed.posts');
      expect(feedPostsBlock.children[0].name).toBe('FeedPost');
      expect(feedPostsBlock.stateProjection.content).toBe('feed.posts[{index}].content');
      expect(feedPostsBlock.stateProjection.author).toBe('feed.posts[{index}].author');
    });
  });

  describe('Error Handling in Complex Scenarios', () => {
    it('should detect circular dependencies in state projections', () => {
      const circularDsl = `
        CircularApp :: app => div {
          children {
            ComponentA :: childA => div { childA.value }
            stateProjection: {
              "value": "app.childB.result"
            }
          }
          children {
            ComponentB :: childB => div { childB.result }
            stateProjection: {
              "result": "app.childA.value"
            }
          }
        }
      `;

      expect(() => {
        hierarchicalParser.parse(circularDsl);
      }).toThrow(/Circular dependency detected in state projections/);
    });

    it('should validate mount point conflicts in nested scenarios', () => {
      const conflictDsl = `
        ConflictApp :: app => div {
          children {
            PanelA :: panelA => div { panelA.content }
            mountPoint: "shared-area"
            stateProjection: {
              "content": "app.panelAContent"
            }
          }
          children {
            PanelB :: panelB => div { panelB.content }
            mountPoint: "shared-area"
            stateProjection: {
              "content": "app.panelBContent"
            }
          }
        }
      `;

      expect(() => {
        hierarchicalParser.parse(conflictDsl);
      }).toThrow('Conflicting mount point "shared-area" used by multiple children: PanelA, PanelB');
    });

    it('should handle performance gracefully with large hierarchies', () => {
      // Generate a simple hierarchy with many children
      const generateSimpleHierarchy = (count) => {
        let children = '';
        for (let i = 0; i < count; i++) {
          children += `
          children {
            Child${i} :: child${i} => div.child-${i} { child${i}.content }
            mountPoint: "area-${i}"
            stateProjection: {
              "content": "parent.children[${i}].content"
            }
          }`;
        }
        
        return `
          LargeComponent :: parent => div.large {${children}
          }
        `;
      };

      const largeDsl = generateSimpleHierarchy(20); // Smaller count for integration test
      const startTime = Date.now();
      
      const ast = hierarchicalParser.parse(largeDsl);
      
      const parseTime = Date.now() - startTime;
      expect(parseTime).toBeLessThan(1000); // Should parse hierarchy in under 1 second
      
      expect(ast.name).toBe('LargeComponent');
      expect(ast.body.children).toBeDefined();
      expect(ast.body.children.length).toBe(20); // Should have 20 children
    });
  });
});