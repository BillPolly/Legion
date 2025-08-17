/**
 * ImportRewriter - Rewrites @legion/* imports to /legion/* URLs
 * Transforms Node.js module paths to browser-compatible URLs
 */

export class ImportRewriter {
  constructor() {
    // Patterns for different import types
    this.patterns = [
      // import { X } from '@legion/...'
      {
        regex: /(\bimport\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+)(['"])@legion\/([^'"]+)\2/g,
        replacement: (match, prefix, quote, path) => {
          return `${prefix}${quote}${this.rewritePath('@legion/' + path)}${quote}`;
        }
      },
      // import '@legion/...'
      {
        regex: /(\bimport\s+)(['"])@legion\/([^'"]+)\2/g,
        replacement: (match, prefix, quote, path) => {
          return `${prefix}${quote}${this.rewritePath('@legion/' + path)}${quote}`;
        }
      },
      // export { X } from '@legion/...'
      {
        regex: /(\bexport\s+(?:{[^}]+}|\*)\s+from\s+)(['"])@legion\/([^'"]+)\2/g,
        replacement: (match, prefix, quote, path) => {
          return `${prefix}${quote}${this.rewritePath('@legion/' + path)}${quote}`;
        }
      },
      // dynamic import('@legion/...')
      {
        regex: /(\bimport\s*\(\s*)(['"])@legion\/([^'"]+)\2/g,
        replacement: (match, prefix, quote, path) => {
          return `${prefix}${quote}${this.rewritePath('@legion/' + path)}${quote}`;
        }
      },
      // require('@legion/...')
      {
        regex: /(\brequire\s*\(\s*)(['"])@legion\/([^'"]+)\2/g,
        replacement: (match, prefix, quote, path) => {
          return `${prefix}${quote}${this.rewritePath('@legion/' + path)}${quote}`;
        }
      },
      // Relative imports to other Legion packages: '../../utils/src/index.js'
      {
        regex: /(\bimport\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+)(['"])\.\.\/\.\.\/([^'"\/]+)\/([^'"]+)\2/g,
        replacement: (match, prefix, quote, packageName, path) => {
          return `${prefix}${quote}/legion/${packageName}/${path}${quote}`;
        }
      }
    ];
  }

  /**
   * Rewrite all @legion/* imports in the given content
   * @param {string} content - JavaScript content to rewrite
   * @returns {string} Content with rewritten imports
   */
  rewrite(content) {
    if (!content) {
      return content;
    }

    let result = content;
    
    // Apply each pattern
    for (const pattern of this.patterns) {
      result = result.replace(pattern.regex, pattern.replacement);
    }
    
    return result;
  }

  /**
   * Convert a @legion package path to a /legion URL
   * @param {string} packagePath - Path like '@legion/actors'
   * @returns {string} URL like '/legion/actors/index.js'
   */
  rewritePath(packagePath) {
    // Remove @legion/ prefix
    let path = packagePath.replace(/^@legion\//, '');
    
    // Convert to URL path
    let urlPath = `/legion/${path}`;
    
    // Add appropriate extension if missing
    if (!this.hasExtension(urlPath)) {
      const segments = urlPath.split('/').filter(s => s); // Remove empty segments
      
      // If it's just legion/packagename (2 segments), add /index.js
      if (segments.length === 2 && segments[0] === 'legion') {
        urlPath += '/index.js';
      } else if (urlPath.endsWith('/')) {
        // Path ends with /, add index.js
        urlPath += 'index.js';
      } else {
        // It's a file path, add .js extension
        urlPath += '.js';
      }
    }
    
    return urlPath;
  }

  /**
   * Check if a path has a file extension
   * @param {string} path - File path to check
   * @returns {boolean} True if path has an extension
   */
  hasExtension(path) {
    const knownExtensions = [
      '.js', '.mjs', '.jsx',
      '.ts', '.tsx',
      '.json',
      '.css', '.scss', '.sass', '.less',
      '.html', '.htm',
      '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp',
      '.woff', '.woff2', '.ttf', '.eot'
    ];
    
    return knownExtensions.some(ext => path.endsWith(ext));
  }
}