import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Extension Manifest', () => {
  let manifest;
  
  beforeAll(() => {
    try {
      const manifestPath = join(__dirname, '../../../src/extension/manifest.json');
      const manifestContent = readFileSync(manifestPath, 'utf8');
      manifest = JSON.parse(manifestContent);
    } catch (error) {
      manifest = null;
    }
  });

  describe('Manifest Format and Permissions', () => {
    test('should have valid manifest version 3 format', () => {
      expect(manifest).not.toBeNull();
      expect(manifest.manifest_version).toBe(3);
    });

    test('should have required extension metadata', () => {
      expect(manifest.name).toBe('Cerebrate - AI-Powered DevTools');
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(manifest.description).toBeDefined();
      expect(manifest.author).toBeDefined();
    });

    test('should declare required permissions', () => {
      expect(manifest.permissions).toContain('storage');
      expect(manifest.permissions).toContain('scripting');
      
      // DevTools specific permissions
      expect(manifest.devtools_page).toBeDefined();
    });

    test('should have proper background service worker', () => {
      expect(manifest.background).toBeDefined();
      expect(manifest.background.service_worker).toBe('background.js');
      expect(manifest.background.type).toBe('module');
    });

    test('should configure content scripts correctly', () => {
      expect(manifest.content_scripts).toBeDefined();
      expect(manifest.content_scripts).toHaveLength(1);
      
      const contentScript = manifest.content_scripts[0];
      expect(contentScript.matches).toContain('<all_urls>');
      expect(contentScript.js).toContain('content.js');
      expect(contentScript.run_at).toBe('document_start');
    });

    test('should declare host permissions', () => {
      expect(manifest.host_permissions).toBeDefined();
      expect(manifest.host_permissions).toContain('*://*/*');
    });

    test('should include extension icons', () => {
      expect(manifest.icons).toBeDefined();
      expect(manifest.icons['16']).toBe('assets/icon-16.png');
      expect(manifest.icons['48']).toBe('assets/icon-48.png');
      expect(manifest.icons['128']).toBe('assets/icon-128.png');
    });
  });

  describe('Extension File Loading', () => {
    test('should reference existing DevTools HTML file', () => {
      expect(manifest.devtools_page).toBe('devtools.html');
    });

    test('should have web accessible resources', () => {
      expect(manifest.web_accessible_resources).toBeDefined();
      expect(manifest.web_accessible_resources).toHaveLength(1);
      
      const resources = manifest.web_accessible_resources[0];
      expect(resources.resources).toContain('assets/*');
      expect(resources.matches).toContain('<all_urls>');
    });

    test('should configure CSP for extension pages', () => {
      expect(manifest.content_security_policy).toBeDefined();
      expect(manifest.content_security_policy.extension_pages)
        .toContain("script-src 'self'");
      expect(manifest.content_security_policy.extension_pages)
        .toContain("connect-src ws://localhost:* wss://localhost:*");
    });
  });

  describe('Permission Validation', () => {
    test('should not request excessive permissions', () => {
      const dangerousPermissions = [
        'management',
        'privacy',
        'proxy',
        'system.cpu',
        'system.memory',
        'vpnProvider'
      ];

      dangerousPermissions.forEach(permission => {
        expect(manifest.permissions).not.toContain(permission);
      });
    });

    test('should have minimum required API permissions', () => {
      // These are needed for DevTools functionality
      const requiredAPIs = [
        'storage',     // For saving settings
        'scripting'    // For injecting scripts
      ];

      requiredAPIs.forEach(api => {
        expect(manifest.permissions).toContain(api);
      });
    });

    test('should request appropriate optional permissions', () => {
      if (manifest.optional_permissions) {
        expect(manifest.optional_permissions).toEqual(
          expect.arrayContaining(['debugger'])
        );
      }
    });
  });

  describe('Extension Initialization', () => {
    test('should have proper action configuration', () => {
      expect(manifest.action).toBeDefined();
      expect(manifest.action.default_title).toBe('Cerebrate DevTools');
      expect(manifest.action.default_icon).toBeDefined();
    });

    test('should configure extension update URL', () => {
      if (manifest.update_url) {
        expect(manifest.update_url).toMatch(/^https:\/\//);
      }
    });

    test('should set minimum Chrome version', () => {
      expect(manifest.minimum_chrome_version).toBeDefined();
      expect(parseInt(manifest.minimum_chrome_version)).toBeGreaterThanOrEqual(90);
    });

    test('should include commands for keyboard shortcuts', () => {
      expect(manifest.commands).toBeDefined();
      expect(manifest.commands['toggle-devtools']).toBeDefined();
      expect(manifest.commands['toggle-devtools'].description)
        .toBe('Toggle Cerebrate DevTools');
    });
  });
});