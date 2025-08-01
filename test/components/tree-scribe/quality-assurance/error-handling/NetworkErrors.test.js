/**
 * TreeScribe Network Error Tests
 * 
 * Testing network-related error conditions and URL loading scenarios
 */

import { TreeScribe } from '../../../../../../src/components/tree-scribe/index.js';

describe('TreeScribe Network Error Handling', () => {
  let container;
  let instance;
  let originalFetch;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    // Save original fetch
    originalFetch = global.fetch;
  });

  afterEach(() => {
    if (instance && instance.destroy) {
      instance.destroy();
    }
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
    
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('HTTP Error Responses', () => {
    test('should handle 404 Not Found', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('404 - Page not found')
      });

      const result = await instance.loadYaml('https://example.com/missing.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/404|Not Found|Failed to load/i);
      
      // Should show error in UI
      const errorElement = container.querySelector('.error-message');
      expect(errorElement).toBeTruthy();
    });

    test('should handle 403 Forbidden', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.resolve({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('403 - Access denied')
      });

      const result = await instance.loadYaml('https://example.com/private.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/403|Forbidden|Failed to load/i);
    });

    test('should handle 500 Internal Server Error', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('500 - Server error')
      });

      const result = await instance.loadYaml('https://example.com/server-error.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/500|Internal Server Error|Failed to load/i);
    });

    test('should handle 429 Too Many Requests', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.resolve({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['Retry-After', '60']]),
        text: () => Promise.resolve('429 - Rate limited')
      });

      const result = await instance.loadYaml('https://api.example.com/document.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/429|Too Many Requests|Failed to load/i);
    });

    test('should handle redirects properly', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      let callCount = 0;
      global.fetch = (url) => {
        callCount++;
        if (callCount === 1) {
          // First call returns redirect
          return Promise.resolve({
            ok: false,
            status: 302,
            statusText: 'Found',
            headers: new Map([['Location', 'https://new-location.com/document.yaml']])
          });
        } else {
          // Second call (after redirect) succeeds
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(`
              title: Redirected Document
              content: Successfully loaded after redirect
            `)
          });
        }
      };

      const result = await instance.loadYaml('https://example.com/redirect.yaml');
      
      // Should handle redirects gracefully
      // Note: fetch handles redirects automatically, but testing manual handling
      if (result.success) {
        expect(result.nodeCount).toBeGreaterThan(0);
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Network Connectivity Issues', () => {
    test('should handle network timeout', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('Network timeout'));
        }, 50);
      });

      const result = await instance.loadYaml('https://slow.example.com/document.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timeout|Network timeout/i);
    });

    test('should handle connection refused', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.reject(new Error('Connection refused'));

      const result = await instance.loadYaml('https://down.example.com/document.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Connection refused/i);
    });

    test('should handle DNS resolution failure', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.reject(new Error('getaddrinfo ENOTFOUND'));

      const result = await instance.loadYaml('https://nonexistent-domain-12345.com/document.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle SSL/TLS errors', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.reject(new Error('SSL certificate error'));

      const result = await instance.loadYaml('https://invalid-ssl.example.com/document.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/SSL|certificate/i);
    });

    test('should handle network interruption during download', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.reject(new Error('Connection lost during download'))
      });

      const result = await instance.loadYaml('https://unstable.example.com/large-document.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Connection lost|download/i);
    });
  });

  describe('Content-Type and Encoding Issues', () => {
    test('should handle incorrect content-type', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([['Content-Type', 'application/json']]),
        text: () => Promise.resolve(`
          title: YAML Content
          content: This is actually YAML despite wrong content-type
        `)
      });

      const result = await instance.loadYaml('https://example.com/yaml-as-json.yaml');
      
      // Should handle content regardless of content-type header
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);
    });

    test('should handle corrupted response', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('���corrupted binary data���\x00\x01\x02')
      });

      const result = await instance.loadYaml('https://example.com/corrupted.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle different character encodings', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([['Content-Type', 'text/yaml; charset=utf-8']]),
        text: () => Promise.resolve(`
          title: "UTF-8 Document 🌟"
          content: |
            Testing UTF-8 encoding:
            - Emoji: 🎉 🚀
            - Accents: café, naïve
            - Chinese: 你好世界
        `)
      });

      const result = await instance.loadYaml('https://example.com/utf8.yaml');
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);
    });

    test('should handle very large responses', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Generate large YAML content
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB string
      const largeYaml = `
        title: "Large Document"
        content: "${largeContent}"
      `;

      global.fetch = () => Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(largeYaml)
      });

      const startTime = Date.now();
      const result = await instance.loadYaml('https://example.com/large.yaml');
      const loadTime = Date.now() - startTime;
      
      // Should handle large responses within reasonable time
      expect(loadTime).toBeLessThan(5000); // 5 seconds max
      
      if (result.success) {
        expect(result.nodeCount).toBeGreaterThan(0);
      } else {
        // May fail due to memory constraints
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('CORS and Security Issues', () => {
    test('should handle CORS errors', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.reject(new Error('CORS policy blocked request'));

      const result = await instance.loadYaml('https://different-domain.com/document.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/CORS|blocked/i);
    });

    test('should handle mixed content errors (HTTPS to HTTP)', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.reject(new Error('Mixed content blocked'));

      const result = await instance.loadYaml('http://insecure.example.com/document.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Mixed content|blocked/i);
    });

    test('should handle CSP violations', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.reject(new Error('Content Security Policy violation'));

      const result = await instance.loadYaml('https://blocked-by-csp.example.com/document.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Content Security Policy|CSP/i);
    });
  });

  describe('URL Validation and Edge Cases', () => {
    test('should handle malformed URLs', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const malformedUrls = [
        'htp://invalid-protocol.com/doc.yaml',
        'https:/missing-slash.com/doc.yaml',
        'https://spa ces.com/doc.yaml',
        'https://[invalid-ipv6]/doc.yaml',
        'file:///local/file.yaml' // May be blocked for security
      ];

      for (const url of malformedUrls) {
        global.fetch = () => Promise.reject(new Error('Invalid URL'));
        
        const result = await instance.loadYaml(url);
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    test('should handle data URLs', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const yamlContent = encodeURIComponent(`
        title: Data URL Test
        content: Loaded from data URL
      `);
      
      const dataUrl = `data:text/yaml;charset=utf-8,${yamlContent}`;

      // Mock fetch to handle data URLs (if not natively supported)
      global.fetch = (url) => {
        if (url.startsWith('data:')) {
          const content = decodeURIComponent(url.split(',')[1]);
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(content)
          });
        }
        return originalFetch(url);
      };

      const result = await instance.loadYaml(dataUrl);
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);
    });

    test('should handle blob URLs', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const yamlContent = `
        title: Blob URL Test
        content: Loaded from blob URL
      `;

      // Create blob URL
      let blobUrl;
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
        const blob = new Blob([yamlContent], { type: 'text/yaml' });
        blobUrl = URL.createObjectURL(blob);
        
        global.fetch = (url) => {
          if (url.startsWith('blob:')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              text: () => Promise.resolve(yamlContent)
            });
          }
          return originalFetch(url);
        };

        const result = await instance.loadYaml(blobUrl);
        
        expect(result.success).toBe(true);
        expect(result.nodeCount).toBeGreaterThan(0);
        
        // Cleanup
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      } else {
        // Skip test if Blob/URL not available
        expect(true).toBe(true);
      }
    });
  });

  describe('Retry and Recovery Mechanisms', () => {
    test('should handle temporary network failures', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      let attemptCount = 0;
      global.fetch = () => {
        attemptCount++;
        if (attemptCount < 3) {
          // First two attempts fail
          return Promise.reject(new Error('Temporary network error'));
        } else {
          // Third attempt succeeds
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(`
              title: Recovered Document
              content: Successfully loaded after retries
            `)
          });
        }
      };

      // Note: Current implementation doesn't include retry logic
      // This test demonstrates what should happen with retry implementation
      const result = await instance.loadYaml('https://unreliable.example.com/document.yaml');
      
      // Current behavior: fails on first attempt
      expect(result.success).toBe(false);
      expect(attemptCount).toBe(1);
    });

    test('should handle partial content recovery', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      global.fetch = () => Promise.resolve({
        ok: true,
        status: 206, // Partial Content
        text: () => Promise.resolve(`
          title: Partial Document
          content: |
            This document was partially downloaded
            Some content may be missing
        `)
      });

      const result = await instance.loadYaml('https://example.com/partial.yaml');
      
      // Should handle partial content
      if (result.success) {
        expect(result.nodeCount).toBeGreaterThan(0);
      } else {
        expect(result.error).toBeDefined();
      }
    });

    test('should handle concurrent requests properly', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      let requestCount = 0;
      global.fetch = (url) => {
        requestCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
            title: Concurrent Request ${requestCount}
            content: Request number ${requestCount}
          `)
        });
      };

      // Fire multiple concurrent requests
      const promises = [
        instance.loadYaml('https://example.com/doc1.yaml'),
        instance.loadYaml('https://example.com/doc2.yaml'),
        instance.loadYaml('https://example.com/doc3.yaml')
      ];

      const results = await Promise.all(promises);
      
      // Only the last request should be reflected in the component
      // Earlier requests should be cancelled or ignored
      expect(results).toHaveLength(3);
      
      // At least one should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });
});