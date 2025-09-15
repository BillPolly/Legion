/**
 * Unit tests for HierarchicalDSLParser
 * Tests advanced hierarchical DSL parsing features:
 * - Complex nested component structures
 * - Advanced state projection scenarios
 * - Error handling for malformed hierarchical DSL
 * - Performance and optimization for large hierarchical structures
 */

import { jest } from '@jest/globals';
import { HierarchicalDSLParser } from '../../src/compiler/HierarchicalDSLParser.js';

describe('HierarchicalDSLParser', () => {
  let parser;

  beforeEach(() => {
    parser = new HierarchicalDSLParser();
  });

  describe('Constructor', () => {
    it('should create HierarchicalDSLParser instance', () => {
      expect(parser).toBeInstanceOf(HierarchicalDSLParser);
    });

    it('should initialize with default options', () => {
      expect(parser.options).toBeDefined();
      expect(parser.options.allowNestedChildren).toBe(false);
      expect(parser.options.maxDepth).toBe(5);
    });

    it('should accept custom options', () => {
      const customParser = new HierarchicalDSLParser({
        allowNestedChildren: true,
        maxDepth: 10,
        strictValidation: true
      });

      expect(customParser.options.allowNestedChildren).toBe(true);
      expect(customParser.options.maxDepth).toBe(10);
      expect(customParser.options.strictValidation).toBe(true);
    });
  });

  describe('Complex Hierarchical DSL Parsing', () => {
    it('should parse deeply nested component hierarchy', () => {
      const dsl = `
        AppContainer :: app => div.app {
          children {
            HeaderComponent :: header => header.main-header {
              children {
                LogoComponent :: logo => img.logo { logo.src }
                stateProjection: {
                  "src": "header.brandLogo"
                }
              }
              children {
                NavigationComponent :: nav => nav.main-nav {
                  children {
                    NavItem :: item => a.nav-item { item.label }
                    repeat: "nav.menuItems"
                    stateProjection: {
                      "label": "nav.menuItems[{index}].label",
                      "href": "nav.menuItems[{index}].url"
                    }
                  }
                }
                stateProjection: {
                  "menuItems": "header.navigation"
                }
              }
            }
            stateProjection: {
              "brandLogo": "app.branding.logo",
              "navigation": "app.menu.primary"
            }
          }
          children {
            MainContent :: main => main.content {
              children {
                SidebarComponent :: sidebar => aside.sidebar { sidebar.title }
                mountPoint: "sidebar-area"
                stateProjection: {
                  "title": "main.sidebarTitle",
                  "items": "main.sidebarItems"
                }
              }
              children {
                ArticleComponent :: article => article.main-article { article.content }
                mountPoint: "content-area"
                stateProjection: {
                  "content": "main.articleContent",
                  "author": "main.articleAuthor"
                }
              }
            }
            stateProjection: {
              "sidebarTitle": "app.sidebar.title",
              "sidebarItems": "app.sidebar.widgets",
              "articleContent": "app.content.body",
              "articleAuthor": "app.content.metadata.author"
            }
          }
        }
      `;

      const ast = parser.parse(dsl);

      expect(ast.type).toBe('Component');
      expect(ast.name).toBe('AppContainer');
      expect(ast.body.children).toBeDefined();
      expect(ast.body.children.length).toBe(2);

      // Header with nested logo and navigation
      const headerBlock = ast.body.children[0];
      expect(headerBlock.children[0].name).toBe('HeaderComponent');
      expect(headerBlock.children[0].body.children).toBeDefined();
      expect(headerBlock.children[0].body.children.length).toBe(2); // LogoComponent and NavigationComponent
    });

    it('should parse complex state projection with computed properties', () => {
      const dsl = `
        DashboardComponent :: dashboard => div.dashboard {
          children {
            MetricsWidget :: metrics => div.metrics-widget { metrics.value }
            stateProjection: {
              "value": "dashboard.analytics.totalUsers + dashboard.analytics.totalSales",
              "trend": "dashboard.analytics.trend.direction",
              "percentage": "dashboard.analytics.trend.percentage * 100"
            }
          }
        }
      `;

      const ast = parser.parse(dsl);
      const childBlock = ast.body.children[0];

      expect(childBlock.stateProjection.value).toBe('dashboard.analytics.totalUsers + dashboard.analytics.totalSales');
      expect(childBlock.stateProjection.trend).toBe('dashboard.analytics.trend.direction');
      expect(childBlock.stateProjection.percentage).toBe('dashboard.analytics.trend.percentage * 100');
    });

    it('should parse multiple repeat directives with different strategies', () => {
      const dsl = `
        DataTableComponent :: table => table.data-table {
          children {
            TableHeader :: header => thead { header.columns }
            repeat: "table.schema.columns"
            mountPoint: "table-head"
            stateProjection: {
              "columns": "table.schema.columns"
            }
          }
          children {
            TableRow :: row => tr.data-row { row.cells }
            repeat: "table.data.rows"
            mountPoint: "table-body"
            stateProjection: {
              "cells": "table.data.rows[{index}].values",
              "rowId": "table.data.rows[{index}].id",
              "isSelected": "table.selection.includes(table.data.rows[{index}].id)"
            }
          }
        }
      `;

      const ast = parser.parse(dsl);

      expect(ast.body.children.length).toBe(2);
      
      const headerBlock = ast.body.children[0];
      expect(headerBlock.repeat).toBe('table.schema.columns');
      expect(headerBlock.mountPoint).toBe('table-head');
      
      const rowBlock = ast.body.children[1];
      expect(rowBlock.repeat).toBe('table.data.rows');
      expect(rowBlock.mountPoint).toBe('table-body');
      expect(rowBlock.stateProjection.isSelected).toBe('table.selection.includes(table.data.rows[{index}].id)');
    });
  });

  describe('Advanced Error Handling', () => {
    it('should throw error for exceeding maximum depth', () => {
      const shallowParser = new HierarchicalDSLParser({ maxDepth: 2 });
      
      const deepDsl = `
        Level1 :: l1 => div {
          children {
            Level2 :: l2 => div {
              children {
                Level3 :: l3 => div { l3.content }
                stateProjection: { "content": "l2.data" }
              }
            }
            stateProjection: { "data": "l1.info" }
          }
        }
      `;

      expect(() => {
        shallowParser.parse(deepDsl);
      }).toThrow('Maximum nesting depth exceeded (2). Reduce component hierarchy depth.');
    });

    it('should throw error for invalid state projection expressions', () => {
      const dsl = `
        InvalidComponent :: invalid => div {
          children {
            ChildComponent :: child => span { child.name }
            stateProjection: {
              "name": "invalid..property",
              "value": "parent.[invalid]"
            }
          }
        }
      `;

      expect(() => {
        parser.parse(dsl);
      }).toThrow('Invalid state projection path: "invalid..property". Paths cannot contain consecutive dots.');
    });

    it('should throw error for circular state projection references', () => {
      const dsl = `
        CircularComponent :: circular => div {
          children {
            ChildA :: childA => div { childA.value }
            stateProjection: {
              "value": "circular.childB.result"
            }
          }
          children {
            ChildB :: childB => div { childB.result }
            stateProjection: {
              "result": "circular.childA.value"
            }
          }
        }
      `;

      expect(() => {
        parser.parse(dsl);
      }).toThrow('Circular dependency detected in state projections between ChildA and ChildB');
    });

    it('should throw error for conflicting mount points', () => {
      const dsl = `
        ConflictComponent :: conflict => div {
          children {
            ChildA :: childA => div { childA.content }
            mountPoint: "main-area"
            stateProjection: { "content": "conflict.dataA" }
          }
          children {
            ChildB :: childB => div { childB.content }
            mountPoint: "main-area"
            stateProjection: { "content": "conflict.dataB" }
          }
        }
      `;

      expect(() => {
        parser.parse(dsl);
      }).toThrow('Conflicting mount point "main-area" used by multiple children: ChildA, ChildB');
    });

    it('should throw error for invalid repeat expression syntax', () => {
      const dsl = `
        InvalidRepeatComponent :: invalid => div {
          children {
            ItemComponent :: item => li { item.text }
            repeat: "invalid..array[bad syntax]"
            stateProjection: {
              "text": "invalid.items[{index}].text"
            }
          }
        }
      `;

      expect(() => {
        parser.parse(dsl);
      }).toThrow('Invalid repeat expression: "invalid..array[bad syntax]". Must be a valid object path.');
    });
  });

  describe('Performance and Optimization', () => {
    it('should parse large hierarchical DSL efficiently', () => {
      // Generate a DSL with many children
      const generateLargeHierarchy = (count) => {
        let children = '';
        for (let i = 0; i < count; i++) {
          children += `
            Child${i} :: child${i} => div.child-${i} { child${i}.content }
            mountPoint: "area-${i % 5}"
            stateProjection: {
              "content": "parent.children[${i}].content",
              "visible": "parent.children[${i}].visible"
            }
          `;
          if (i < count - 1) children += '\n children {\n';
        }
        for (let i = 0; i < count - 1; i++) {
          children += '\n}';
        }
        
        return `
          LargeComponent :: parent => div.large {
            children {
              ${children}
            }
          }
        `;
      };

      const largeDsl = generateLargeHierarchy(50);
      const startTime = Date.now();
      
      const ast = parser.parse(largeDsl);
      
      const parseTime = Date.now() - startTime;
      expect(parseTime).toBeLessThan(1000); // Should parse in under 1 second
      expect(ast.body.children).toBeDefined();
    });

    it('should cache parsed AST for identical DSL strings', () => {
      const dsl = `
        CacheableComponent :: cacheable => div {
          children {
            ChildComponent :: child => span { child.name }
            stateProjection: { "name": "cacheable.childName" }
          }
        }
      `;

      const cachedParser = new HierarchicalDSLParser({ enableCaching: true });
      
      const ast1 = cachedParser.parse(dsl);
      const ast2 = cachedParser.parse(dsl);
      
      // Should return same reference (cached)
      expect(ast1).toBe(ast2);
    });
  });

  describe('Validation and Linting', () => {
    it('should validate state projection consistency', () => {
      const dsl = `
        InconsistentComponent :: inconsistent => div {
          children {
            ChildComponent :: child => span { child.unknownProperty }
            stateProjection: {
              "name": "inconsistent.childName"
            }
          }
        }
      `;

      const strictParser = new HierarchicalDSLParser({ strictValidation: true });
      
      expect(() => {
        strictParser.parse(dsl);
      }).toThrow('Property "unknownProperty" used in template but not defined in stateProjection');
    });

    it('should suggest corrections for common mistakes', () => {
      const dsl = `
        TypoComponent :: typo => div {
          children {
            ChildComponent :: child => span { child.name }
            stateprojeciton: {
              "name": "typo.childName"
            }
          }
        }
      `;

      expect(() => {
        parser.parse(dsl);
      }).toThrow('Unknown directive "stateprojeciton". Did you mean "stateProjection"?');
    });
  });
});