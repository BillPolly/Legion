/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { AccessibilityTester } from '../../../src/browser/AccessibilityTester.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AccessibilityTester', () => {
  let accessibilityTester;
  let mockConfig;
  let testProjectPath;

  beforeAll(async () => {
    mockConfig = new RuntimeConfig({
      nodeRunner: {
        timeout: 30000,
        maxConcurrentProcesses: 3,
        healthCheckInterval: 1000,
        shutdownTimeout: 5000
      },
      logManager: {
        logLevel: 'info',
        enableStreaming: true,
        captureStdout: true,
        captureStderr: true
      }
    });

    // Create a temporary test project
    testProjectPath = path.join(__dirname, 'temp-accessibility-project');
    await createTestProject(testProjectPath);
  });

  afterAll(async () => {
    // Clean up test project
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    accessibilityTester = new AccessibilityTester(mockConfig);
  });

  afterEach(async () => {
    if (accessibilityTester) {
      await accessibilityTester.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(accessibilityTester.config).toBeDefined();
      expect(accessibilityTester.isInitialized).toBe(false);
      expect(accessibilityTester.testedComponents).toBeInstanceOf(Map);
    });

    test('should initialize successfully', async () => {
      await accessibilityTester.initialize();
      
      expect(accessibilityTester.isInitialized).toBe(true);
      expect(accessibilityTester.logManager).toBeDefined();
    });

    test('should prevent double initialization', async () => {
      await accessibilityTester.initialize();
      
      await expect(accessibilityTester.initialize()).resolves.not.toThrow();
      expect(accessibilityTester.isInitialized).toBe(true);
    });
  });

  describe('ARIA Attribute Analysis', () => {
    beforeEach(async () => {
      await accessibilityTester.initialize();
    });

    test('should detect ARIA labels', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Button.jsx');
      const ariaAnalysis = await accessibilityTester.analyzeAriaAttributes(componentPath);
      
      expect(ariaAnalysis).toBeDefined();
      expect(ariaAnalysis.labels).toBeDefined();
      expect(Array.isArray(ariaAnalysis.labels)).toBe(true);
      expect(ariaAnalysis.labels.some(l => l.attribute === 'aria-label')).toBe(true);
    });

    test('should detect ARIA roles', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Navigation.jsx');
      const ariaAnalysis = await accessibilityTester.analyzeAriaAttributes(componentPath);
      
      expect(ariaAnalysis.roles).toBeDefined();
      expect(ariaAnalysis.roles.some(r => r.role === 'navigation')).toBe(true);
    });

    test('should detect ARIA descriptions', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Form.jsx');
      const ariaAnalysis = await accessibilityTester.analyzeAriaAttributes(componentPath);
      
      expect(ariaAnalysis.descriptions).toBeDefined();
      expect(ariaAnalysis.descriptions.some(d => d.attribute === 'aria-describedby')).toBe(true);
    });

    test('should detect ARIA states', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Toggle.jsx');
      const ariaAnalysis = await accessibilityTester.analyzeAriaAttributes(componentPath);
      
      expect(ariaAnalysis.states).toBeDefined();
      expect(ariaAnalysis.states.some(s => s.attribute === 'aria-checked')).toBe(true);
    });
  });

  describe('Keyboard Navigation Testing', () => {
    beforeEach(async () => {
      await accessibilityTester.initialize();
    });

    test('should detect tab order', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Form.jsx');
      const tabOrder = await accessibilityTester.analyzeTabOrder(componentPath);
      
      expect(tabOrder).toBeDefined();
      expect(Array.isArray(tabOrder.elements)).toBe(true);
      expect(tabOrder.elements.length).toBeGreaterThan(0);
      expect(tabOrder.hasProperOrder).toBeDefined();
    });

    test('should detect keyboard shortcuts', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'KeyboardShortcuts.jsx');
      const shortcuts = await accessibilityTester.detectKeyboardShortcuts(componentPath);
      
      expect(shortcuts).toBeDefined();
      expect(Array.isArray(shortcuts)).toBe(true);
      expect(shortcuts.some(s => s.key && s.action)).toBe(true);
    });

    test('should detect focus traps', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Modal.jsx');
      const focusTrap = await accessibilityTester.detectFocusTrap(componentPath);
      
      expect(focusTrap).toBeDefined();
      expect(focusTrap.hasFocusTrap).toBeDefined();
      expect(focusTrap.elements).toBeDefined();
    });
  });

  describe('Color Contrast Analysis', () => {
    beforeEach(async () => {
      await accessibilityTester.initialize();
    });

    test('should analyze text color contrast', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'TextContent.jsx');
      const contrast = await accessibilityTester.analyzeColorContrast(componentPath);
      
      expect(contrast).toBeDefined();
      expect(contrast.issues).toBeDefined();
      expect(Array.isArray(contrast.issues)).toBe(true);
      expect(contrast.wcagLevel).toBeDefined();
    });

    test('should detect low contrast issues', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'LowContrast.jsx');
      const contrast = await accessibilityTester.analyzeColorContrast(componentPath);
      
      expect(contrast.issues.length).toBeGreaterThan(0);
      expect(contrast.issues[0].ratio).toBeDefined();
      expect(contrast.issues[0].recommendation).toBeDefined();
    });
  });

  describe('Screen Reader Compatibility', () => {
    beforeEach(async () => {
      await accessibilityTester.initialize();
    });

    test('should analyze screen reader compatibility', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Article.jsx');
      const compatibility = await accessibilityTester.analyzeScreenReaderCompatibility(componentPath);
      
      expect(compatibility).toBeDefined();
      expect(compatibility.score).toBeDefined();
      expect(compatibility.issues).toBeDefined();
      expect(compatibility.recommendations).toBeDefined();
    });

    test('should detect missing alt text', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Gallery.jsx');
      const compatibility = await accessibilityTester.analyzeScreenReaderCompatibility(componentPath);
      
      expect(compatibility.issues.some(i => i.type === 'missing-alt-text')).toBe(true);
    });

    test('should detect heading structure', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Article.jsx');
      const headings = await accessibilityTester.analyzeHeadingStructure(componentPath);
      
      expect(headings).toBeDefined();
      expect(headings.hierarchy).toBeDefined();
      expect(headings.issues).toBeDefined();
    });
  });

  describe('Form Accessibility', () => {
    beforeEach(async () => {
      await accessibilityTester.initialize();
    });

    test('should detect form labels', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Form.jsx');
      const formAnalysis = await accessibilityTester.analyzeFormAccessibility(componentPath);
      
      expect(formAnalysis).toBeDefined();
      expect(formAnalysis.labels).toBeDefined();
      expect(formAnalysis.labels.associated).toBeGreaterThan(0);
    });

    test('should detect error messages', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'FormWithErrors.jsx');
      const formAnalysis = await accessibilityTester.analyzeFormAccessibility(componentPath);
      
      expect(formAnalysis.errorHandling).toBeDefined();
      expect(formAnalysis.errorHandling.hasAriaLive).toBeDefined();
    });

    test('should detect fieldset grouping', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'RadioGroup.jsx');
      const formAnalysis = await accessibilityTester.analyzeFormAccessibility(componentPath);
      
      expect(formAnalysis.fieldsets).toBeDefined();
      expect(formAnalysis.fieldsets.length).toBeGreaterThan(0);
    });
  });

  describe('WCAG Compliance Testing', () => {
    beforeEach(async () => {
      await accessibilityTester.initialize();
    });

    test('should run WCAG 2.1 Level A tests', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Button.jsx');
      const compliance = await accessibilityTester.testWCAGCompliance(componentPath, 'A');
      
      expect(compliance).toBeDefined();
      expect(compliance.level).toBe('A');
      expect(compliance.passed).toBeDefined();
      expect(compliance.violations).toBeDefined();
    });

    test('should run WCAG 2.1 Level AA tests', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Form.jsx');
      const compliance = await accessibilityTester.testWCAGCompliance(componentPath, 'AA');
      
      expect(compliance.level).toBe('AA');
      expect(compliance.guidelines).toBeDefined();
    });

    test('should run WCAG 2.1 Level AAA tests', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Article.jsx');
      const compliance = await accessibilityTester.testWCAGCompliance(componentPath, 'AAA');
      
      expect(compliance.level).toBe('AAA');
      expect(compliance.recommendations).toBeDefined();
    });
  });

  describe('Accessibility Test Generation', () => {
    beforeEach(async () => {
      await accessibilityTester.initialize();
    });

    test('should generate accessibility tests', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Button.jsx');
      const tests = await accessibilityTester.generateAccessibilityTests(componentPath, 'react');
      
      expect(tests).toBeDefined();
      expect(Array.isArray(tests)).toBe(true);
      expect(tests.length).toBeGreaterThan(0);
      
      const test = tests[0];
      expect(test.name).toBeDefined();
      expect(test.code).toBeDefined();
      expect(test.type).toBe('accessibility');
    });

    test('should generate axe-core integration tests', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Form.jsx');
      const tests = await accessibilityTester.generateAxeTests(componentPath, 'react');
      
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].code).toContain('axe');
    });

    test('should generate keyboard navigation tests', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Navigation.jsx');
      const tests = await accessibilityTester.generateKeyboardTests(componentPath, 'react');
      
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].code).toContain('Tab');
    });
  });

  describe('Accessibility Report Generation', () => {
    beforeEach(async () => {
      await accessibilityTester.initialize();
    });

    test('should generate comprehensive accessibility report', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ComplexForm.jsx');
      const report = await accessibilityTester.generateAccessibilityReport(componentPath);
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.issues).toBeDefined();
      expect(report.score).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    test('should generate HTML report', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Button.jsx');
      const htmlReport = await accessibilityTester.generateHTMLReport(componentPath);
      
      expect(htmlReport).toBeDefined();
      expect(htmlReport).toContain('<html');
      expect(htmlReport).toContain('Accessibility Report');
    });

    test('should generate JSON report', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Form.jsx');
      const jsonReport = await accessibilityTester.generateJSONReport(componentPath);
      
      expect(jsonReport).toBeDefined();
      const parsed = JSON.parse(jsonReport);
      expect(parsed.component).toBeDefined();
      expect(parsed.results).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await accessibilityTester.initialize();
    });

    test('should handle missing component files', async () => {
      const nonExistentPath = path.join(testProjectPath, 'src', 'components', 'NonExistent.jsx');
      const analysis = await accessibilityTester.analyzeAriaAttributes(nonExistentPath);
      
      expect(analysis).toEqual({
        labels: [],
        roles: [],
        descriptions: [],
        states: []
      });
    });

    test('should handle malformed components', async () => {
      const malformedPath = path.join(testProjectPath, 'src', 'components', 'Malformed.jsx');
      const analysis = await accessibilityTester.analyzeAriaAttributes(malformedPath);
      
      expect(analysis).toBeDefined();
      expect(analysis.labels).toEqual([]);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await accessibilityTester.initialize();
      
      // Analyze a component
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Button.jsx');
      await accessibilityTester.analyzeAriaAttributes(componentPath);
      
      expect(accessibilityTester.testedComponents.size).toBeGreaterThan(0);
      
      await accessibilityTester.cleanup();
      
      expect(accessibilityTester.testedComponents.size).toBe(0);
      expect(accessibilityTester.isInitialized).toBe(false);
    });
  });
});

// Helper function to create test project with various components
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src', 'components'), { recursive: true });
  
  // Create Button with ARIA attributes
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Button.jsx'),
    `
import React from 'react';

const Button = ({ onClick, disabled, children }) => {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      aria-label="Click to submit"
      aria-pressed={false}
      role="button"
    >
      {children}
    </button>
  );
};

export default Button;
`
  );
  
  // Create Navigation with role
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Navigation.jsx'),
    `
import React from 'react';

const Navigation = () => {
  return (
    <nav role="navigation" aria-label="Main navigation">
      <ul>
        <li><a href="/" aria-label="Go to home page">Home</a></li>
        <li><a href="/about" aria-label="Go to about page">About</a></li>
        <li><a href="/contact" aria-label="Go to contact page">Contact</a></li>
      </ul>
    </nav>
  );
};

export default Navigation;
`
  );
  
  // Create Form with proper labels
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Form.jsx'),
    `
import React, { useState } from 'react';

const Form = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form aria-label="Login form">
      <div>
        <label htmlFor="email">Email Address</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-required="true"
          aria-describedby="email-error"
        />
        <span id="email-error" role="alert" aria-live="polite"></span>
      </div>
      
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-required="true"
          aria-describedby="password-help"
        />
        <span id="password-help">Must be at least 8 characters</span>
      </div>
      
      <button type="submit" aria-label="Submit login form">Login</button>
    </form>
  );
};

export default Form;
`
  );
  
  // Create Toggle with ARIA states
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Toggle.jsx'),
    `
import React, { useState } from 'react';

const Toggle = ({ label }) => {
  const [checked, setChecked] = useState(false);

  return (
    <div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => setChecked(!checked)}
      >
        <span aria-hidden="true">{checked ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  );
};

export default Toggle;
`
  );
  
  // Create KeyboardShortcuts component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'KeyboardShortcuts.jsx'),
    `
import React, { useEffect } from 'react';

const KeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        console.log('Save shortcut');
      }
      if (e.key === 'Escape') {
        console.log('Escape pressed');
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div>
      <h2>Keyboard Shortcuts</h2>
      <ul role="list">
        <li>Ctrl+S: Save</li>
        <li>Escape: Close</li>
      </ul>
    </div>
  );
};

export default KeyboardShortcuts;
`
  );
  
  // Create Modal with focus trap
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Modal.jsx'),
    `
import React, { useEffect, useRef } from 'react';

const Modal = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef();
  const closeButtonRef = useRef();

  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      ref={modalRef}
    >
      <h2 id="modal-title">{title}</h2>
      {children}
      <button 
        ref={closeButtonRef}
        onClick={onClose}
        aria-label="Close modal"
      >
        Close
      </button>
    </div>
  );
};

export default Modal;
`
  );
  
  // Create TextContent with color contrast
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'TextContent.jsx'),
    `
import React from 'react';

const TextContent = () => {
  return (
    <article>
      <h1 style={{ color: '#333', backgroundColor: '#fff' }}>
        High Contrast Heading
      </h1>
      <p style={{ color: '#666', backgroundColor: '#fff' }}>
        Regular contrast paragraph text
      </p>
    </article>
  );
};

export default TextContent;
`
  );
  
  // Create LowContrast component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'LowContrast.jsx'),
    `
import React from 'react';

const LowContrast = () => {
  return (
    <div>
      <p style={{ color: '#e0e0e0', backgroundColor: '#f0f0f0' }}>
        This text has low contrast
      </p>
      <button style={{ color: '#999', backgroundColor: '#ccc' }}>
        Low Contrast Button
      </button>
    </div>
  );
};

export default LowContrast;
`
  );
  
  // Create Article with heading structure
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Article.jsx'),
    `
import React from 'react';

const Article = () => {
  return (
    <article role="article">
      <h1>Main Article Title</h1>
      <section>
        <h2>Introduction</h2>
        <p>This is the introduction paragraph.</p>
      </section>
      <section>
        <h2>Main Content</h2>
        <h3>Subsection 1</h3>
        <p>Content for subsection 1</p>
        <h3>Subsection 2</h3>
        <p>Content for subsection 2</p>
      </section>
      <section>
        <h2>Conclusion</h2>
        <p>This is the conclusion.</p>
      </section>
    </article>
  );
};

export default Article;
`
  );
  
  // Create Gallery with images
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Gallery.jsx'),
    `
import React from 'react';

const Gallery = () => {
  return (
    <div role="region" aria-label="Image gallery">
      <h2>Photo Gallery</h2>
      <div>
        <img src="photo1.jpg" alt="Beautiful sunset over mountains" />
        <img src="photo2.jpg" alt="Ocean waves at beach" />
        <img src="photo3.jpg" /> {/* Missing alt text */}
      </div>
    </div>
  );
};

export default Gallery;
`
  );
  
  // Create FormWithErrors
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'FormWithErrors.jsx'),
    `
import React, { useState } from 'react';

const FormWithErrors = () => {
  const [errors, setErrors] = useState({});

  return (
    <form>
      <div>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          aria-invalid={!!errors.username}
          aria-describedby="username-error"
        />
        {errors.username && (
          <div id="username-error" role="alert" aria-live="assertive">
            {errors.username}
          </div>
        )}
      </div>
      <button type="submit">Submit</button>
    </form>
  );
};

export default FormWithErrors;
`
  );
  
  // Create RadioGroup with fieldset
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'RadioGroup.jsx'),
    `
import React, { useState } from 'react';

const RadioGroup = () => {
  const [selected, setSelected] = useState('');

  return (
    <fieldset>
      <legend>Choose your preferred contact method</legend>
      <div>
        <input
          type="radio"
          id="email-option"
          name="contact"
          value="email"
          checked={selected === 'email'}
          onChange={(e) => setSelected(e.target.value)}
        />
        <label htmlFor="email-option">Email</label>
      </div>
      <div>
        <input
          type="radio"
          id="phone-option"
          name="contact"
          value="phone"
          checked={selected === 'phone'}
          onChange={(e) => setSelected(e.target.value)}
        />
        <label htmlFor="phone-option">Phone</label>
      </div>
    </fieldset>
  );
};

export default RadioGroup;
`
  );
  
  // Create ComplexForm for comprehensive testing
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'ComplexForm.jsx'),
    `
import React, { useState } from 'react';

const ComplexForm = () => {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  return (
    <form role="form" aria-label="User registration form">
      <h1>Registration Form</h1>
      
      <fieldset>
        <legend>Personal Information</legend>
        
        <div>
          <label htmlFor="firstName">
            First Name <span aria-label="required">*</span>
          </label>
          <input
            id="firstName"
            required
            aria-required="true"
            aria-invalid={!!errors.firstName}
          />
        </div>
        
        <div>
          <label htmlFor="lastName">
            Last Name <span aria-label="required">*</span>
          </label>
          <input
            id="lastName"
            required
            aria-required="true"
          />
        </div>
      </fieldset>
      
      <fieldset>
        <legend>Account Settings</legend>
        
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            aria-describedby="email-hint"
          />
          <span id="email-hint">We'll never share your email</span>
        </div>
      </fieldset>
      
      <button type="submit" aria-label="Submit registration form">
        Register
      </button>
    </form>
  );
};

export default ComplexForm;
`
  );
  
  // Create malformed component for error testing
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Malformed.jsx'),
    `
import React from 'react';

const Malformed = () => {
  return (
    <div>
      <h2>Malformed Component</h2>
      // This component has syntax errors
      <p>Missing closing tag
      <button onClick={handleClick}>Click me</button>
      // Missing function definition
    </div>
  );
};

export default Malformed;
`
  );
}