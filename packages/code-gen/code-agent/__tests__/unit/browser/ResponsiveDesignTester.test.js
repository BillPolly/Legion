/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { ResponsiveDesignTester } from '../../../src/browser/ResponsiveDesignTester.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ResponsiveDesignTester', () => {
  let responsiveTester;
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
    testProjectPath = path.join(__dirname, 'temp-responsive-project');
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
    responsiveTester = new ResponsiveDesignTester(mockConfig);
  });

  afterEach(async () => {
    if (responsiveTester) {
      await responsiveTester.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(responsiveTester.config).toBeDefined();
      expect(responsiveTester.isInitialized).toBe(false);
      expect(responsiveTester.testedLayouts).toBeInstanceOf(Map);
    });

    test('should initialize successfully', async () => {
      await responsiveTester.initialize();
      
      expect(responsiveTester.isInitialized).toBe(true);
      expect(responsiveTester.logManager).toBeDefined();
    });

    test('should prevent double initialization', async () => {
      await responsiveTester.initialize();
      
      await expect(responsiveTester.initialize()).resolves.not.toThrow();
      expect(responsiveTester.isInitialized).toBe(true);
    });
  });

  describe('Viewport Testing', () => {
    beforeEach(async () => {
      await responsiveTester.initialize();
    });

    test('should test mobile viewport', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveCard.jsx');
      const result = await responsiveTester.testViewport(componentPath, 'mobile');
      
      expect(result).toBeDefined();
      expect(result.viewport).toBe('mobile');
      expect(result.width).toBe(375);
      expect(result.height).toBe(667);
      expect(result.issues).toBeDefined();
    });

    test('should test tablet viewport', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveCard.jsx');
      const result = await responsiveTester.testViewport(componentPath, 'tablet');
      
      expect(result.viewport).toBe('tablet');
      expect(result.width).toBe(768);
      expect(result.height).toBe(1024);
    });

    test('should test desktop viewport', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveCard.jsx');
      const result = await responsiveTester.testViewport(componentPath, 'desktop');
      
      expect(result.viewport).toBe('desktop');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    test('should test custom viewport', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveCard.jsx');
      const customViewport = { width: 1366, height: 768 };
      const result = await responsiveTester.testViewport(componentPath, 'custom', customViewport);
      
      expect(result.viewport).toBe('custom');
      expect(result.width).toBe(1366);
      expect(result.height).toBe(768);
    });
  });

  describe('Breakpoint Analysis', () => {
    beforeEach(async () => {
      await responsiveTester.initialize();
    });

    test('should detect CSS breakpoints', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveGrid.jsx');
      const breakpoints = await responsiveTester.detectBreakpoints(componentPath);
      
      expect(breakpoints).toBeDefined();
      expect(Array.isArray(breakpoints)).toBe(true);
      expect(breakpoints.length).toBeGreaterThan(0);
      expect(breakpoints[0].value).toBeDefined();
      expect(breakpoints[0].unit).toBeDefined();
    });

    test('should analyze breakpoint consistency', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveLayout.jsx');
      const analysis = await responsiveTester.analyzeBreakpointConsistency(componentPath);
      
      expect(analysis).toBeDefined();
      expect(analysis.isConsistent).toBeDefined();
      expect(analysis.issues).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
    });

    test('should suggest optimal breakpoints', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveCard.jsx');
      const suggestions = await responsiveTester.suggestBreakpoints(componentPath);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Layout Testing', () => {
    beforeEach(async () => {
      await responsiveTester.initialize();
    });

    test('should detect layout overflow', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'OverflowContent.jsx');
      const issues = await responsiveTester.detectLayoutOverflow(componentPath);
      
      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
      if (issues.length > 0) {
        expect(issues[0].type).toBe('overflow');
        expect(issues[0].element).toBeDefined();
        expect(issues[0].viewport).toBeDefined();
      }
    });

    test('should detect text truncation', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'TextContent.jsx');
      const issues = await responsiveTester.detectTextTruncation(componentPath);
      
      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
    });

    test('should analyze grid layout', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveGrid.jsx');
      const analysis = await responsiveTester.analyzeGridLayout(componentPath);
      
      expect(analysis).toBeDefined();
      expect(analysis.columns).toBeDefined();
      expect(analysis.gaps).toBeDefined();
      expect(analysis.responsive).toBeDefined();
    });

    test('should analyze flexbox layout', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'FlexLayout.jsx');
      const analysis = await responsiveTester.analyzeFlexboxLayout(componentPath);
      
      expect(analysis).toBeDefined();
      expect(analysis.direction).toBeDefined();
      expect(analysis.wrap).toBeDefined();
      expect(analysis.alignment).toBeDefined();
    });
  });

  describe('Media Query Testing', () => {
    beforeEach(async () => {
      await responsiveTester.initialize();
    });

    test('should extract media queries', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'MediaQueryComponent.jsx');
      const queries = await responsiveTester.extractMediaQueries(componentPath);
      
      expect(queries).toBeDefined();
      expect(Array.isArray(queries)).toBe(true);
      expect(queries.length).toBeGreaterThan(0);
      
      const query = queries[0];
      expect(query.query).toBeDefined();
      expect(query.conditions).toBeDefined();
    });

    test('should test media query effectiveness', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'MediaQueryComponent.jsx');
      const effectiveness = await responsiveTester.testMediaQueryEffectiveness(componentPath);
      
      expect(effectiveness).toBeDefined();
      expect(effectiveness.score).toBeDefined();
      expect(effectiveness.issues).toBeDefined();
      expect(effectiveness.coverage).toBeDefined();
    });

    test('should detect missing media queries', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'NonResponsive.jsx');
      const missing = await responsiveTester.detectMissingMediaQueries(componentPath);
      
      expect(missing).toBeDefined();
      expect(Array.isArray(missing)).toBe(true);
    });
  });

  describe('Touch Interaction Testing', () => {
    beforeEach(async () => {
      await responsiveTester.initialize();
    });

    test('should analyze touch targets', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'TouchButtons.jsx');
      const analysis = await responsiveTester.analyzeTouchTargets(componentPath);
      
      expect(analysis).toBeDefined();
      expect(analysis.targets).toBeDefined();
      expect(Array.isArray(analysis.targets)).toBe(true);
      expect(analysis.minSize).toBe(44); // WCAG recommended minimum
    });

    test('should detect small touch targets', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'SmallButtons.jsx');
      const issues = await responsiveTester.detectSmallTouchTargets(componentPath);
      
      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
      if (issues.length > 0) {
        expect(issues[0].size).toBeLessThan(44);
      }
    });

    test('should analyze gesture support', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'GestureCarousel.jsx');
      const gestures = await responsiveTester.analyzeGestureSupport(componentPath);
      
      expect(gestures).toBeDefined();
      expect(gestures.swipe).toBeDefined();
      expect(gestures.pinch).toBeDefined();
      expect(gestures.tap).toBeDefined();
    });
  });

  describe('Performance Analysis', () => {
    beforeEach(async () => {
      await responsiveTester.initialize();
    });

    test('should analyze responsive images', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveImages.jsx');
      const analysis = await responsiveTester.analyzeResponsiveImages(componentPath);
      
      expect(analysis).toBeDefined();
      expect(analysis.images).toBeDefined();
      expect(Array.isArray(analysis.images)).toBe(true);
      expect(analysis.optimizations).toBeDefined();
    });

    test('should detect performance issues', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'HeavyComponent.jsx');
      const issues = await responsiveTester.detectPerformanceIssues(componentPath);
      
      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
    });

    test('should analyze CSS complexity', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ComplexStyles.jsx');
      const complexity = await responsiveTester.analyzeCSSComplexity(componentPath);
      
      expect(complexity).toBeDefined();
      expect(complexity.score).toBeDefined();
      expect(complexity.selectors).toBeDefined();
      expect(complexity.mediaQueries).toBeDefined();
    });
  });

  describe('Test Generation', () => {
    beforeEach(async () => {
      await responsiveTester.initialize();
    });

    test('should generate responsive tests', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveCard.jsx');
      const tests = await responsiveTester.generateResponsiveTests(componentPath, 'react');
      
      expect(tests).toBeDefined();
      expect(Array.isArray(tests)).toBe(true);
      expect(tests.length).toBeGreaterThan(0);
      
      const test = tests[0];
      expect(test.name).toBeDefined();
      expect(test.code).toBeDefined();
      expect(test.viewport).toBeDefined();
    });

    test('should generate viewport tests', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveLayout.jsx');
      const tests = await responsiveTester.generateViewportTests(componentPath, 'playwright');
      
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].code).toContain('setViewportSize');
    });

    test('should generate visual regression tests', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveCard.jsx');
      const tests = await responsiveTester.generateVisualRegressionTests(componentPath, 'playwright');
      
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].code).toContain('toHaveScreenshot');
    });
  });

  describe('Responsive Report Generation', () => {
    beforeEach(async () => {
      await responsiveTester.initialize();
    });

    test('should generate comprehensive responsive report', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveLayout.jsx');
      const report = await responsiveTester.generateResponsiveReport(componentPath);
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.viewports).toBeDefined();
      expect(report.breakpoints).toBeDefined();
      expect(report.issues).toBeDefined();
      expect(report.score).toBeDefined();
    });

    test('should generate viewport comparison report', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveCard.jsx');
      const comparison = await responsiveTester.generateViewportComparison(componentPath);
      
      expect(comparison).toBeDefined();
      expect(comparison.mobile).toBeDefined();
      expect(comparison.tablet).toBeDefined();
      expect(comparison.desktop).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await responsiveTester.initialize();
    });

    test('should handle missing component files', async () => {
      const nonExistentPath = path.join(testProjectPath, 'src', 'components', 'NonExistent.jsx');
      const result = await responsiveTester.testViewport(nonExistentPath, 'mobile');
      
      expect(result.viewport).toBe('mobile');
      expect(result.issues).toEqual([]);
    });

    test('should handle malformed components', async () => {
      const malformedPath = path.join(testProjectPath, 'src', 'components', 'Malformed.jsx');
      const result = await responsiveTester.testViewport(malformedPath, 'mobile');
      
      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    test('should handle invalid viewport names', async () => {
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveCard.jsx');
      await expect(responsiveTester.testViewport(componentPath, 'invalid')).rejects.toThrow();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await responsiveTester.initialize();
      
      // Test a layout
      const componentPath = path.join(testProjectPath, 'src', 'components', 'ResponsiveCard.jsx');
      await responsiveTester.testViewport(componentPath, 'mobile');
      
      expect(responsiveTester.testedLayouts.size).toBeGreaterThan(0);
      
      await responsiveTester.cleanup();
      
      expect(responsiveTester.testedLayouts.size).toBe(0);
      expect(responsiveTester.isInitialized).toBe(false);
    });
  });
});

// Helper function to create test project with responsive components
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src', 'components'), { recursive: true });
  
  // Create ResponsiveCard component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'ResponsiveCard.jsx'),
    `
import React from 'react';
import './ResponsiveCard.css';

const ResponsiveCard = ({ title, content, image }) => {
  return (
    <div className="responsive-card">
      <img src={image} alt={title} className="card-image" />
      <div className="card-content">
        <h2 className="card-title">{title}</h2>
        <p className="card-text">{content}</p>
      </div>
    </div>
  );
};

export default ResponsiveCard;
`
  );
  
  // Create ResponsiveCard CSS
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'ResponsiveCard.css'),
    `
.responsive-card {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.card-image {
  width: 100%;
  height: auto;
}

@media (min-width: 768px) {
  .responsive-card {
    flex-direction: row;
  }
  
  .card-image {
    width: 300px;
    margin-right: 1rem;
  }
}

@media (min-width: 1024px) {
  .responsive-card {
    max-width: 1000px;
    margin: 0 auto;
  }
}
`
  );
  
  // Create ResponsiveGrid component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'ResponsiveGrid.jsx'),
    `
import React from 'react';

const ResponsiveGrid = ({ items }) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '1rem',
      padding: '1rem'
    }}>
      {items.map((item, index) => (
        <div key={index} style={{
          background: '#f0f0f0',
          padding: '1rem',
          borderRadius: '4px'
        }}>
          {item}
        </div>
      ))}
    </div>
  );
};

export default ResponsiveGrid;
`
  );
  
  // Create ResponsiveLayout component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'ResponsiveLayout.jsx'),
    `
import React from 'react';

const ResponsiveLayout = ({ children }) => {
  return (
    <div className="layout">
      <header className="header">
        <nav className="nav">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>
      
      <main className="main">
        <aside className="sidebar">
          <h3>Sidebar</h3>
          <ul>
            <li>Link 1</li>
            <li>Link 2</li>
            <li>Link 3</li>
          </ul>
        </aside>
        
        <section className="content">
          {children}
        </section>
      </main>
      
      <footer className="footer">
        <p>&copy; 2024 Responsive Site</p>
      </footer>
    </div>
  );
};

export default ResponsiveLayout;
`
  );
  
  // Create FlexLayout component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'FlexLayout.jsx'),
    `
import React from 'react';

const FlexLayout = ({ children }) => {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '1rem'
    }}>
      {children}
    </div>
  );
};

export default FlexLayout;
`
  );
  
  // Create MediaQueryComponent
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'MediaQueryComponent.jsx'),
    `
import React from 'react';

const MediaQueryComponent = () => {
  return (
    <div>
      <style>
        {\`
          .mobile-only { display: block; }
          .tablet-only { display: none; }
          .desktop-only { display: none; }
          
          @media (min-width: 768px) {
            .mobile-only { display: none; }
            .tablet-only { display: block; }
          }
          
          @media (min-width: 1024px) {
            .tablet-only { display: none; }
            .desktop-only { display: block; }
          }
        \`}
      </style>
      
      <div className="mobile-only">Mobile Content</div>
      <div className="tablet-only">Tablet Content</div>
      <div className="desktop-only">Desktop Content</div>
    </div>
  );
};

export default MediaQueryComponent;
`
  );
  
  // Create OverflowContent component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'OverflowContent.jsx'),
    `
import React from 'react';

const OverflowContent = () => {
  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <div style={{ width: '2000px', background: '#f0f0f0' }}>
        This content is too wide and will overflow on mobile devices
      </div>
    </div>
  );
};

export default OverflowContent;
`
  );
  
  // Create TextContent component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'TextContent.jsx'),
    `
import React from 'react';

const TextContent = () => {
  return (
    <div>
      <h1 style={{ fontSize: '3rem' }}>Large Heading</h1>
      <p style={{ 
        fontSize: '1rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        This is a very long text that might get truncated on smaller screens
      </p>
    </div>
  );
};

export default TextContent;
`
  );
  
  // Create TouchButtons component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'TouchButtons.jsx'),
    `
import React from 'react';

const TouchButtons = () => {
  return (
    <div>
      <button style={{ 
        width: '48px', 
        height: '48px',
        margin: '8px'
      }}>
        Good
      </button>
      
      <button style={{ 
        width: '44px', 
        height: '44px',
        margin: '8px'
      }}>
        OK
      </button>
    </div>
  );
};

export default TouchButtons;
`
  );
  
  // Create SmallButtons component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'SmallButtons.jsx'),
    `
import React from 'react';

const SmallButtons = () => {
  return (
    <div>
      <button style={{ 
        width: '30px', 
        height: '30px',
        margin: '4px'
      }}>
        X
      </button>
      
      <a href="#" style={{
        fontSize: '12px',
        padding: '2px 4px'
      }}>
        Tiny Link
      </a>
    </div>
  );
};

export default SmallButtons;
`
  );
  
  // Create GestureCarousel component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'GestureCarousel.jsx'),
    `
import React, { useState } from 'react';

const GestureCarousel = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const handleSwipe = (direction) => {
    if (direction === 'left') {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };
  
  return (
    <div 
      className="carousel"
      onTouchStart={() => {}}
      onTouchEnd={() => {}}
    >
      <img src={images[currentIndex]} alt="Carousel item" />
      <div className="indicators">
        {images.map((_, index) => (
          <span 
            key={index}
            className={index === currentIndex ? 'active' : ''}
          />
        ))}
      </div>
    </div>
  );
};

export default GestureCarousel;
`
  );
  
  // Create ResponsiveImages component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'ResponsiveImages.jsx'),
    `
import React from 'react';

const ResponsiveImages = () => {
  return (
    <div>
      <picture>
        <source media="(min-width: 1024px)" srcSet="large.jpg" />
        <source media="(min-width: 768px)" srcSet="medium.jpg" />
        <img src="small.jpg" alt="Responsive image" />
      </picture>
      
      <img 
        srcSet="image-320w.jpg 320w, image-768w.jpg 768w, image-1024w.jpg 1024w"
        sizes="(max-width: 320px) 280px, (max-width: 768px) 720px, 1024px"
        src="image-768w.jpg"
        alt="Another responsive image"
      />
    </div>
  );
};

export default ResponsiveImages;
`
  );
  
  // Create HeavyComponent
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'HeavyComponent.jsx'),
    `
import React from 'react';

const HeavyComponent = () => {
  // Large inline styles that could impact performance
  const heavyStyles = Array(100).fill(null).map((_, i) => ({
    [\`.item-\${i}\`]: {
      width: '100%',
      padding: '1rem',
      margin: '0.5rem',
      background: \`hsl(\${i * 3}, 70%, 50%)\`
    }
  }));
  
  return (
    <div>
      {Array(100).fill(null).map((_, i) => (
        <div key={i} className={\`item-\${i}\`}>
          Heavy Item {i}
        </div>
      ))}
    </div>
  );
};

export default HeavyComponent;
`
  );
  
  // Create ComplexStyles component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'ComplexStyles.jsx'),
    `
import React from 'react';

const ComplexStyles = () => {
  return (
    <div>
      <style>
        {\`
          .complex { position: relative; }
          .complex > div { position: absolute; }
          .complex > div > span { display: inline-block; }
          .complex > div > span > a { text-decoration: none; }
          
          @media (min-width: 320px) and (max-width: 480px) {
            .complex { padding: 10px; }
          }
          
          @media (min-width: 481px) and (max-width: 768px) {
            .complex { padding: 15px; }
          }
          
          @media (min-width: 769px) and (max-width: 1024px) {
            .complex { padding: 20px; }
          }
          
          @media (min-width: 1025px) {
            .complex { padding: 25px; }
          }
        \`}
      </style>
      
      <div className="complex">
        <div>
          <span>
            <a href="#">Complex nested structure</a>
          </span>
        </div>
      </div>
    </div>
  );
};

export default ComplexStyles;
`
  );
  
  // Create NonResponsive component
  await fs.writeFile(
    path.join(projectPath, 'src', 'components', 'NonResponsive.jsx'),
    `
import React from 'react';

const NonResponsive = () => {
  return (
    <div style={{ width: '1200px', margin: '0 auto' }}>
      <h1>Fixed Width Layout</h1>
      <p>This component doesn't adapt to different screen sizes.</p>
    </div>
  );
};

export default NonResponsive;
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