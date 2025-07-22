/**
 * Tests for HTMLGenerator class
 * 
 * HTMLGenerator is responsible for generating HTML files and templates
 * based on architectural plans and component specifications.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { HTMLGenerator } from '../../../src/generation/HTMLGenerator.js';

describe('HTMLGenerator', () => {
  let htmlGenerator;

  beforeEach(() => {
    htmlGenerator = new HTMLGenerator();
  });

  describe('Constructor', () => {
    test('should create HTMLGenerator with default configuration', () => {
      expect(htmlGenerator).toBeDefined();
      expect(htmlGenerator.config).toBeDefined();
      expect(htmlGenerator.config.doctype).toBe('html5');
      expect(htmlGenerator.config.indentation).toBe(2);
    });

    test('should accept custom configuration', () => {
      const customGenerator = new HTMLGenerator({
        doctype: 'xhtml',
        indentation: 4,
        minify: true,
        includeMeta: false
      });

      expect(customGenerator.config.doctype).toBe('xhtml');
      expect(customGenerator.config.indentation).toBe(4);
      expect(customGenerator.config.minify).toBe(true);
      expect(customGenerator.config.includeMeta).toBe(false);
    });
  });

  describe('Basic HTML Generation', () => {
    test('should generate basic HTML5 document', async () => {
      const spec = {
        title: 'Test Page',
        components: []
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<title>Test Page</title>');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');
    });

    test('should generate HTML with meta tags', async () => {
      const spec = {
        title: 'Meta Test',
        meta: {
          description: 'Test description',
          keywords: 'test, html, generation',
          author: 'Test Author'
        }
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('<meta name="description" content="Test description">');
      expect(html).toContain('<meta name="keywords" content="test, html, generation">');
      expect(html).toContain('<meta name="author" content="Test Author">');
    });

    test('should include favicon link in head', async () => {
      const spec = {
        title: 'Favicon Test',
        components: []
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('<link rel="icon" type="image/x-icon" href="/favicon.ico">');
    });

    test('should generate HTML with custom head content', async () => {
      const spec = {
        title: 'Custom Head',
        head: [
          '<link rel="stylesheet" href="styles.css">',
          '<script src="app.js"></script>',
          '<meta property="og:title" content="Custom Title">'
        ]
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('<link rel="stylesheet" href="styles.css">');
      expect(html).toContain('<script src="app.js"></script>');
      expect(html).toContain('<meta property="og:title" content="Custom Title">');
    });
  });

  describe('Component Generation', () => {
    test('should generate HTML with simple components', async () => {
      const spec = {
        title: 'Component Test',
        components: [
          {
            type: 'header',
            content: 'Welcome to My Site',
            className: 'main-header'
          },
          {
            type: 'section',
            content: 'This is the main content area',
            id: 'main-content'
          }
        ]
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('<header class="main-header">Welcome to My Site</header>');
      expect(html).toContain('<section id="main-content">This is the main content area</section>');
    });

    test('should generate nested components', async () => {
      const spec = {
        title: 'Nested Components',
        components: [
          {
            type: 'div',
            className: 'container',
            children: [
              {
                type: 'h1',
                content: 'Main Title'
              },
              {
                type: 'div',
                className: 'content',
                children: [
                  { type: 'p', content: 'First paragraph' },
                  { type: 'p', content: 'Second paragraph' }
                ]
              }
            ]
          }
        ]
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('<div class="container">');
      expect(html).toContain('<h1>Main Title</h1>');
      expect(html).toContain('<div class="content">');
      expect(html).toContain('<p>First paragraph</p>');
      expect(html).toContain('<p>Second paragraph</p>');
    });

    test('should generate components with attributes', async () => {
      const spec = {
        title: 'Attributes Test',
        components: [
          {
            type: 'form',
            attributes: {
              method: 'POST',
              action: '/submit',
              enctype: 'multipart/form-data'
            },
            children: [
              {
                type: 'input',
                attributes: {
                  type: 'text',
                  name: 'username',
                  placeholder: 'Enter username',
                  required: true
                }
              },
              {
                type: 'button',
                attributes: { type: 'submit' },
                content: 'Submit'
              }
            ]
          }
        ]
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('<form method="POST" action="/submit" enctype="multipart/form-data">');
      expect(html).toContain('<input type="text" name="username" placeholder="Enter username" required>');
      expect(html).toContain('<button type="submit">Submit</button>');
    });
  });

  describe('Template Generation', () => {
    test('should generate HTML from template', async () => {
      const template = {
        name: 'basic-page',
        structure: {
          header: { type: 'header', className: 'site-header' },
          nav: { type: 'nav', className: 'main-nav' },
          main: { type: 'main', className: 'content' },
          footer: { type: 'footer', className: 'site-footer' }
        }
      };

      const data = {
        title: 'Template Test',
        header: 'Site Header',
        nav: ['Home', 'About', 'Contact'],
        main: 'Main content goes here',
        footer: '© 2024 Test Site'
      };

      const html = await htmlGenerator.generateFromTemplate(template, data);

      expect(html).toContain('<header class="site-header">Site Header</header>');
      expect(html).toContain('<nav class="main-nav">');
      expect(html).toContain('<main class="content">Main content goes here</main>');
      expect(html).toContain('<footer class="site-footer">© 2024 Test Site</footer>');
    });

    test('should generate list components from arrays', async () => {
      const template = {
        name: 'list-template',
        structure: {
          ul: {
            type: 'ul',
            className: 'item-list',
            itemTemplate: { type: 'li', content: '{{item}}' }
          }
        }
      };

      const data = {
        title: 'List Test',
        ul: ['Item 1', 'Item 2', 'Item 3']
      };

      const html = await htmlGenerator.generateFromTemplate(template, data);

      expect(html).toContain('<ul class="item-list">');
      expect(html).toContain('<li>Item 1</li>');
      expect(html).toContain('<li>Item 2</li>');
      expect(html).toContain('<li>Item 3</li>');
    });

    test('should handle conditional content', async () => {
      const template = {
        name: 'conditional-template',
        structure: {
          main: {
            type: 'main',
            children: [
              {
                type: 'div',
                condition: 'showWelcome',
                content: 'Welcome message'
              },
              {
                type: 'div',
                condition: 'showError',
                content: 'Error message'
              }
            ]
          }
        }
      };

      const data = {
        title: 'Conditional Test',
        showWelcome: true,
        showError: false
      };

      const html = await htmlGenerator.generateFromTemplate(template, data);

      expect(html).toContain('Welcome message');
      expect(html).not.toContain('Error message');
    });
  });

  describe('Form Generation', () => {
    test('should generate form with various input types', async () => {
      const formSpec = {
        action: '/submit',
        method: 'POST',
        fields: [
          { type: 'text', name: 'username', label: 'Username', required: true },
          { type: 'email', name: 'email', label: 'Email Address', required: true },
          { type: 'password', name: 'password', label: 'Password', required: true },
          { type: 'textarea', name: 'bio', label: 'Biography', rows: 4 },
          { type: 'select', name: 'country', label: 'Country', options: ['USA', 'Canada', 'UK'] },
          { type: 'checkbox', name: 'subscribe', label: 'Subscribe to newsletter' },
          { type: 'radio', name: 'gender', label: 'Gender', options: ['Male', 'Female', 'Other'] }
        ]
      };

      const html = await htmlGenerator.generateForm(formSpec);

      expect(html).toContain('<form action="/submit" method="POST">');
      expect(html).toContain('<input type="text" name="username" id="username" required>');
      expect(html).toContain('<input type="email" name="email" id="email" required>');
      expect(html).toContain('<textarea name="bio" id="bio" rows="4">');
      expect(html).toContain('<select name="country" id="country">');
      expect(html).toContain('<option value="USA">USA</option>');
      expect(html).toContain('<input type="checkbox" name="subscribe" id="subscribe">');
      expect(html).toContain('<input type="radio" name="gender" value="Male" id="gender-male">');
    });

    test('should generate form with validation attributes', async () => {
      const formSpec = {
        fields: [
          {
            type: 'text',
            name: 'username',
            validation: {
              minLength: 3,
              maxLength: 20,
              pattern: '^[a-zA-Z0-9_]+$'
            }
          },
          {
            type: 'number',
            name: 'age',
            validation: {
              min: 18,
              max: 120
            }
          }
        ]
      };

      const html = await htmlGenerator.generateForm(formSpec);

      expect(html).toContain('minlength="3"');
      expect(html).toContain('maxlength="20"');
      expect(html).toContain('pattern="^[a-zA-Z0-9_]+$"');
      expect(html).toContain('min="18"');
      expect(html).toContain('max="120"');
    });
  });

  describe('Semantic HTML Generation', () => {
    test('should generate semantic HTML5 structure', async () => {
      const spec = {
        title: 'Semantic Test',
        semantic: true,
        layout: {
          header: {
            nav: ['Home', 'About', 'Services', 'Contact']
          },
          main: {
            article: {
              title: 'Main Article',
              content: 'Article content',
              aside: 'Related information'
            }
          },
          footer: {
            content: 'Footer content'
          }
        }
      };

      const html = await htmlGenerator.generateSemanticHTML(spec);

      expect(html).toContain('<header>');
      expect(html).toContain('<nav>');
      expect(html).toContain('<main>');
      expect(html).toContain('<article>');
      expect(html).toContain('<aside>');
      expect(html).toContain('<footer>');
    });

    test('should generate accessible HTML with ARIA attributes', async () => {
      const spec = {
        title: 'Accessibility Test',
        accessibility: true,
        components: [
          {
            type: 'button',
            content: 'Menu',
            aria: {
              label: 'Open navigation menu',
              expanded: false,
              controls: 'nav-menu'
            }
          },
          {
            type: 'nav',
            id: 'nav-menu',
            aria: { hidden: true },
            children: [
              { type: 'a', href: '#', content: 'Home' },
              { type: 'a', href: '#', content: 'About' }
            ]
          }
        ]
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('aria-label="Open navigation menu"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('aria-controls="nav-menu"');
      expect(html).toContain('aria-hidden="true"');
    });
  });

  describe('CSS Integration', () => {
    test('should generate HTML with inline styles', async () => {
      const spec = {
        title: 'Inline Styles',
        components: [
          {
            type: 'div',
            styles: {
              backgroundColor: 'blue',
              color: 'white',
              padding: '20px'
            },
            content: 'Styled content'
          }
        ]
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('style="background-color: blue; color: white; padding: 20px;"');
    });

    test('should generate HTML with CSS class references', async () => {
      const spec = {
        title: 'CSS Classes',
        cssClasses: {
          'btn': 'button',
          'btn-primary': 'primary button',
          'container': 'main container'
        },
        components: [
          {
            type: 'div',
            className: 'container',
            children: [
              {
                type: 'button',
                className: 'btn btn-primary',
                content: 'Click me'
              }
            ]
          }
        ]
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('class="container"');
      expect(html).toContain('class="btn btn-primary"');
    });
  });

  describe('Framework Integration', () => {
    test('should generate HTML for React components', async () => {
      const spec = {
        title: 'React Integration',
        framework: 'react',
        components: [
          {
            type: 'component',
            name: 'App',
            children: [
              { type: 'component', name: 'Header' },
              { type: 'component', name: 'MainContent' },
              { type: 'component', name: 'Footer' }
            ]
          }
        ]
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('<div id="root">');
      expect(html).toContain('<!-- React App will mount here -->');
    });

    test('should generate HTML for Vue.js components', async () => {
      const spec = {
        title: 'Vue Integration',
        framework: 'vue',
        components: [
          {
            type: 'component',
            name: 'app',
            template: '<div><header></header><main></main></div>'
          }
        ]
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('<div id="app">');
      expect(html).toContain('<!-- Vue App will mount here -->');
    });
  });

  describe('Output Formatting', () => {
    test('should generate minified HTML when configured', async () => {
      const minifiedGenerator = new HTMLGenerator({ minify: true });
      
      const spec = {
        title: 'Minified Test',
        components: [
          {
            type: 'div',
            children: [
              { type: 'h1', content: 'Title' },
              { type: 'p', content: 'Paragraph' }
            ]
          }
        ]
      };

      const html = await minifiedGenerator.generateHTML(spec);

      expect(html).not.toContain('  '); // No extra spaces
      expect(html).not.toContain('\n  '); // No indentation
    });

    test('should generate formatted HTML with custom indentation', async () => {
      const formattedGenerator = new HTMLGenerator({ indentation: 4 });
      
      const spec = {
        title: 'Formatted Test',
        components: [
          {
            type: 'div',
            children: [
              { type: 'p', content: 'Content' }
            ]
          }
        ]
      };

      const html = await formattedGenerator.generateHTML(spec);

      expect(html).toContain('    <div>'); // 4-space indentation
      expect(html).toContain('        <p>'); // Nested 4-space indentation
    });
  });

  describe('Validation and Error Handling', () => {
    test('should validate HTML spec before generation', async () => {
      const invalidSpec = {
        // Missing title
        components: []
      };

      const validation = await htmlGenerator.validateSpec(invalidSpec);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Title is required');
    });

    test('should handle invalid component types gracefully', async () => {
      const spec = {
        title: 'Invalid Component Test',
        components: [
          {
            type: 'invalid-element',
            content: 'This should be handled gracefully'
          }
        ]
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('<div>This should be handled gracefully</div>');
    });

    test('should escape HTML content to prevent XSS', async () => {
      const spec = {
        title: 'Security Test',
        components: [
          {
            type: 'p',
            content: '<script>alert("XSS")</script>'
          }
        ]
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html).toContain('&lt;script&gt;alert("XSS")&lt;/script&gt;');
      expect(html).not.toContain('<script>alert("XSS")</script>');
    });
  });

  describe('Performance and Optimization', () => {
    test('should generate HTML efficiently for large component trees', async () => {
      const spec = {
        title: 'Performance Test',
        components: Array.from({ length: 1000 }, (_, i) => ({
          type: 'div',
          className: `item-${i}`,
          content: `Item ${i}`
        }))
      };

      const startTime = Date.now();
      const html = await htmlGenerator.generateHTML(spec);
      const endTime = Date.now();

      expect(html).toContain('Item 0');
      expect(html).toContain('Item 999');
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should cache repeated component patterns', async () => {
      const spec = {
        title: 'Caching Test',
        components: Array.from({ length: 100 }, () => ({
          type: 'button',
          className: 'btn btn-primary',
          content: 'Click me'
        }))
      };

      const html = await htmlGenerator.generateHTML(spec);

      expect(html.split('<button class="btn btn-primary">').length - 1).toBe(100);
    });
  });
});