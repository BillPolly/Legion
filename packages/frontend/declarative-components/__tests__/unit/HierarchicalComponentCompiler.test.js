/**
 * Unit tests for HierarchicalComponentCompiler extensions
 * Tests DSL parsing for hierarchical component features:
 * - Children blocks with stateProjection rules
 * - MountPoint and repeat directives  
 * - DSL validation for child component syntax
 */

import { jest } from '@jest/globals';
import { ComponentCompiler } from '../../src/compiler/ComponentCompiler.js';

describe('HierarchicalComponentCompiler', () => {
  let compiler;

  beforeEach(() => {
    compiler = new ComponentCompiler();
  });

  describe('Children Block Parsing', () => {
    it('should parse simple children block with child component', () => {
      const dsl = `
        ParentComponent :: parent => div.parent {
          children {
            ChildComponent :: child => span.child { child.name }
            stateProjection: {
              "name": "parent.childName"
            }
          }
        }
      `;

      const ast = compiler.parseOnly(dsl);

      expect(ast.type).toBe('Component');
      expect(ast.name).toBe('ParentComponent');
      expect(ast.body.children).toBeDefined();
      expect(ast.body.children.length).toBe(1);
      
      const childBlock = ast.body.children[0];
      expect(childBlock.type).toBe('ChildrenBlock');
      expect(childBlock.children).toBeDefined();
      expect(childBlock.children.length).toBe(1);
      
      const childComponent = childBlock.children[0];
      expect(childComponent.type).toBe('Component');
      expect(childComponent.name).toBe('ChildComponent');
      expect(childComponent.entityParam).toBe('child');
      
      expect(childBlock.stateProjection).toBeDefined();
      expect(childBlock.stateProjection.name).toBe('parent.childName');
    });

    it('should parse children block with multiple child components', () => {
      const dsl = `
        ParentComponent :: parent => div.parent {
          children {
            HeaderChild :: header => h1.header { header.title }
            ContentChild :: content => p.content { content.body }
            stateProjection: {
              "title": "parent.headerText",
              "body": "parent.contentText"
            }
          }
        }
      `;

      const ast = compiler.parseOnly(dsl);
      const childBlock = ast.body.children[0];
      
      expect(childBlock.children.length).toBe(2);
      expect(childBlock.children[0].name).toBe('HeaderChild');
      expect(childBlock.children[1].name).toBe('ContentChild');
      expect(childBlock.stateProjection.title).toBe('parent.headerText');
      expect(childBlock.stateProjection.body).toBe('parent.contentText');
    });

    it('should parse children block with complex state projection rules', () => {
      const dsl = `
        ParentComponent :: parent => div.parent {
          children {
            ChildComponent :: child => div.child { child.displayName }
            stateProjection: {
              "displayName": "parent.user.fullName",
              "theme": "parent.config.theme",
              "itemCount": "parent.items.length"
            }
          }
        }
      `;

      const ast = compiler.parseOnly(dsl);
      const childBlock = ast.body.children[0];
      
      expect(childBlock.stateProjection.displayName).toBe('parent.user.fullName');
      expect(childBlock.stateProjection.theme).toBe('parent.config.theme');
      expect(childBlock.stateProjection.itemCount).toBe('parent.items.length');
    });
  });

  describe('MountPoint Directive Parsing', () => {
    it('should parse mountPoint directive for child component placement', () => {
      const dsl = `
        ParentComponent :: parent => div.parent {
          children {
            ChildComponent :: child => span.child { child.name }
            mountPoint: "header-container"
            stateProjection: {
              "name": "parent.childName"
            }
          }
        }
      `;

      const ast = compiler.parseOnly(dsl);
      const childBlock = ast.body.children[0];
      
      expect(childBlock.mountPoint).toBe('header-container');
    });

    it('should parse multiple children with different mount points', () => {
      const dsl = `
        ParentComponent :: parent => div.parent {
          children {
            HeaderChild :: header => h1.header { header.title }
            mountPoint: "header-section"
            stateProjection: {
              "title": "parent.headerText"
            }
          }
          children {
            FooterChild :: footer => footer.footer { footer.text }
            mountPoint: "footer-section"
            stateProjection: {
              "text": "parent.footerText"
            }
          }
        }
      `;

      const ast = compiler.parseOnly(dsl);
      
      expect(ast.body.children.length).toBe(2);
      expect(ast.body.children[0].mountPoint).toBe('header-section');
      expect(ast.body.children[1].mountPoint).toBe('footer-section');
    });
  });

  describe('Repeat Directive Parsing', () => {
    it('should parse repeat directive for array-based child components', () => {
      const dsl = `
        ParentComponent :: parent => div.parent {
          children {
            ItemChild :: item => li.item { item.name }
            repeat: "parent.items"
            stateProjection: {
              "name": "parent.items[{index}].name",
              "status": "parent.items[{index}].status"
            }
          }
        }
      `;

      const ast = compiler.parseOnly(dsl);
      const childBlock = ast.body.children[0];
      
      expect(childBlock.repeat).toBe('parent.items');
      expect(childBlock.stateProjection.name).toBe('parent.items[{index}].name');
      expect(childBlock.stateProjection.status).toBe('parent.items[{index}].status');
    });

    it('should parse repeat directive with complex array expressions', () => {
      const dsl = `
        ParentComponent :: parent => div.parent {
          children {
            ItemChild :: item => div.item { item.title }
            repeat: "parent.data.activeItems"
            stateProjection: {
              "title": "parent.data.activeItems[{index}].title",
              "id": "parent.data.activeItems[{index}].id"
            }
          }
        }
      `;

      const ast = compiler.parseOnly(dsl);
      const childBlock = ast.body.children[0];
      
      expect(childBlock.repeat).toBe('parent.data.activeItems');
      expect(childBlock.stateProjection.title).toBe('parent.data.activeItems[{index}].title');
    });
  });

  describe('DSL Validation', () => {
    it('should throw error for children block without stateProjection', () => {
      const dsl = `
        ParentComponent :: parent => div.parent {
          children {
            ChildComponent :: child => span.child { child.name }
          }
        }
      `;

      expect(() => {
        compiler.parseOnly(dsl);
      }).toThrow('Children block must include stateProjection');
    });

    it('should throw error for repeat directive without array path', () => {
      const dsl = `
        ParentComponent :: parent => div.parent {
          children {
            ItemChild :: item => li.item { item.name }
            repeat: ""
            stateProjection: {
              "name": "parent.items[{index}].name"
            }
          }
        }
      `;

      expect(() => {
        compiler.parseOnly(dsl);
      }).toThrow('Repeat directive must specify valid array path');
    });

    it('should throw error for invalid stateProjection syntax', () => {
      const dsl = `
        ParentComponent :: parent => div.parent {
          children {
            ChildComponent :: child => span.child { child.name }
            stateProjection: "invalid"
          }
        }
      `;

      expect(() => {
        compiler.parseOnly(dsl);
      }).toThrow('StateProjection must be an object with string key-value pairs');
    });

    it('should throw error for child component without entity parameter', () => {
      const dsl = `
        ParentComponent :: parent => div.parent {
          children {
            ChildComponent => span.child { "Hello" }
            stateProjection: {
              "name": "parent.childName"
            }
          }
        }
      `;

      expect(() => {
        compiler.parseOnly(dsl);
      }).toThrow('Child component must have entity parameter');
    });

    it('should throw error for nested children blocks', () => {
      const dsl = `
        ParentComponent :: parent => div.parent {
          children {
            ChildComponent :: child => div.child {
              children {
                GrandchildComponent :: grandchild => span { grandchild.text }
                stateProjection: {
                  "text": "child.text"
                }
              }
            }
            stateProjection: {
              "name": "parent.childName"
            }
          }
        }
      `;

      expect(() => {
        compiler.parseOnly(dsl);
      }).toThrow('Nested children blocks are not supported');
    });
  });

  describe('Complex Hierarchical DSL', () => {
    it('should parse complete hierarchical component with multiple features', () => {
      const dsl = `
        TodoApp :: app => div.todo-app {
          children {
            TodoHeader :: header => header.header { header.title }
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
            TodoFooter :: footer => footer.footer { footer.count }
            mountPoint: "footer-area"
            stateProjection: {
              "count": "app.remainingCount"
            }
          }
        }
      `;

      const ast = compiler.parseOnly(dsl);
      
      expect(ast.name).toBe('TodoApp');
      expect(ast.body.children.length).toBe(3);
      
      // Header child
      const headerChild = ast.body.children[0];
      expect(headerChild.children[0].name).toBe('TodoHeader');
      expect(headerChild.mountPoint).toBe('header-area');
      expect(headerChild.stateProjection.title).toBe('app.title');
      
      // Repeated item children
      const itemChild = ast.body.children[1];
      expect(itemChild.children[0].name).toBe('TodoItem');
      expect(itemChild.repeat).toBe('app.todos');
      expect(itemChild.mountPoint).toBe('todo-list');
      expect(itemChild.stateProjection.text).toBe('app.todos[{index}].text');
      
      // Footer child
      const footerChild = ast.body.children[2];
      expect(footerChild.children[0].name).toBe('TodoFooter');
      expect(footerChild.mountPoint).toBe('footer-area');
      expect(footerChild.stateProjection.count).toBe('app.remainingCount');
    });
  });
});