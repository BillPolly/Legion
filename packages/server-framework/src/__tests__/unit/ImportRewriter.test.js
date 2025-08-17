/**
 * Unit tests for ImportRewriter utility
 */

import { ImportRewriter } from '../../utils/ImportRewriter.js';

describe('ImportRewriter', () => {
  let rewriter;

  beforeEach(() => {
    rewriter = new ImportRewriter();
  });

  describe('rewrite', () => {
    it('should rewrite @legion/* imports to /legion/*', () => {
      const input = `import { Actor } from '@legion/actors';`;
      const output = rewriter.rewrite(input);
      
      expect(output).toBe(`import { Actor } from '/legion/actors/index.js';`);
    });

    it('should rewrite multiple imports', () => {
      const input = `
        import { Actor } from '@legion/actors';
        import { ResourceManager } from '@legion/resource-manager';
        import { ToolRegistry } from '@legion/tools';
      `;
      
      const output = rewriter.rewrite(input);
      
      expect(output).toContain(`from '/legion/actors/index.js'`);
      expect(output).toContain(`from '/legion/resource-manager/index.js'`);
      expect(output).toContain(`from '/legion/tools/index.js'`);
    });

    it('should handle export from statements', () => {
      const input = `export { Actor } from '@legion/actors';`;
      const output = rewriter.rewrite(input);
      
      expect(output).toBe(`export { Actor } from '/legion/actors/index.js';`);
    });

    it('should handle dynamic imports', () => {
      const input = `const module = await import('@legion/actors');`;
      const output = rewriter.rewrite(input);
      
      expect(output).toBe(`const module = await import('/legion/actors/index.js');`);
    });

    it('should handle require statements', () => {
      const input = `const { Actor } = require('@legion/actors');`;
      const output = rewriter.rewrite(input);
      
      expect(output).toBe(`const { Actor } = require('/legion/actors/index.js');`);
    });

    it('should preserve non-Legion imports', () => {
      const input = `
        import express from 'express';
        import { Actor } from '@legion/actors';
        import path from 'path';
      `;
      
      const output = rewriter.rewrite(input);
      
      expect(output).toContain(`import express from 'express'`);
      expect(output).toContain(`import path from 'path'`);
      expect(output).toContain(`from '/legion/actors/index.js'`);
    });

    it('should handle imports with file paths', () => {
      const input = `import { Button } from '@legion/frontend-components/Button';`;
      const output = rewriter.rewrite(input);
      
      expect(output).toBe(`import { Button } from '/legion/frontend-components/Button.js';`);
    });

    it('should add .js extension if missing', () => {
      const input = `import { Actor } from '@legion/actors/Actor';`;
      const output = rewriter.rewrite(input);
      
      expect(output).toBe(`import { Actor } from '/legion/actors/Actor.js';`);
    });

    it('should not double-add .js extension', () => {
      const input = `import { Actor } from '@legion/actors/Actor.js';`;
      const output = rewriter.rewrite(input);
      
      expect(output).toBe(`import { Actor } from '/legion/actors/Actor.js';`);
    });

    it('should handle side-effect imports', () => {
      const input = `import '@legion/styles/global.css';`;
      const output = rewriter.rewrite(input);
      
      expect(output).toBe(`import '/legion/styles/global.css';`);
    });

    it('should handle multiline imports', () => {
      const input = `
        import {
          Actor,
          ActorSpace,
          Channel
        } from '@legion/actors';
      `;
      
      const output = rewriter.rewrite(input);
      
      expect(output).toContain(`from '/legion/actors/index.js'`);
    });

    it('should handle mixed quotes', () => {
      const input = `
        import { Actor } from "@legion/actors";
        import { Tool } from '@legion/tools';
      `;
      
      const output = rewriter.rewrite(input);
      
      expect(output).toContain(`from "/legion/actors/index.js"`);
      expect(output).toContain(`from '/legion/tools/index.js'`);
    });

    it('should handle comments', () => {
      const input = `
        // Import actor from Legion
        import { Actor } from '@legion/actors';
        /* Multi-line comment
           about the import */
        import { Tool } from '@legion/tools';
      `;
      
      const output = rewriter.rewrite(input);
      
      expect(output).toContain('// Import actor from Legion');
      expect(output).toContain('/* Multi-line comment');
      expect(output).toContain(`from '/legion/actors/index.js'`);
      expect(output).toContain(`from '/legion/tools/index.js'`);
    });

    it('should handle empty input', () => {
      const output = rewriter.rewrite('');
      expect(output).toBe('');
    });

    it('should handle code without imports', () => {
      const input = `
        const x = 5;
        function test() {
          return x * 2;
        }
      `;
      
      const output = rewriter.rewrite(input);
      expect(output).toBe(input);
    });
  });

  describe('rewritePath', () => {
    it('should convert @legion path to /legion URL', () => {
      const result = rewriter.rewritePath('@legion/actors');
      expect(result).toBe('/legion/actors/index.js');
    });

    it('should preserve file paths', () => {
      const result = rewriter.rewritePath('@legion/actors/Actor');
      expect(result).toBe('/legion/actors/Actor.js');
    });

    it('should handle paths with .js extension', () => {
      const result = rewriter.rewritePath('@legion/actors/Actor.js');
      expect(result).toBe('/legion/actors/Actor.js');
    });

    it('should handle CSS files', () => {
      const result = rewriter.rewritePath('@legion/styles/main.css');
      expect(result).toBe('/legion/styles/main.css');
    });

    it('should handle JSON files', () => {
      const result = rewriter.rewritePath('@legion/config/settings.json');
      expect(result).toBe('/legion/config/settings.json');
    });
  });
});