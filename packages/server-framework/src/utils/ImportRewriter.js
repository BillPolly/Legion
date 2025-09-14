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
      },
      // Local relative imports within same directory: './Component.js'
      {
        regex: /(\bimport\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+)(['"]).\/([^'"]+)\2/g,
        replacement: (match, prefix, quote, path, offset, string) => {
          return `${prefix}${quote}${this.rewriteLocalRelative('./' + path, this.currentContext)}${quote}`;
        }
      },
      // Local relative imports to parent directories: '../components/Component.js'
      {
        regex: /(\bimport\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+)(['"])\.\.\/([^'"]+)\2/g,
        replacement: (match, prefix, quote, path, offset, string) => {
          return `${prefix}${quote}${this.rewriteLocalRelative('../' + path, this.currentContext)}${quote}`;
        }
      }
    ];
  }

  /**
   * Rewrite all @legion/* imports in the given content
   * @param {string} content - JavaScript content to rewrite
   * @param {Object} context - Context for rewriting (e.g., current package info)
   * @returns {string} Content with rewritten imports
   */
  rewrite(content, context = {}) {
    if (!content) {
      return content;
    }

    // Store context for pattern replacements
    this.currentContext = context;
    let result = content;
    
    // Apply each pattern
    for (const pattern of this.patterns) {
      result = result.replace(pattern.regex, pattern.replacement);
    }
    
    return result;
  }

  /**
   * Convert local relative imports to static route paths
   * @param {string} relativePath - Relative path like './Component.js' or '../components/Component.js'
   * @param {Object} context - Context information (legionPackage, etc.)
   * @returns {string} Absolute path using appropriate route
   */
  rewriteLocalRelative(relativePath, context = {}) {
    // If we're in a Legion package context, resolve relative to the request URL
    if (context.baseUrl && context.requestPath) {
      const currentDir = context.requestPath.substring(0, context.requestPath.lastIndexOf('/'));
      
      console.log(`ImportRewriter DEBUG: relativePath="${relativePath}", currentDir="${currentDir}", baseUrl="${context.baseUrl}", requestPath="${context.requestPath}"`);
      
      if (relativePath.startsWith('./')) {
        // Same directory: ./Channel.js -> /legion/actors/Channel.js
        const cleanPath = relativePath.replace(/^\.\//, '');
        // Use currentDir directly since it already contains the full path like "/legion/actors"
        const result = `${currentDir}/${cleanPath}`;
        console.log(`ImportRewriter RESULT: ${relativePath} -> ${result}`);
        return result;
      } else if (relativePath.startsWith('../')) {
        // Parent directory: properly handle multiple ../
        let path = relativePath;
        let dir = currentDir;
        
        // Process each ../ step
        while (path.startsWith('../')) {
          path = path.substring(3); // Remove ../
          dir = dir.substring(0, dir.lastIndexOf('/'));
        }
        
        const result = `${dir}/${path}`;
        console.log(`ImportRewriter: ${relativePath} from ${currentDir} -> ${result}`);
        return result;
      }
    } else {
      // Regular app files - use static route
      const cleanPath = relativePath.replace(/^\.\//, '').replace(/^\.\.\//, '');
      if (relativePath.startsWith('./')) {
        return `/src/actors/${cleanPath}`;
      } else if (relativePath.startsWith('../')) {
        return `/src/${cleanPath}`;
      }
    }
    
    return relativePath;
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