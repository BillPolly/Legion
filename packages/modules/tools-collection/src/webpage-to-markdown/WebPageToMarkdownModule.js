import { Tool, Module } from '@legion/tools-registry';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

/**
 * WebPageToMarkdown tool that converts web pages to markdown format
 * NEW: Pure logic implementation - metadata comes from tools-metadata.json
 */
class WebPageToMarkdownTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
    this.shortName = 'web2md';
  }

  // BACKWARDS COMPATIBILITY: support old pattern during migration
  static createLegacy() {
    return new WebPageToMarkdownTool({
      name: 'webpage_to_markdown',
      description: 'Converts web pages to markdown format, preserving structure and formatting',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the webpage to convert'
          },
          includeImages: {
            type: 'boolean',
            default: true,
            description: 'Whether to include image links in the markdown'
          },
          includeLinks: {
            type: 'boolean',
            default: true,
            description: 'Whether to preserve hyperlinks in the markdown'
          },
          maxLength: {
            type: 'number',
            default: 50000,
            description: 'Maximum length of the markdown output in characters'
          },
          waitForSelector: {
            type: 'string',
            description: 'Optional CSS selector to wait for before converting'
          }
        },
        required: ['url']
      },
      outputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL that was converted' },
          markdown: { type: 'string', description: 'The converted markdown content' },
          length: { type: 'number', description: 'Length of the markdown content' },
          truncated: { type: 'boolean', description: 'Whether content was truncated' }
        },
        required: ['url', 'markdown', 'length', 'truncated']
      }
    });
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    const { url, includeImages = true, includeLinks = true, maxLength = 50000, waitForSelector } = params;
    
    // Emit progress event
    this.progress(`Starting webpage conversion: ${url}`, 0);
    
    // Convert the webpage
    const result = await this.convertToMarkdown(
      url,
      includeImages,
      includeLinks,
      maxLength,
      waitForSelector
    );
    
    // Emit completion
    this.info(`Conversion completed successfully for: ${url}`);
    
    return result;
  }

  /**
   * Converts a webpage to markdown
   */
  async convertToMarkdown(url, includeImages = true, includeLinks = true, maxLength = 50000, waitForSelector = null) {
    let browser = null;
    
    try {
      // Launch browser
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to the page
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      if (!response.ok()) {
        throw new Error(`Failed to load page: ${response.status()} ${response.statusText()}`);
      }
      
      // Wait for specific selector if provided
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 10000 });
      }
      
      // Extract content and convert to markdown
      const markdown = await page.evaluate((includeImgs, includeAnchors) => {
        // Helper function to convert elements to markdown
        const elementToMarkdown = (element, level = 0) => {
          const tagName = element.tagName.toLowerCase();
          const textContent = element.textContent.trim();
          
          switch (tagName) {
            case 'h1':
              return `# ${textContent}\n`;
            case 'h2':
              return `## ${textContent}\n`;
            case 'h3':
              return `### ${textContent}\n`;
            case 'h4':
              return `#### ${textContent}\n`;
            case 'h5':
              return `##### ${textContent}\n`;
            case 'h6':
              return `###### ${textContent}\n`;
            case 'p':
              return textContent ? `${textContent}\n\n` : '';
            case 'ul':
            case 'ol':
              let listMd = '';
              const listItems = element.querySelectorAll('li');
              listItems.forEach((li, index) => {
                const prefix = tagName === 'ol' ? `${index + 1}. ` : '- ';
                listMd += `${prefix}${li.textContent.trim()}\n`;
              });
              return listMd + '\n';
            case 'blockquote':
              return `> ${textContent}\n\n`;
            case 'code':
              return `\`${textContent}\``;
            case 'pre':
              const codeBlock = element.querySelector('code');
              const code = codeBlock ? codeBlock.textContent : textContent;
              return `\`\`\`\n${code}\n\`\`\`\n\n`;
            case 'a':
              if (!includeAnchors) return textContent;
              const href = element.getAttribute('href');
              return href ? `[${textContent}](${href})` : textContent;
            case 'img':
              if (!includeImgs) return '';
              const src = element.getAttribute('src');
              const alt = element.getAttribute('alt') || 'image';
              return src ? `![${alt}](${src})\n\n` : '';
            case 'strong':
            case 'b':
              return `**${textContent}**`;
            case 'em':
            case 'i':
              return `*${textContent}*`;
            case 'hr':
              return '---\n\n';
            default:
              return '';
          }
        };
        
        // Get page title and metadata
        const title = document.title;
        const metaDesc = document.querySelector('meta[name="description"]');
        const description = metaDesc ? metaDesc.getAttribute('content') : '';
        
        // Find main content area
        const contentSelectors = [
          'main', 'article', '[role="main"]', '#content', '.content', '#main', '.main', 'body'
        ];
        
        let contentElement = null;
        for (const selector of contentSelectors) {
          contentElement = document.querySelector(selector);
          if (contentElement) break;
        }
        
        if (!contentElement) {
          contentElement = document.body;
        }
        
        // Remove unwanted elements
        const unwanted = contentElement.querySelectorAll('script, style, noscript, nav, header, footer');
        unwanted.forEach(el => el.remove());
        
        // Build markdown
        let markdown = `# ${title}\n\n`;
        if (description) {
          markdown += `> ${description}\n\n`;
        }
        markdown += `> URL: ${window.location.href}\n\n---\n\n`;
        
        // Process all relevant elements
        const elements = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, code, a, img, strong, b, em, i, hr');
        
        elements.forEach(element => {
          // Skip if element is inside another processed element
          if (element.closest('pre') && element.tagName !== 'PRE') return;
          if (element.closest('ul, ol') && !['UL', 'OL'].includes(element.tagName)) return;
          
          const md = elementToMarkdown(element);
          if (md) {
            markdown += md;
          }
        });
        
        return markdown;
      }, includeImages, includeLinks);
      
      // Truncate if too long
      let finalMarkdown = markdown;
      if (markdown.length > maxLength) {
        finalMarkdown = markdown.substring(0, maxLength) + '\n\n... (truncated)';
      }
      
      return {
        url: url,
        markdown: finalMarkdown,
        length: finalMarkdown.length,
        truncated: markdown.length > maxLength
      };
      
    } catch (error) {
      throw new Error(`Failed to convert webpage to markdown: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

/**
 * WebPageToMarkdownModule - NEW metadata-driven architecture
 * Metadata comes from tools-metadata.json, tools contain pure logic only
 */
export default class WebPageToMarkdownModule extends Module {
  constructor() {
    super();
    this.name = 'webpage-to-markdown';
    this.description = 'Convert webpages to markdown format';
    this.version = '1.0.0';
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new WebPageToMarkdownModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module - NEW metadata-driven approach
   */
  async initialize() {
    await super.initialize(); // This will load metadata automatically
    
    // NEW APPROACH: Create tools using metadata
    if (this.metadata) {
      // Create webpage_to_markdown tool using metadata
      const webpageTool = this.createToolFromMetadata('webpage_to_markdown', WebPageToMarkdownTool);
      this.registerTool(webpageTool.name, webpageTool);
    } else {
      // FALLBACK: Old approach for backwards compatibility
      const webpageTool = WebPageToMarkdownTool.createLegacy();
      this.registerTool(webpageTool.name, webpageTool);
    }
  }
}