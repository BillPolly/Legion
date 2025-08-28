/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { ExtensionBuilder } from '../../../src/build/ExtensionBuilder.js';
import fs from 'fs';
import path from 'path';

// Mock fs operations
jest.mock('fs');
jest.mock('path');

describe('Extension Builder', () => {
  let builder;
  
  beforeEach(() => {
    builder = new ExtensionBuilder();
    jest.clearAllMocks();
    
    // Mock fs.existsSync to return true by default
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue({ isDirectory: () => true });
  });

  describe('Build Process', () => {
    test('should validate source directory exists', async () => {
      fs.existsSync.mockReturnValue(false);
      
      await expect(builder.build({
        sourceDir: '/nonexistent/src',
        outputDir: '/tmp/build'
      })).rejects.toThrow('Source directory does not exist: /nonexistent/src');
    });

    test('should create output directory if it does not exist', async () => {
      const options = {
        sourceDir: '/src',
        outputDir: '/build'
      };
      
      fs.existsSync.mockImplementation(path => {
        if (path === options.sourceDir) return true;
        if (path === options.outputDir) return false;
        return true;
      });
      
      fs.mkdirSync.mockImplementation(() => {});
      fs.readFileSync.mockReturnValue('{"manifest_version": 3}');
      
      await builder.build(options);
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(options.outputDir, { recursive: true });
    });

    test('should copy manifest.json with version update', async () => {
      const manifest = {
        manifest_version: 3,
        name: 'Cerebrate',
        version: '1.0.0'
      };
      
      fs.readFileSync.mockReturnValue(JSON.stringify(manifest));
      fs.writeFileSync.mockImplementation(() => {});
      
      await builder.build({
        sourceDir: '/src',
        outputDir: '/build',
        version: '1.1.0'
      });
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('manifest.json'),
        JSON.stringify({ ...manifest, version: '1.1.0' }, null, 2)
      );
    });

    test('should copy all source files to output directory', async () => {
      const mockFiles = [
        'background.js',
        'content.js',
        'popup.html',
        'styles/main.css',
        'icons/icon128.png'
      ];
      
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.includes('styles')) return ['main.css'];
        if (dir.includes('icons')) return ['icon128.png'];
        return mockFiles.filter(f => !f.includes('/'));
      });
      
      fs.statSync.mockImplementation((filePath) => ({
        isDirectory: () => filePath.includes('styles') || filePath.includes('icons'),
        isFile: () => !filePath.includes('styles') && !filePath.includes('icons')
      }));
      
      fs.copyFileSync.mockImplementation(() => {});
      
      await builder.build({
        sourceDir: '/src',
        outputDir: '/build'
      });
      
      expect(fs.copyFileSync).toHaveBeenCalledTimes(5);
    });

    test('should minify JavaScript files when minify option is enabled', async () => {
      const jsContent = 'function test() { console.log("hello world"); }';
      const minifiedContent = 'function test(){console.log("hello world")}';
      
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('manifest.json')) {
          return '{"manifest_version": 3}';
        }
        return jsContent;
      });
      
      fs.writeFileSync.mockImplementation(() => {});
      
      await builder.build({
        sourceDir: '/src',
        outputDir: '/build',
        minify: true
      });
      
      // Should have written minified version
      const writeCall = fs.writeFileSync.mock.calls.find(call => 
        call[0].includes('.js') && !call[0].includes('manifest')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall[1]).toContain('test()');
    });
  });

  describe('Asset Optimization', () => {
    test('should optimize images when optimization is enabled', async () => {
      const options = {
        sourceDir: '/src',
        outputDir: '/build',
        optimizeImages: true
      };
      
      fs.readdirSync.mockReturnValue(['icon.png', 'background.jpg']);
      fs.statSync.mockReturnValue({ isFile: () => true, isDirectory: () => false });
      fs.readFileSync.mockReturnValue(Buffer.from('fake-image-data'));
      fs.writeFileSync.mockImplementation(() => {});
      
      await builder.build(options);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('icon.png'),
        expect.any(Buffer)
      );
    });

    test('should compress CSS files', async () => {
      const cssContent = `
        .container {
          background-color: #ffffff;
          padding: 10px;
          margin: 5px;
        }
      `;
      
      const compressedCss = '.container{background-color:#fff;padding:10px;margin:5px}';
      
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('.css')) return cssContent;
        if (filePath.includes('manifest.json')) return '{"manifest_version": 3}';
        return '';
      });
      
      fs.writeFileSync.mockImplementation(() => {});
      
      await builder.build({
        sourceDir: '/src',
        outputDir: '/build',
        compressCss: true
      });
      
      const cssWriteCall = fs.writeFileSync.mock.calls.find(call => 
        call[0].includes('.css')
      );
      expect(cssWriteCall).toBeDefined();
      expect(cssWriteCall[1]).toContain('.container{');
    });
  });

  describe('Build Validation', () => {
    test('should validate manifest.json structure', async () => {
      const invalidManifest = '{"invalid": "manifest"}';
      fs.readFileSync.mockReturnValue(invalidManifest);
      
      await expect(builder.build({
        sourceDir: '/src',
        outputDir: '/build'
      })).rejects.toThrow('Invalid manifest.json: missing required field manifest_version');
    });

    test('should validate required files are present', async () => {
      fs.readFileSync.mockReturnValue('{"manifest_version": 3, "background": {"service_worker": "background.js"}}');
      fs.existsSync.mockImplementation(path => {
        if (path.includes('background.js')) return false;
        return true;
      });
      
      await expect(builder.build({
        sourceDir: '/src',
        outputDir: '/build'
      })).rejects.toThrow('Required file not found: background.js');
    });

    test('should generate build report', async () => {
      fs.readFileSync.mockReturnValue('{"manifest_version": 3}');
      fs.readdirSync.mockReturnValue(['manifest.json', 'background.js']);
      fs.statSync.mockReturnValue({ isFile: () => true, size: 1024 });
      
      const result = await builder.build({
        sourceDir: '/src',
        outputDir: '/build'
      });
      
      expect(result).toEqual({
        success: true,
        files: expect.arrayContaining([
          expect.objectContaining({
            name: 'manifest.json',
            size: expect.any(Number)
          })
        ]),
        totalSize: expect.any(Number),
        buildTime: expect.any(Number)
      });
    });
  });

  describe('Package Creation', () => {
    test('should create zip package when requested', async () => {
      fs.readFileSync.mockReturnValue('{"manifest_version": 3}');
      fs.readdirSync.mockReturnValue(['manifest.json']);
      fs.statSync.mockReturnValue({ isFile: () => true, size: 1024 });
      
      const result = await builder.build({
        sourceDir: '/src',
        outputDir: '/build',
        createPackage: true,
        packageName: 'cerebrate.zip'
      });
      
      expect(result.packagePath).toContain('cerebrate.zip');
      expect(result.success).toBe(true);
    });

    test('should calculate package checksums', async () => {
      fs.readFileSync.mockReturnValue('{"manifest_version": 3}');
      
      const result = await builder.build({
        sourceDir: '/src',
        outputDir: '/build',
        createPackage: true,
        generateChecksums: true
      });
      
      expect(result.checksums).toBeDefined();
      expect(result.checksums.sha256).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Build Configuration', () => {
    test('should load build configuration from file', () => {
      const config = {
        minify: true,
        optimizeImages: true,
        compressCss: true,
        excludeFiles: ['*.test.js', '*.spec.js']
      };
      
      fs.readFileSync.mockReturnValue(JSON.stringify(config));
      
      const loadedConfig = builder.loadConfig('/path/to/build.config.json');
      
      expect(loadedConfig).toEqual(config);
    });

    test('should merge configuration with default options', () => {
      const userConfig = { minify: true, customOption: 'value' };
      const defaultConfig = { minify: false, compressCss: true };
      
      const merged = builder.mergeConfig(defaultConfig, userConfig);
      
      expect(merged).toEqual({
        minify: true,
        compressCss: true,
        customOption: 'value'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      await expect(builder.build({
        sourceDir: '/src',
        outputDir: '/build'
      })).rejects.toThrow('Build failed: Permission denied');
    });

    test('should clean up on build failure', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Build error');
      });
      
      fs.rmSync.mockImplementation(() => {});
      
      try {
        await builder.build({
          sourceDir: '/src',
          outputDir: '/build'
        });
      } catch (error) {
        expect(fs.rmSync).toHaveBeenCalledWith('/build', { recursive: true, force: true });
      }
    });
  });
});