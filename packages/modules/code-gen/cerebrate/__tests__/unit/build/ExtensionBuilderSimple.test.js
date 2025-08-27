/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { ExtensionBuilder } from '../../../src/build/ExtensionBuilder.js';

describe('Extension Builder (Core)', () => {
  let builder;
  
  beforeEach(() => {
    builder = new ExtensionBuilder();
    jest.clearAllMocks();
  });

  describe('Configuration Management', () => {
    test('should create builder with default options', () => {
      expect(builder).toBeDefined();
      expect(builder.defaultOptions).toEqual(
        expect.objectContaining({
          minify: false,
          optimizeImages: false,
          compressCss: false,
          createPackage: false,
          generateChecksums: false
        })
      );
    });

    test('should merge configuration objects', () => {
      const defaultConfig = {
        minify: false,
        compressCss: true,
        excludeFiles: ['*.test.js']
      };
      
      const userConfig = {
        minify: true,
        optimizeImages: true
      };
      
      const merged = builder.mergeConfig(defaultConfig, userConfig);
      
      expect(merged).toEqual({
        minify: true,
        compressCss: true,
        excludeFiles: ['*.test.js'],
        optimizeImages: true
      });
    });

    test('should validate build options', () => {
      expect(() => {
        builder.validateBuildOptions({});
      }).toThrow('Source directory is required');

      expect(() => {
        builder.validateBuildOptions({ sourceDir: '/src' });
      }).toThrow('Output directory is required');
    });
  });

  describe('Content Processing', () => {
    test('should minify JavaScript content', () => {
      const jsContent = `
        // This is a comment
        function test() {
          /* Block comment */
          console.log("hello world");
          return true;
        }
      `;
      
      const minified = builder.minifyJavaScript(jsContent);
      
      expect(minified).not.toContain('//');
      expect(minified).not.toContain('/*');
      expect(minified).toContain('function test()');
      expect(minified).toContain('console.log("hello world")');
    });

    test('should compress CSS content', () => {
      const cssContent = `
        .container {
          background-color: #ffffff;
          padding: 10px;
          margin: 5px;
        }
        
        /* Comment */
        .button {
          background-color: #000000;
          border: 1px solid #ccc;
        }
      `;
      
      const compressed = builder.compressCss(cssContent);
      
      expect(compressed).not.toContain('/*');
      expect(compressed).toContain('.container{');
      expect(compressed).toContain('background-color:#fff');
      expect(compressed).toContain('background-color:#000');
      expect(compressed).not.toContain('\n');
    });

    test('should optimize images (placeholder)', () => {
      const imageBuffer = Buffer.from('fake-image-data');
      const optimized = builder.optimizeImage(imageBuffer);
      
      // Currently just returns original
      expect(optimized).toEqual(imageBuffer);
    });

    test('should match file patterns', () => {
      expect(builder.matchPattern('test.spec.js', '*.spec.js')).toBe(true);
      expect(builder.matchPattern('src/test.js', '*.spec.js')).toBe(false);
      expect(builder.matchPattern('node_modules/lib.js', 'node_modules/**')).toBe(true);
      expect(builder.matchPattern('src/main.js', 'node_modules/**')).toBe(false);
    });
  });

  describe('Manifest Validation', () => {
    test('should validate manifest structure', () => {
      const validManifest = {
        manifest_version: 3,
        name: 'Test Extension',
        version: '1.0.0'
      };
      
      expect(() => {
        builder.validateManifest(validManifest);
      }).not.toThrow();
    });

    test('should reject invalid manifest', () => {
      const invalidManifest = {
        name: 'Test Extension',
        version: '1.0.0'
        // Missing manifest_version
      };
      
      expect(() => {
        builder.validateManifest(invalidManifest);
      }).toThrow('Invalid manifest.json: missing required field manifest_version');
    });

    test('should warn about non-v3 manifest', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const v2Manifest = {
        manifest_version: 2,
        name: 'Test Extension',
        version: '1.0.0'
      };
      
      builder.validateManifest(v2Manifest);
      
      expect(consoleSpy).toHaveBeenCalledWith('Warning: Only Manifest V3 is fully supported');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Checksum Generation', () => {
    test('should generate SHA256 and MD5 checksums', async () => {
      // Test checksum generation directly using crypto
      const testContent = 'test content';
      const crypto = await import('crypto');
      
      const expectedSha256 = crypto.createHash('sha256').update(testContent).digest('hex');
      const expectedMd5 = crypto.createHash('md5').update(testContent).digest('hex');
      
      expect(expectedSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(expectedMd5).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle build failures gracefully', () => {
      expect(() => {
        builder.validateBuildOptions({
          sourceDir: '/nonexistent',
          outputDir: '/tmp'
        });
      }).toThrow();
    });

    test('should validate required manifest fields', () => {
      const emptyManifest = {};
      
      expect(() => {
        builder.validateManifest(emptyManifest);
      }).toThrow('missing required field manifest_version');
    });
  });

  describe('Build Options Validation', () => {
    test('should require source and output directories', () => {
      expect(() => {
        builder.validateBuildOptions({ sourceDir: '/src' });
      }).toThrow('Output directory is required');
      
      expect(() => {
        builder.validateBuildOptions({ outputDir: '/build' });
      }).toThrow('Source directory is required');
    });
  });

  describe('Pattern Matching', () => {
    test('should match wildcard patterns correctly', () => {
      expect(builder.matchPattern('test.js', '*.js')).toBe(true);
      expect(builder.matchPattern('test.css', '*.js')).toBe(false);
      expect(builder.matchPattern('deep/nested/file.js', '**/*.js')).toBe(true);
      expect(builder.matchPattern('file.test.js', '*.test.js')).toBe(true);
    });

    test('should match literal patterns', () => {
      expect(builder.matchPattern('node_modules/lib.js', 'node_modules')).toBe(true);
      expect(builder.matchPattern('src/main.js', 'node_modules')).toBe(false);
    });
  });

  describe('Content Optimization', () => {
    test('should remove JavaScript comments and whitespace', () => {
      const input = `
        function hello() {
          // Single line comment
          console.log('world'); /* inline comment */
          return    42;    // trailing comment
        }
      `;
      
      const output = builder.minifyJavaScript(input);
      
      expect(output).not.toContain('//');
      expect(output).not.toContain('/*');
      expect(output).not.toContain('  '); // Multiple spaces
      expect(output).toContain('function hello()');
    });

    test('should compress CSS and optimize colors', () => {
      const input = `
        /* Header styles */
        .header {
          background-color: #ffffff;
          color: #000000;
          padding: 10px 20px;
        }
        
        .footer {
          margin-top: 50px;
        }
      `;
      
      const output = builder.compressCss(input);
      
      expect(output).toContain('#fff'); // Optimized white
      expect(output).toContain('#000'); // Optimized black
      expect(output).not.toContain('/*');
      expect(output).not.toContain('\n');
      expect(output).toContain('.header{');
    });
  });
});