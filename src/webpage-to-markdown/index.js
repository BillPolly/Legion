import { Tool, ToolResult } from '@jsenvoy/modules';
import puppeteer from 'puppeteer';

class WebPageToMarkdown extends Tool {
  constructor() {
    super();
    this.name = 'webpage_to_markdown';
    this.description = 'Converts web pages to markdown format';
  }

  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'webpage_to_markdown_convert',
        description: 'Convert a webpage to markdown format, preserving structure and formatting',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL of the webpage to convert'
            },
            includeImages: {
              type: 'boolean',
              description: 'Whether to include image links in the markdown (default: true)'
            },
            includeLinks: {
              type: 'boolean',
              description: 'Whether to preserve hyperlinks in the markdown (default: true)'
            },
            maxLength: {
              type: 'number',
              description: 'Maximum length of the markdown output in characters (default: 50000)'
            },
            waitForSelector: {
              type: 'string',
              description: 'Optional CSS selector to wait for before converting'
            }
          },
          required: ['url']
        }
      }
    };
  }

  /**
   * Invokes the webpage to markdown converter with the given tool call
   */
  async invoke(toolCall) {
    let args;
    try {
      // Parse the arguments
      args = this.parseArguments(toolCall.function.arguments);
      
      // Validate required parameters
      this.validateRequiredParameters(args, ['url']);
      
      // Convert the webpage
      const result = await this.convertToMarkdown(
        args.url,
        args.includeImages !== false,
        args.includeLinks !== false,
        args.maxLength || 50000,
        args.waitForSelector
      );
      
      // Return success response
      return ToolResult.success(result);
    } catch (error) {
      // Return error response
      return ToolResult.failure(
        error.message || 'Failed to convert webpage to markdown',
        {
          url: args?.url || 'unknown',
          errorType: 'conversion_error'
        }
      );
    }
  }

  /**
   * Converts a webpage to markdown
   */
  async convertToMarkdown(url, includeImages = true, includeLinks = true, maxLength = 50000, waitForSelector = null) {
    let browser = null;
    
    try {
      console.log(`Converting webpage to markdown: ${url}`);
      
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
      
      console.log(`Successfully converted ${url} to markdown (${finalMarkdown.length} characters)`);
      
      return {
        success: true,
        url: url,
        markdown: finalMarkdown,
        length: finalMarkdown.length,
        truncated: finalMarkdown.length > maxLength
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

export default WebPageToMarkdown;