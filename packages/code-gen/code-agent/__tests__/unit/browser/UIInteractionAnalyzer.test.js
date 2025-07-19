/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { UIInteractionAnalyzer } from '../../../src/browser/UIInteractionAnalyzer.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('UIInteractionAnalyzer', () => {
  let analyzer;
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
    testProjectPath = path.join(__dirname, 'temp-ui-interaction-project');
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
    analyzer = new UIInteractionAnalyzer(mockConfig);
  });

  afterEach(async () => {
    if (analyzer) {
      await analyzer.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(analyzer.config).toBeDefined();
      expect(analyzer.isInitialized).toBe(false);
      expect(analyzer.analyzedComponents).toBeInstanceOf(Map);
    });

    test('should initialize successfully', async () => {
      await analyzer.initialize();
      
      expect(analyzer.isInitialized).toBe(true);
      expect(analyzer.logManager).toBeDefined();
    });

    test('should prevent double initialization', async () => {
      await analyzer.initialize();
      
      await expect(analyzer.initialize()).resolves.not.toThrow();
      expect(analyzer.isInitialized).toBe(true);
    });
  });

  describe('Click Interaction Detection', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    test('should detect button click interactions', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Button.jsx');
      const interactions = await analyzer.detectClickInteractions(componentPath);
      
      expect(interactions).toBeDefined();
      expect(Array.isArray(interactions)).toBe(true);
      expect(interactions.length).toBeGreaterThan(0);
      
      const clickInteraction = interactions.find(i => i.type === 'click');
      expect(clickInteraction).toBeDefined();
      expect(clickInteraction.element).toBeDefined();
      expect(clickInteraction.handler).toBeDefined();
    });

    test('should detect link click interactions', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Navigation.jsx');
      const interactions = await analyzer.detectClickInteractions(componentPath);
      
      expect(interactions).toBeDefined();
      expect(interactions.some(i => i.element === 'a')).toBe(true);
    });

    test('should detect custom element click handlers', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Card.jsx');
      const interactions = await analyzer.detectClickInteractions(componentPath);
      
      expect(interactions).toBeDefined();
      expect(interactions.some(i => i.element === 'div' && i.handler)).toBe(true);
    });
  });

  describe('Form Interaction Detection', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    test('should detect input field interactions', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Form.jsx');
      const interactions = await analyzer.detectFormInteractions(componentPath);
      
      expect(interactions).toBeDefined();
      expect(Array.isArray(interactions)).toBe(true);
      
      const inputInteraction = interactions.find(i => i.type === 'input');
      expect(inputInteraction).toBeDefined();
      expect(inputInteraction.element).toBe('input');
      expect(inputInteraction.inputType).toBeDefined();
    });

    test('should detect select dropdown interactions', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Form.jsx');
      const interactions = await analyzer.detectFormInteractions(componentPath);
      
      const selectInteraction = interactions.find(i => i.element === 'select');
      expect(selectInteraction).toBeDefined();
      expect(selectInteraction.type).toBe('change');
    });

    test('should detect textarea interactions', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Form.jsx');
      const interactions = await analyzer.detectFormInteractions(componentPath);
      
      const textareaInteraction = interactions.find(i => i.element === 'textarea');
      expect(textareaInteraction).toBeDefined();
    });

    test('should detect form submission', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Form.jsx');
      const interactions = await analyzer.detectFormInteractions(componentPath);
      
      const submitInteraction = interactions.find(i => i.type === 'submit');
      expect(submitInteraction).toBeDefined();
      expect(submitInteraction.element).toBe('form');
    });
  });

  describe('Hover and Focus Interactions', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    test('should detect hover interactions', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Tooltip.jsx');
      const interactions = await analyzer.detectHoverInteractions(componentPath);
      
      expect(interactions).toBeDefined();
      expect(interactions.some(i => i.type === 'hover')).toBe(true);
    });

    test('should detect focus interactions', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Form.jsx');
      const interactions = await analyzer.detectFocusInteractions(componentPath);
      
      expect(interactions).toBeDefined();
      expect(interactions.some(i => i.type === 'focus')).toBe(true);
    });

    test('should detect blur interactions', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Form.jsx');
      const interactions = await analyzer.detectFocusInteractions(componentPath);
      
      expect(interactions.some(i => i.type === 'blur')).toBe(true);
    });
  });

  describe('Keyboard Interactions', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    test('should detect keyboard event handlers', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'SearchBox.jsx');
      const interactions = await analyzer.detectKeyboardInteractions(componentPath);
      
      expect(interactions).toBeDefined();
      expect(interactions.some(i => i.type === 'keydown')).toBe(true);
    });

    test('should detect enter key handling', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'SearchBox.jsx');
      const interactions = await analyzer.detectKeyboardInteractions(componentPath);
      
      const enterHandler = interactions.find(i => i.key === 'Enter');
      expect(enterHandler).toBeDefined();
    });

    test('should detect escape key handling', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Modal.jsx');
      const interactions = await analyzer.detectKeyboardInteractions(componentPath);
      
      const escHandler = interactions.find(i => i.key === 'Escape');
      expect(escHandler).toBeDefined();
    });
  });

  describe('Drag and Drop Interactions', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    test('should detect drag interactions', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'DragList.jsx');
      const interactions = await analyzer.detectDragDropInteractions(componentPath);
      
      expect(interactions).toBeDefined();
      expect(interactions.some(i => i.type === 'dragstart')).toBe(true);
    });

    test('should detect drop interactions', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'DropZone.jsx');
      const interactions = await analyzer.detectDragDropInteractions(componentPath);
      
      expect(interactions.some(i => i.type === 'drop')).toBe(true);
    });
  });

  describe('Custom Event Detection', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    test('should detect custom event emissions', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'CustomEvents.jsx');
      const interactions = await analyzer.detectCustomEvents(componentPath);
      
      expect(interactions).toBeDefined();
      expect(interactions.some(i => i.type === 'custom')).toBe(true);
    });

    test('should detect event propagation', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'EventBubbling.jsx');
      const interactions = await analyzer.detectEventPropagation(componentPath);
      
      expect(interactions).toBeDefined();
      expect(interactions.some(i => i.propagation === 'bubble')).toBe(true);
    });
  });

  describe('Interaction Test Generation', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    test('should generate click interaction tests', async () => {
      const interactions = [{
        type: 'click',
        element: 'button',
        handler: 'handleClick',
        selector: 'button.primary'
      }];

      const tests = await analyzer.generateInteractionTests(interactions, 'react');
      
      expect(tests).toBeDefined();
      expect(Array.isArray(tests)).toBe(true);
      expect(tests.length).toBeGreaterThan(0);
      
      const test = tests[0];
      expect(test.name).toContain('click');
      expect(test.code).toContain('fireEvent.click');
    });

    test('should generate form interaction tests', async () => {
      const interactions = [{
        type: 'input',
        element: 'input',
        inputType: 'text',
        name: 'username'
      }];

      const tests = await analyzer.generateInteractionTests(interactions, 'react');
      
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].code).toContain('userEvent.type');
    });

    test('should generate keyboard interaction tests', async () => {
      const interactions = [{
        type: 'keydown',
        key: 'Enter',
        element: 'input',
        handler: 'handleEnter'
      }];

      const tests = await analyzer.generateInteractionTests(interactions, 'react');
      
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].code).toContain('Enter');
    });
  });

  describe('Interaction Complexity Analysis', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    test('should analyze interaction complexity', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ComplexForm.jsx');
      const complexity = await analyzer.analyzeInteractionComplexity(componentPath);
      
      expect(complexity).toBeDefined();
      expect(complexity.score).toBeDefined();
      expect(complexity.level).toBeDefined();
      expect(complexity.recommendations).toBeDefined();
    });

    test('should identify interaction dependencies', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'DependentInputs.jsx');
      const dependencies = await analyzer.identifyInteractionDependencies(componentPath);
      
      expect(dependencies).toBeDefined();
      expect(Array.isArray(dependencies)).toBe(true);
    });
  });

  describe('Test Prioritization', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    test('should prioritize critical interactions', async () => {
      const interactions = [
        { type: 'click', element: 'button', critical: true },
        { type: 'hover', element: 'div', critical: false },
        { type: 'submit', element: 'form', critical: true }
      ];

      const prioritized = await analyzer.prioritizeInteractions(interactions);
      
      expect(prioritized[0].critical).toBe(true);
      expect(prioritized[prioritized.length - 1].critical).toBe(false);
    });

    test('should generate test execution order', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ComplexForm.jsx');
      const order = await analyzer.generateTestExecutionOrder(componentPath);
      
      expect(order).toBeDefined();
      expect(Array.isArray(order)).toBe(true);
      expect(order.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    test('should handle missing component files', async () => {
      const nonExistentPath = path.join(testProjectPath, 'src', 'components', 'NonExistent.jsx');
      const interactions = await analyzer.detectClickInteractions(nonExistentPath);
      
      expect(interactions).toEqual([]);
    });

    test('should handle malformed components', async () => {
      const malformedPath = path.join(testProjectPath, 'src', 'components', 'Malformed.jsx');
      const interactions = await analyzer.detectClickInteractions(malformedPath);
      
      expect(interactions).toEqual([]);
    });

    test('should handle components without interactions', async () => {
      const staticPath = path.join(testProjectPath, 'src', 'components', 'Static.jsx');
      const interactions = await analyzer.detectAllInteractions(staticPath);
      
      expect(interactions).toEqual([]);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await analyzer.initialize();
      
      // Analyze some components
      const componentPath = path.join(testProjectPath, 'src', 'components', 'Button.jsx');
      await analyzer.detectClickInteractions(componentPath);
      
      expect(analyzer.analyzedComponents.size).toBeGreaterThan(0);
      
      await analyzer.cleanup();
      
      expect(analyzer.analyzedComponents.size).toBe(0);
      expect(analyzer.isInitialized).toBe(false);
    });
  });
});

// Helper function to create test project with various components
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src', 'components'), { recursive: true });
  
  // Create Button component with click interactions
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Button.jsx'),
    `
import React from 'react';

const Button = ({ onClick, variant = 'primary', children }) => {
  const handleClick = (e) => {
    console.log('Button clicked');
    onClick?.(e);
  };

  return (
    <button 
      className={\`btn btn-\${variant}\`}
      onClick={handleClick}
      onMouseEnter={() => console.log('hover')}
    >
      {children}
    </button>
  );
};

export default Button;
`
  );
  
  // Create Navigation component with links
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Navigation.jsx'),
    `
import React from 'react';

const Navigation = () => {
  return (
    <nav>
      <a href="/" onClick={(e) => { e.preventDefault(); }}>Home</a>
      <a href="/about" onClick={(e) => { e.preventDefault(); }}>About</a>
      <a href="/contact" onClick={(e) => { e.preventDefault(); }}>Contact</a>
    </nav>
  );
};

export default Navigation;
`
  );
  
  // Create Card component with custom click handler
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Card.jsx'),
    `
import React from 'react';

const Card = ({ title, content, onClick }) => {
  return (
    <div className="card" onClick={onClick}>
      <h3>{title}</h3>
      <p>{content}</p>
    </div>
  );
};

export default Card;
`
  );
  
  // Create Form component with various form elements
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Form.jsx'),
    `
import React, { useState } from 'react';

const Form = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    category: '',
    message: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        name="username"
        value={formData.username}
        onChange={handleInputChange}
        onFocus={() => console.log('focus')}
        onBlur={() => console.log('blur')}
      />
      
      <input
        type="email"
        name="email"
        value={formData.email}
        onChange={handleInputChange}
      />
      
      <select name="category" value={formData.category} onChange={handleInputChange}>
        <option value="">Select...</option>
        <option value="general">General</option>
        <option value="support">Support</option>
      </select>
      
      <textarea
        name="message"
        value={formData.message}
        onChange={handleInputChange}
      />
      
      <button type="submit">Submit</button>
    </form>
  );
};

export default Form;
`
  );
  
  // Create Tooltip component with hover interactions
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Tooltip.jsx'),
    `
import React, { useState } from 'react';

const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);

  return (
    <div 
      className="tooltip-wrapper"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && <div className="tooltip">{text}</div>}
    </div>
  );
};

export default Tooltip;
`
  );
  
  // Create SearchBox with keyboard interactions
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'SearchBox.jsx'),
    `
import React, { useState } from 'react';

const SearchBox = ({ onSearch }) => {
  const [query, setQuery] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSearch(query);
    }
  };

  return (
    <input
      type="search"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Search..."
    />
  );
};

export default SearchBox;
`
  );
  
  // Create Modal with escape key handling
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Modal.jsx'),
    `
import React, { useEffect } from 'react';

const Modal = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

export default Modal;
`
  );
  
  // Create DragList with drag interactions
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'DragList.jsx'),
    `
import React from 'react';

const DragList = ({ items, onReorder }) => {
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('index', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    const dragIndex = parseInt(e.dataTransfer.getData('index'));
    onReorder(dragIndex, dropIndex);
  };

  return (
    <ul>
      {items.map((item, index) => (
        <li
          key={item.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
        >
          {item.text}
        </li>
      ))}
    </ul>
  );
};

export default DragList;
`
  );
  
  // Create DropZone with drop interactions
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'DropZone.jsx'),
    `
import React, { useState } from 'react';

const DropZone = ({ onDrop }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    onDrop(files);
  };

  return (
    <div 
      className={\`drop-zone \${isDragOver ? 'drag-over' : ''}\`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      Drop files here
    </div>
  );
};

export default DropZone;
`
  );
  
  // Create CustomEvents component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'CustomEvents.jsx'),
    `
import React, { useRef } from 'react';

const CustomEvents = () => {
  const ref = useRef();

  const emitCustomEvent = () => {
    const event = new CustomEvent('customAction', {
      detail: { message: 'Custom event fired' }
    });
    ref.current.dispatchEvent(event);
  };

  return (
    <div ref={ref}>
      <button onClick={emitCustomEvent}>Emit Custom Event</button>
    </div>
  );
};

export default CustomEvents;
`
  );
  
  // Create EventBubbling component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'EventBubbling.jsx'),
    `
import React from 'react';

const EventBubbling = () => {
  const handleParentClick = () => {
    console.log('Parent clicked');
  };

  const handleChildClick = (e) => {
    console.log('Child clicked');
    // e.stopPropagation();
  };

  return (
    <div onClick={handleParentClick}>
      <button onClick={handleChildClick}>
        Click me (bubbles)
      </button>
    </div>
  );
};

export default EventBubbling;
`
  );
  
  // Create ComplexForm with multiple interactions
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'ComplexForm.jsx'),
    `
import React, { useState } from 'react';

const ComplexForm = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false
  });

  const [errors, setErrors] = useState({});

  const validateField = (name, value) => {
    // Complex validation logic
    return null;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({ ...prev, [name]: val }));
    
    const error = validateField(name, val);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Submit logic
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="firstName"
        value={formData.firstName}
        onChange={handleChange}
        onBlur={(e) => validateField('firstName', e.target.value)}
      />
      
      <input
        name="lastName"
        value={formData.lastName}
        onChange={handleChange}
      />
      
      <input
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
      />
      
      <input
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
      />
      
      <input
        type="password"
        name="confirmPassword"
        value={formData.confirmPassword}
        onChange={handleChange}
      />
      
      <label>
        <input
          type="checkbox"
          name="agreeTerms"
          checked={formData.agreeTerms}
          onChange={handleChange}
        />
        I agree to terms
      </label>
      
      <button type="submit">Submit</button>
    </form>
  );
};

export default ComplexForm;
`
  );
  
  // Create DependentInputs component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'DependentInputs.jsx'),
    `
import React, { useState } from 'react';

const DependentInputs = () => {
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');

  const handleCountryChange = (e) => {
    setCountry(e.target.value);
    setState(''); // Reset dependent field
    setCity('');
  };

  const handleStateChange = (e) => {
    setState(e.target.value);
    setCity(''); // Reset dependent field
  };

  return (
    <div>
      <select value={country} onChange={handleCountryChange}>
        <option value="">Select Country</option>
        <option value="us">United States</option>
        <option value="ca">Canada</option>
      </select>
      
      <select value={state} onChange={handleStateChange} disabled={!country}>
        <option value="">Select State</option>
        {country === 'us' && (
          <>
            <option value="ca">California</option>
            <option value="ny">New York</option>
          </>
        )}
      </select>
      
      <select value={city} onChange={(e) => setCity(e.target.value)} disabled={!state}>
        <option value="">Select City</option>
        {state === 'ca' && (
          <>
            <option value="sf">San Francisco</option>
            <option value="la">Los Angeles</option>
          </>
        )}
      </select>
    </div>
  );
};

export default DependentInputs;
`
  );
  
  // Create Static component without interactions
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'Static.jsx'),
    `
import React from 'react';

const Static = () => {
  return (
    <div>
      <h1>Static Content</h1>
      <p>This component has no interactions.</p>
    </div>
  );
};

export default Static;
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