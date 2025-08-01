/**
 * TreeScribe Workflow Integration Tests
 * 
 * Testing complex user workflows and real-world usage patterns
 */

import { TreeScribe } from '../../../../../../src/components/tree-scribe/index.js';

describe('TreeScribe Workflow Integration', () => {
  let container;
  let instance;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (instance) {
      instance.destroy();
      instance = null;
    }
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('Documentation Browsing Workflow', () => {
    test('should support typical documentation browsing pattern', async () => {
      instance = TreeScribe.create({
        dom: container,
        theme: 'light'
      });

      // Load a documentation structure
      const docYaml = `
        title: API Documentation
        content: |
          # API Reference
          Complete API documentation for the library.
        children:
          - title: Getting Started
            content: |
              ## Quick Start
              Follow these steps to get started quickly.
            children:
              - title: Installation
                content: |
                  \`\`\`bash
                  npm install tree-scribe
                  \`\`\`
              - title: Basic Usage
                content: |
                  \`\`\`javascript
                  import { TreeScribe } from 'tree-scribe';
                  const tree = TreeScribe.create({ dom: container });
                  \`\`\`
          - title: Core Concepts
            content: |
              ## Understanding TreeScribe
              Learn the fundamental concepts.
            children:
              - title: Umbilical Protocol
                content: The component receives all dependencies through umbilical
              - title: MVVM Architecture
                content: Model-View-ViewModel pattern for complex components
          - title: API Reference
            content: |
              ## Methods
              All available methods and their usage.
            children:
              - title: create()
                content: |
                  ### TreeScribe.create(umbilical)
                  Creates a new TreeScribe instance.
              - title: loadYaml()
                content: |
                  ### instance.loadYaml(content)
                  Loads YAML content into the tree.
              - title: search()
                content: |
                  ### instance.search(query, options)
                  Searches the tree content.
      `;

      await instance.loadYaml(docYaml);

      // User workflow: Browse to installation guide
      const installNode = Array.from(container.querySelectorAll('[role="treeitem"]'))
        .find(node => node.textContent.includes('Installation'));
      
      expect(installNode).toBeTruthy();

      // Expand parent if needed
      const parentNode = installNode.parentElement.closest('[role="treeitem"]');
      if (parentNode && parentNode.getAttribute('aria-expanded') === 'false') {
        const toggle = parentNode.querySelector('.node-toggle');
        if (toggle) toggle.click();
      }

      // User workflow: Search for specific API method
      if (instance.search) {
        const results = instance.search('loadYaml');
        expect(results.length).toBeGreaterThan(0);

        // Navigate to first result
        if (instance.navigateToSearchResult) {
          instance.navigateToSearchResult(0);
          
          // Check if the node is visible and highlighted
          const highlighted = container.querySelector('.search-highlight');
          expect(highlighted).toBeTruthy();
        }
      }

      // User workflow: Collapse all except current section
      if (instance.collapseAll && instance.expandPath) {
        instance.collapseAll();
        
        // Expand path to API Reference > loadYaml()
        const path = ['API Documentation', 'API Reference', 'loadYaml()'];
        instance.expandPath(path);
        
        // Verify path is expanded
        const apiRefNode = Array.from(container.querySelectorAll('[role="treeitem"]'))
          .find(node => node.textContent.includes('API Reference'));
        
        if (apiRefNode) {
          expect(apiRefNode.getAttribute('aria-expanded')).toBe('true');
        }
      }

      // User workflow: Export current view
      if (instance.exportHTML) {
        const exported = instance.exportHTML({
          includeCollapsed: false
        });
        
        expect(exported).toContain('API Documentation');
        expect(exported).toContain('loadYaml');
      }
    });
  });

  describe('Code Navigation Workflow', () => {
    test('should support code structure navigation pattern', async () => {
      instance = TreeScribe.create({
        dom: container,
        theme: 'dark'
      });

      // Load a code structure
      const codeYaml = `
        title: src/
        type: folder
        children:
          - title: components/
            type: folder
            children:
              - title: TreeScribe/
                type: folder
                children:
                  - title: index.js
                    type: file
                    content: |
                      export { TreeScribe } from './TreeScribe.js';
                      export { TreeNode } from './TreeNode.js';
                  - title: TreeScribe.js
                    type: file
                    content: |
                      export class TreeScribe {
                        constructor(options) {
                          // Implementation
                        }
                      }
                  - title: TreeNode.js
                    type: file
                    content: |
                      export class TreeNode {
                        constructor(data) {
                          // Implementation
                        }
                      }
              - title: SearchEngine/
                type: folder
                children:
                  - title: SearchEngine.js
                    type: file
                    content: |
                      export class SearchEngine {
                        search(query) {
                          // Search implementation
                        }
                      }
          - title: utils/
            type: folder
            children:
              - title: helpers.js
                type: file
                content: |
                  export function debounce(fn, delay) {
                    // Debounce implementation
                  }
      `;

      await instance.loadYaml(codeYaml);

      // User workflow: Navigate to specific file
      const searchEngineNode = Array.from(container.querySelectorAll('[role="treeitem"]'))
        .find(node => node.textContent.includes('SearchEngine.js'));
      
      expect(searchEngineNode).toBeTruthy();

      // User workflow: Search for class definition
      if (instance.search) {
        const results = instance.search('export class');
        expect(results.length).toBeGreaterThan(0);

        // Should find multiple class definitions
        const nodeIds = results.map(r => r.nodeId);
        expect(nodeIds.length).toBeGreaterThanOrEqual(2);
      }

      // User workflow: Collapse folders except current
      if (instance.collapseAll) {
        instance.collapseAll();
        
        // Expand only components folder
        const componentsNode = Array.from(container.querySelectorAll('[role="treeitem"]'))
          .find(node => node.textContent === 'components/');
        
        if (componentsNode) {
          const toggle = componentsNode.querySelector('.node-toggle');
          if (toggle) toggle.click();
          
          expect(componentsNode.getAttribute('aria-expanded')).toBe('true');
        }
      }

      // User workflow: Filter by file type
      if (instance.filter) {
        instance.filter(node => node.type === 'file' && node.title.endsWith('.js'));
        
        // Only JavaScript files should be visible
        const visibleNodes = container.querySelectorAll('[role="treeitem"]:not(.filtered-out)');
        visibleNodes.forEach(node => {
          const title = node.querySelector('.node-title');
          if (title && node.dataset.type === 'file') {
            expect(title.textContent).toMatch(/\.js$/);
          }
        });
      }
    });
  });

  describe('Note-Taking Workflow', () => {
    test('should support hierarchical note-taking pattern', async () => {
      instance = TreeScribe.create({
        dom: container,
        editable: true // If editing is supported
      });

      // Load a note structure
      const notesYaml = `
        title: Personal Notes
        content: My personal knowledge base
        children:
          - title: Project Ideas
            content: |
              ## Potential Projects
              Ideas for future development
            children:
              - title: Web App Ideas
                content: |
                  - Task management with AI
                  - Collaborative whiteboard
                  - Code snippet manager
              - title: Mobile App Ideas
                content: |
                  - Habit tracker
                  - Local first note app
          - title: Learning Resources
            content: Collection of useful resources
            children:
              - title: JavaScript
                content: |
                  - [MDN Web Docs](https://developer.mozilla.org)
                  - [JavaScript.info](https://javascript.info)
              - title: Design
                content: |
                  - [Refactoring UI](https://refactoringui.com)
                  - [Design Systems](https://designsystems.com)
          - title: Daily Journal
            content: Daily thoughts and progress
            children:
              - title: 2024-01-15
                content: |
                  Today I learned about:
                  - TreeScribe architecture
                  - MVVM pattern benefits
              - title: 2024-01-16
                content: |
                  Progress:
                  - Completed integration tests
                  - Started documentation
      `;

      await instance.loadYaml(notesYaml);

      // User workflow: Navigate to today's journal
      const todayNode = Array.from(container.querySelectorAll('[role="treeitem"]'))
        .find(node => node.textContent.includes('2024-01-16'));
      
      expect(todayNode).toBeTruthy();

      // User workflow: Search across all notes
      if (instance.search) {
        const results = instance.search('MVVM');
        expect(results.length).toBeGreaterThan(0);
      }

      // User workflow: Expand specific section
      const journalNode = Array.from(container.querySelectorAll('[role="treeitem"]'))
        .find(node => node.textContent === 'Daily Journal');
      
      if (journalNode && journalNode.getAttribute('aria-expanded') === 'false') {
        const toggle = journalNode.querySelector('.node-toggle');
        if (toggle) {
          toggle.click();
          expect(journalNode.getAttribute('aria-expanded')).toBe('true');
        }
      }

      // User workflow: Export section as markdown
      if (instance.exportMarkdown) {
        const markdown = instance.exportMarkdown({
          rootId: 'Daily Journal'
        });
        
        expect(markdown).toContain('# Daily Journal');
        expect(markdown).toContain('2024-01-16');
      }

      // User workflow: Add new note (if supported)
      if (instance.addNode) {
        const newNode = instance.addNode({
          parentId: 'Daily Journal',
          title: '2024-01-17',
          content: 'New journal entry'
        });
        
        expect(newNode).toBeDefined();
        
        // Verify it appears in the tree
        const addedNode = Array.from(container.querySelectorAll('[role="treeitem"]'))
          .find(node => node.textContent.includes('2024-01-17'));
        
        expect(addedNode).toBeTruthy();
      }
    });
  });

  describe('Data Exploration Workflow', () => {
    test('should support data structure exploration pattern', async () => {
      instance = TreeScribe.create({
        dom: container,
        renderers: {
          json: 'auto' // Auto-load JSON renderer
        }
      });

      // Load a data structure
      const dataYaml = `
        title: Application Config
        content:
          type: object
          description: Main configuration object
        children:
          - title: database
            content:
              host: localhost
              port: 5432
              name: myapp_db
              credentials:
                user: dbuser
                password: "**hidden**"
            type: yaml
          - title: server
            content:
              port: 3000
              host: 0.0.0.0
              cors:
                enabled: true
                origins:
                  - http://localhost:3000
                  - https://myapp.com
            type: yaml
          - title: features
            content:
              authentication:
                enabled: true
                providers:
                  - local
                  - google
                  - github
              analytics:
                enabled: false
                service: null
            type: yaml
          - title: environment
            content: |
              NODE_ENV=production
              LOG_LEVEL=info
              DEBUG=false
            type: env
      `;

      await instance.loadYaml(dataYaml);

      // User workflow: Explore configuration structure
      const dbNode = Array.from(container.querySelectorAll('[role="treeitem"]'))
        .find(node => node.textContent.includes('database'));
      
      expect(dbNode).toBeTruthy();

      // User workflow: Search for specific config values
      if (instance.search) {
        const results = instance.search('localhost');
        expect(results.length).toBeGreaterThan(0);
        
        // Should find in multiple places
        expect(results.some(r => r.path && r.path.includes('database'))).toBe(true);
      }

      // User workflow: View data in different formats
      const yamlContent = container.querySelector('.yaml-content');
      if (yamlContent) {
        // YAML should be properly formatted
        expect(yamlContent.textContent).toContain('host:');
        expect(yamlContent.textContent).toContain('port:');
      }

      // User workflow: Copy configuration section
      if (instance.copyNode) {
        const copied = instance.copyNode('database');
        expect(copied).toContain('host: localhost');
        expect(copied).toContain('port: 5432');
      }

      // User workflow: Filter sensitive data
      if (instance.filter) {
        instance.filter(node => {
          // Hide nodes with sensitive data
          const content = JSON.stringify(node.content);
          return !content.includes('password') && !content.includes('credentials');
        });
        
        // Password node should be hidden
        const credNode = Array.from(container.querySelectorAll('[role="treeitem"]'))
          .find(node => node.textContent.includes('credentials'));
        
        if (credNode) {
          expect(credNode.classList.contains('filtered-out')).toBe(true);
        }
      }
    });
  });

  describe('Presentation Workflow', () => {
    test('should support presentation/outline pattern', async () => {
      instance = TreeScribe.create({
        dom: container,
        theme: 'light',
        presentation: true // If presentation mode is supported
      });

      // Load a presentation structure
      const presentationYaml = `
        title: Tech Talk: Modern JavaScript
        content: |
          # Modern JavaScript Development
          A comprehensive overview of modern JS ecosystem
        children:
          - title: 1. Introduction
            content: |
              ## Why Modern JavaScript?
              - Evolving standards (ES6+)
              - Better tooling
              - Enhanced developer experience
            children:
              - title: Historical Context
                content: |
                  - JavaScript created in 1995
                  - Major evolution with ES6 (2015)
                  - Annual releases since then
              - title: Current State
                content: |
                  - ES2023 features
                  - Wide browser support
                  - Rich ecosystem
          - title: 2. Key Features
            content: |
              ## Essential Modern Features
              Let's explore the most important additions
            children:
              - title: Arrow Functions
                content: |
                  \`\`\`javascript
                  // Traditional
                  function add(a, b) { return a + b; }
                  
                  // Arrow function
                  const add = (a, b) => a + b;
                  \`\`\`
              - title: Destructuring
                content: |
                  \`\`\`javascript
                  const { name, age } = person;
                  const [first, ...rest] = array;
                  \`\`\`
              - title: Async/Await
                content: |
                  \`\`\`javascript
                  async function fetchData() {
                    const response = await fetch(url);
                    return response.json();
                  }
                  \`\`\`
          - title: 3. Best Practices
            content: |
              ## Writing Better JavaScript
              Guidelines for maintainable code
            children:
              - title: Code Organization
                content: |
                  - Use modules
                  - Single responsibility
                  - Clear naming
              - title: Error Handling
                content: |
                  - Try/catch blocks
                  - Promise error handling
                  - Error boundaries
          - title: 4. Conclusion
            content: |
              ## Key Takeaways
              - Embrace modern features
              - Focus on readability
              - Keep learning!
      `;

      await instance.loadYaml(presentationYaml);

      // User workflow: Navigate presentation
      if (instance.startPresentation) {
        instance.startPresentation();
        
        // Should show first slide
        const activeSlide = container.querySelector('.active-slide');
        expect(activeSlide).toBeTruthy();
        expect(activeSlide.textContent).toContain('Modern JavaScript');
      }

      // User workflow: Expand outline to specific depth
      if (instance.expandToDepth) {
        instance.expandToDepth(1);
        
        // Only top-level items expanded
        const topLevel = container.querySelectorAll('[aria-level="1"]');
        topLevel.forEach(node => {
          if (node.querySelector('[role="group"]')) {
            expect(node.getAttribute('aria-expanded')).toBe('true');
          }
        });
        
        // Deeper levels collapsed
        const deeperLevel = container.querySelectorAll('[aria-level="3"]');
        deeperLevel.forEach(node => {
          if (node.querySelector('[role="group"]')) {
            expect(node.getAttribute('aria-expanded')).toBe('false');
          }
        });
      }

      // User workflow: Generate table of contents
      if (instance.generateTOC) {
        const toc = instance.generateTOC();
        
        expect(toc).toContain('1. Introduction');
        expect(toc).toContain('2. Key Features');
        expect(toc).toContain('3. Best Practices');
        expect(toc).toContain('4. Conclusion');
      }

      // User workflow: Export as slides (if supported)
      if (instance.exportSlides) {
        const slides = instance.exportSlides();
        
        expect(slides.length).toBeGreaterThan(0);
        expect(slides[0].title).toContain('Modern JavaScript');
      }

      // User workflow: Print-friendly view
      if (instance.setPrintView) {
        instance.setPrintView(true);
        
        // All content should be expanded for printing
        const allNodes = container.querySelectorAll('[role="treeitem"]');
        allNodes.forEach(node => {
          if (node.querySelector('[role="group"]')) {
            expect(node.getAttribute('aria-expanded')).toBe('true');
          }
        });
      }
    });
  });
});