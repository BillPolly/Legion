/**
 * GenerateHTMLPageTool - Generate complete HTML pages with CSS and JavaScript
 * 
 * Similar to GenerateJavaScriptModuleTool but for HTML pages
 */

import { Tool } from '@legion/tool-system';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export class GenerateHTMLPageTool extends Tool {
  constructor() {
    super();
    this.name = 'generate_html_page';
    this.description = 'Generate a complete HTML page with CSS styling and JavaScript functionality';
    this.inputSchema = z.object({
      title: z.string().describe('Page title'),
      description: z.string().optional().describe('Page description for meta tag'),
      favicon: z.string().optional().describe('Favicon path or emoji'),
      css: z.object({
        inline: z.string().optional().describe('Inline CSS styles'),
        external: z.array(z.string()).optional().describe('External CSS file URLs'),
        framework: z.enum(['none', 'bootstrap', 'tailwind', 'bulma']).optional().default('none').describe('CSS framework to include')
      }).optional().describe('CSS configuration'),
      body: z.object({
        content: z.string().optional().describe('HTML body content'),
        class: z.string().optional().describe('Body CSS class'),
        background: z.string().optional().describe('Background style')
      }).optional().describe('Body configuration'),
      javascript: z.object({
        inline: z.string().optional().describe('Inline JavaScript code'),
        external: z.array(z.string()).optional().describe('External JavaScript file URLs'),
        modules: z.array(z.string()).optional().describe('ES6 modules to import'),
        onLoad: z.string().optional().describe('JavaScript to run on page load')
      }).optional().describe('JavaScript configuration'),
      meta: z.object({
        viewport: z.string().optional().default('width=device-width, initial-scale=1.0').describe('Viewport meta tag'),
        charset: z.string().optional().default('UTF-8').describe('Character encoding'),
        author: z.string().optional().describe('Page author'),
        keywords: z.array(z.string()).optional().describe('SEO keywords')
      }).optional().describe('Meta tag configuration'),
      projectPath: z.string().optional().describe('Project root directory (optional, for file writing)'),
      writeToFile: z.boolean().optional().default(false).describe('Whether to write generated HTML to file'),
      outputPath: z.string().optional().describe('Relative path within project for output file (when writeToFile is true)'),
      responsive: z.boolean().optional().default(true).describe('Whether to include responsive design meta tags'),
      minify: z.boolean().optional().default(false).describe('Whether to minify the output HTML')
    });
    this.outputSchema = z.object({
      html: z.string().describe('Generated HTML code'),
      filePath: z.string().optional().describe('File path where HTML was written (if writeToFile was true)'),
      size: z.number().describe('Size of generated HTML in characters')
    });
  }

  async execute(args) {
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