/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * GenerateHTMLPageTool - Generate complete HTML pages with CSS and JavaScript
 * 
 * Similar to GenerateJavaScriptModuleTool but for HTML pages
 */

import { Tool } from '@legion/tools-registry';
import fs from 'fs/promises';
import path from 'path';

// Input schema as plain JSON Schema
const generateHTMLPageToolInputSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Page title'
    },
    description: {
      type: 'string',
      description: 'Page description for meta tag'
    },
    favicon: {
      type: 'string',
      description: 'Favicon path or emoji'
    },
    css: {
      type: 'object',
      properties: {
        inline: {
          type: 'string',
          description: 'Inline CSS styles'
        },
        external: {
          type: 'array',
          items: { type: 'string' },
          description: 'External CSS file URLs'
        },
        framework: {
          type: 'string',
          enum: ['none', 'bootstrap', 'tailwind', 'bulma'],
          default: 'none',
          description: 'CSS framework to include'
        }
      },
      description: 'CSS configuration'
    },
    body: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'HTML body content'
        },
        class: {
          type: 'string',
          description: 'Body CSS class'
        },
        background: {
          type: 'string',
          description: 'Background style'
        }
      },
      description: 'Body configuration'
    },
    javascript: {
      type: 'object',
      properties: {
        inline: {
          type: 'string',
          description: 'Inline JavaScript code'
        },
        external: {
          type: 'array',
          items: { type: 'string' },
          description: 'External JavaScript file URLs'
        },
        modules: {
          type: 'array',
          items: { type: 'string' },
          description: 'ES6 modules to import'
        },
        onLoad: {
          type: 'string',
          description: 'JavaScript to run on page load'
        }
      },
      description: 'JavaScript configuration'
    },
    meta: {
      type: 'object',
      properties: {
        viewport: {
          type: 'string',
          default: 'width=device-width, initial-scale=1.0',
          description: 'Viewport meta tag'
        },
        charset: {
          type: 'string',
          default: 'UTF-8',
          description: 'Character encoding'
        },
        author: {
          type: 'string',
          description: 'Page author'
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'SEO keywords'
        }
      },
      description: 'Meta tag configuration'
    },
    projectPath: {
      type: 'string',
      description: 'Project root directory (optional, for file writing)'
    },
    writeToFile: {
      type: 'boolean',
      default: false,
      description: 'Whether to write generated HTML to file'
    },
    outputPath: {
      type: 'string',
      description: 'Relative path within project for output file (when writeToFile is true)'
    },
    responsive: {
      type: 'boolean',
      default: true,
      description: 'Whether to include responsive design meta tags'
    },
    minify: {
      type: 'boolean',
      default: false,
      description: 'Whether to minify the output HTML'
    }
  },
  required: ['title']
};

// Output schema as plain JSON Schema
const generateHTMLPageToolOutputSchema = {
  type: 'object',
  properties: {
    html: {
      type: 'string',
      description: 'Generated HTML code'
    },
    filePath: {
      type: 'string',
      description: 'File path where HTML was written (if writeToFile was true)'
    },
    size: {
      type: 'number',
      description: 'Size of generated HTML in characters'
    }
  },
  required: ['html', 'size']
};

export class GenerateHTMLPageTool extends Tool {
  constructor() {
    super({
      name: 'generate_html_page',
      description: 'Generate a complete HTML page with CSS styling and JavaScript functionality',
      inputSchema: generateHTMLPageToolInputSchema,
      outputSchema: generateHTMLPageToolOutputSchema
    });
  }

  async _execute(args) {
    try {
      const {
        title,
        description,
        favicon,
        css = {},
        body = {},
        javascript = {},
        meta = {},
        projectPath,
        writeToFile = false,
        outputPath,
        responsive = true,
        minify = false
      } = args;

      // Generate HTML structure
      const html = this.generateHTML({
        title,
        description,
        favicon,
        css,
        body,
        javascript,
        meta,
        responsive,
        minify
      });

      let filePath = null;
      
      // Write to file if requested
      if (writeToFile && outputPath) {
        if (!projectPath) {
          throw new Error('projectPath is required when writeToFile is true');
        }

        const fullPath = path.join(projectPath, outputPath);
        const directory = path.dirname(fullPath);
        
        // Ensure directory exists
        await fs.mkdir(directory, { recursive: true });
        
        // Write the HTML file
        await fs.writeFile(fullPath, html, 'utf8');
        filePath = fullPath;
      }

      return {
        html,
        filePath,
        size: html.length
      };
    } catch (error) {
      throw new Error(`HTML generation failed: ${error.message}`);
    }
  }

  generateHTML(config) {
    const {
      title,
      description,
      favicon,
      css = {},
      body = {},
      javascript = {},
      meta = {},
      responsive,
      minify
    } = config;

    const indent = minify ? '' : '    ';
    const newline = minify ? '' : '\n';

    let html = '<!DOCTYPE html>' + newline;
    html += '<html lang="en">' + newline;
    
    // Head section
    html += indent + '<head>' + newline;
    html += indent + indent + `<meta charset="${meta.charset || 'UTF-8'}">` + newline;
    
    if (responsive) {
      html += indent + indent + `<meta name="viewport" content="${meta.viewport || 'width=device-width, initial-scale=1.0'}">` + newline;
    }
    
    html += indent + indent + `<title>${title}</title>` + newline;
    
    if (description) {
      html += indent + indent + `<meta name="description" content="${description}">` + newline;
    }
    
    if (meta.author) {
      html += indent + indent + `<meta name="author" content="${meta.author}">` + newline;
    }
    
    if (meta.keywords && meta.keywords.length > 0) {
      html += indent + indent + `<meta name="keywords" content="${meta.keywords.join(', ')}">` + newline;
    }
    
    if (favicon) {
      if (favicon.length <= 2) {
        // Emoji favicon
        html += indent + indent + `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${favicon}</text></svg>">` + newline;
      } else {
        // Regular favicon path
        html += indent + indent + `<link rel="icon" href="${favicon}">` + newline;
      }
    }

    // External CSS
    if (css.framework && css.framework !== 'none') {
      const frameworks = {
        bootstrap: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
        tailwind: 'https://cdn.tailwindcss.com',
        bulma: 'https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css'
      };
      html += indent + indent + `<link rel="stylesheet" href="${frameworks[css.framework]}">` + newline;
    }

    if (css.external && css.external.length > 0) {
      css.external.forEach(url => {
        html += indent + indent + `<link rel="stylesheet" href="${url}">` + newline;
      });
    }

    // Inline CSS
    if (css.inline) {
      html += indent + indent + '<style>' + newline;
      html += css.inline + newline;
      html += indent + indent + '</style>' + newline;
    }

    html += indent + '</head>' + newline;

    // Body section
    const bodyClass = body.class ? ` class="${body.class}"` : '';
    const bodyStyle = body.background ? ` style="background: ${body.background}"` : '';
    html += indent + `<body${bodyClass}${bodyStyle}>` + newline;

    if (body.content) {
      html += body.content + newline;
    }

    // External JavaScript
    if (javascript.external && javascript.external.length > 0) {
      javascript.external.forEach(url => {
        html += indent + indent + `<script src="${url}"></script>` + newline;
      });
    }

    // Inline JavaScript
    if (javascript.inline || javascript.onLoad) {
      html += indent + indent + '<script>' + newline;
      
      if (javascript.onLoad) {
        html += indent + indent + indent + 'window.addEventListener(\'load\', function() {' + newline;
        html += indent + indent + indent + indent + javascript.onLoad + newline;
        html += indent + indent + indent + '});' + newline;
      }
      
      if (javascript.inline) {
        html += javascript.inline + newline;
      }
      
      html += indent + indent + '</script>' + newline;
    }

    html += indent + '</body>' + newline;
    html += '</html>';

    return html;
  }
}