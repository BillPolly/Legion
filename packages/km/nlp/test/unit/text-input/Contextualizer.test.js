import { Contextualizer } from '../../../src/text-input/Contextualizer.js';

describe('Contextualizer', () => {
  let contextualizer;

  beforeEach(() => {
    contextualizer = new Contextualizer();
  });

  describe('constructor', () => {
    test('should create instance with default options', () => {
      expect(contextualizer).toBeInstanceOf(Contextualizer);
      expect(contextualizer.options).toBeDefined();
      expect(contextualizer.options.includeStructural).toBe(true);
      expect(contextualizer.options.includeSemantic).toBe(true);
      expect(contextualizer.options.includeOntological).toBe(true);
    });

    test('should accept custom options', () => {
      const customOptions = {
        includeStructural: false,
        includeSemantic: true,
        includeOntological: false,
        maxContextLength: 500
      };
      const customContextualizer = new Contextualizer(customOptions);
      
      expect(customContextualizer.options.includeStructural).toBe(false);
      expect(customContextualizer.options.includeSemantic).toBe(true);
      expect(customContextualizer.options.includeOntological).toBe(false);
      expect(customContextualizer.options.maxContextLength).toBe(500);
    });
  });

  describe('buildContext', () => {
    test('should build comprehensive context for document segments', () => {
      const document = {
        content: `
          # Technical Manual
          
          ## Chapter 1: Equipment Overview
          
          Pump P101 is a critical component in the cooling system.
          
          ## Chapter 2: Operations
          
          The system operates at high pressure.
        `,
        metadata: {
          title: 'Technical Manual',
          domain: 'industrial',
          type: 'manual'
        }
      };

      const segments = [
        {
          content: 'Pump P101 is a critical component in the cooling system.',
          startPosition: 50,
          endPosition: 105,
          segmentIndex: 0,
          structuralInfo: {
            hasHeaders: false,
            type: 'text'
          }
        }
      ];

      const result = contextualizer.buildContext(document, segments);
      
      expect(result).toBeDefined();
      expect(result.documentContext).toBeDefined();
      expect(result.segmentContexts).toHaveLength(1);
      expect(result.segmentContexts[0].segmentIndex).toBe(0);
    });

    test('should include document context', () => {
      const document = {
        content: 'Sample technical document about pumps and systems.',
        metadata: {
          title: 'Pump Manual',
          domain: 'industrial',
          type: 'manual'
        }
      };

      const segments = [{
        content: 'Pump P101 operates efficiently.',
        segmentIndex: 0
      }];

      const result = contextualizer.buildContext(document, segments);
      
      expect(result.documentContext).toEqual({
        title: 'Pump Manual',
        domain: 'industrial',
        type: 'manual',
        length: document.content.length,
        structure: expect.any(Object)
      });
    });

    test('should build structural context', () => {
      const document = {
        content: `
          # Main Title
          
          ## Section 1
          Content for section 1.
          
          ## Section 2  
          Content for section 2.
        `,
        metadata: { domain: 'technical' }
      };

      const segments = [{
        content: 'Content for section 1.',
        segmentIndex: 0,
        structuralInfo: {
          hasHeaders: false,
          type: 'text'
        }
      }];

      const result = contextualizer.buildContext(document, segments);
      
      expect(result.segmentContexts[0].structural).toBeDefined();
      expect(result.segmentContexts[0].structural.nearbyHeaders).toBeDefined();
      expect(result.segmentContexts[0].structural.sectionLevel).toBeDefined();
    });

    test('should build semantic context', () => {
      const document = {
        content: 'Pump P101 and Tank T200 are part of System S300.',
        metadata: { domain: 'industrial' }
      };

      const segments = [{
        content: 'Pump P101 and Tank T200 are part of System S300.',
        segmentIndex: 0
      }];

      const result = contextualizer.buildContext(document, segments);
      
      expect(result.segmentContexts[0].semantic).toBeDefined();
      expect(result.segmentContexts[0].semantic.entities).toBeDefined();
      expect(result.segmentContexts[0].semantic.domain).toBe('industrial');
      expect(result.segmentContexts[0].semantic.terminology).toBeDefined();
    });

    test('should handle empty segments gracefully', () => {
      const document = {
        content: 'Sample document.',
        metadata: { domain: 'general' }
      };

      const result = contextualizer.buildContext(document, []);
      
      expect(result.documentContext).toBeDefined();
      expect(result.segmentContexts).toHaveLength(0);
    });
  });

  describe('extractStructuralContext', () => {
    test('should identify nearby headers', () => {
      const document = {
        content: `
          # Main Title
          
          Introduction paragraph.
          
          ## Section 1
          
          Content for section 1.
          
          ### Subsection 1.1
          
          Detailed content.
        `
      };

      const segment = {
        content: 'Content for section 1.',
        startPosition: 70,
        endPosition: 95
      };

      const structural = contextualizer.extractStructuralContext(document, segment);
      
      expect(structural.nearbyHeaders).toBeDefined();
      expect(structural.nearbyHeaders.length).toBeGreaterThan(0);
      expect(structural.sectionLevel).toBeDefined();
      expect(structural.parentSection).toBeDefined();
    });

    test('should determine section hierarchy', () => {
      const document = {
        content: `
          # Main Title
          ## Section 1
          ### Subsection 1.1
          Content here.
        `
      };

      const segment = {
        content: 'Content here.',
        startPosition: 50,
        endPosition: 65
      };

      const structural = contextualizer.extractStructuralContext(document, segment);
      
      expect(structural.sectionLevel).toBe(3);
      expect(structural.parentSection).toContain('Subsection 1.1');
    });

    test('should handle documents without headers', () => {
      const document = {
        content: 'Simple document without any headers or structure.'
      };

      const segment = {
        content: 'Simple document without any headers or structure.',
        startPosition: 0,
        endPosition: 47
      };

      const structural = contextualizer.extractStructuralContext(document, segment);
      
      expect(structural.nearbyHeaders).toHaveLength(0);
      expect(structural.sectionLevel).toBe(0);
      expect(structural.parentSection).toBe('');
    });
  });

  describe('extractSemanticContext', () => {
    test('should identify domain-specific entities', () => {
      const segment = {
        content: 'Pump P101 operates at 150 PSI and connects to Tank T200.'
      };

      const documentContext = {
        domain: 'industrial'
      };

      const semantic = contextualizer.extractSemanticContext(segment, documentContext);
      
      expect(semantic.entities).toBeDefined();
      expect(semantic.entities.length).toBeGreaterThan(0);
      expect(semantic.entities.some(e => e.text === 'Pump P101')).toBe(true);
      expect(semantic.entities.some(e => e.text === 'Tank T200')).toBe(true);
    });

    test('should extract domain terminology', () => {
      const segment = {
        content: 'The centrifugal pump operates with high efficiency and low maintenance requirements.'
      };

      const documentContext = {
        domain: 'industrial'
      };

      const semantic = contextualizer.extractSemanticContext(segment, documentContext);
      
      expect(semantic.terminology).toBeDefined();
      expect(semantic.terminology.length).toBeGreaterThan(0);
      expect(semantic.domain).toBe('industrial');
    });

    test('should handle different domains', () => {
      const segment = {
        content: 'The patient exhibits symptoms of hypertension and requires medication.'
      };

      const documentContext = {
        domain: 'medical'
      };

      const semantic = contextualizer.extractSemanticContext(segment, documentContext);
      
      expect(semantic.domain).toBe('medical');
      expect(semantic.terminology).toBeDefined();
    });
  });

  describe('buildOntologicalContext', () => {
    test('should extract relevant ontological information', () => {
      const entities = [
        { text: 'Pump P101', type: 'Pump' },
        { text: 'Tank T200', type: 'Tank' }
      ];

      const domain = 'industrial';

      const ontological = contextualizer.buildOntologicalContext(entities, domain);
      
      expect(ontological.relevantClasses).toBeDefined();
      expect(ontological.relevantProperties).toBeDefined();
      expect(ontological.relevantRelationships).toBeDefined();
      expect(ontological.domain).toBe(domain);
    });

    test('should provide class definitions for entities', () => {
      const entities = [
        { text: 'Pump P101', type: 'Pump' }
      ];

      const ontological = contextualizer.buildOntologicalContext(entities, 'industrial');
      
      expect(ontological.relevantClasses).toContain('Pump');
      expect(ontological.relevantProperties.some(p => p.class === 'Pump')).toBe(true);
    });

    test('should handle empty entity list', () => {
      const ontological = contextualizer.buildOntologicalContext([], 'general');
      
      expect(ontological.relevantClasses).toHaveLength(0);
      expect(ontological.relevantProperties).toHaveLength(0);
      expect(ontological.relevantRelationships).toHaveLength(0);
    });
  });

  describe('integration', () => {
    test('should integrate with DocumentSegmenter output', () => {
      const document = {
        content: `
          # Equipment Manual
          
          ## Pump Systems
          
          Pump P101 is a centrifugal pump used in the cooling system.
          It operates at 150 PSI and has a flow rate of 500 GPM.
          
          ## Tank Systems
          
          Tank T200 stores coolant for the system.
        `,
        metadata: {
          title: 'Equipment Manual',
          domain: 'industrial'
        }
      };

      // Simulate DocumentSegmenter output
      const segments = [
        {
          content: 'Pump P101 is a centrifugal pump used in the cooling system.',
          startPosition: 50,
          endPosition: 108,
          segmentIndex: 0,
          structuralInfo: {
            hasHeaders: false,
            type: 'text'
          }
        },
        {
          content: 'It operates at 150 PSI and has a flow rate of 500 GPM.',
          startPosition: 109,
          endPosition: 163,
          segmentIndex: 1,
          structuralInfo: {
            hasHeaders: false,
            type: 'text'
          }
        }
      ];

      const result = contextualizer.buildContext(document, segments);
      
      expect(result.segmentContexts).toHaveLength(2);
      expect(result.segmentContexts[0].structural).toBeDefined();
      expect(result.segmentContexts[0].semantic).toBeDefined();
      expect(result.segmentContexts[0].ontological).toBeDefined();
      expect(result.segmentContexts[1].structural).toBeDefined();
      expect(result.segmentContexts[1].semantic).toBeDefined();
      expect(result.segmentContexts[1].ontological).toBeDefined();
    });

    test('should provide context for LLM processing', () => {
      const document = {
        content: 'Pump P101 connects to Tank T200 via Pipeline PL300.',
        metadata: { domain: 'industrial' }
      };

      const segments = [{
        content: 'Pump P101 connects to Tank T200 via Pipeline PL300.',
        segmentIndex: 0
      }];

      const result = contextualizer.buildContext(document, segments);
      const segmentContext = result.segmentContexts[0];
      
      // Should provide rich context for LLM entity extraction
      expect(segmentContext.semantic.entities).toBeDefined();
      expect(segmentContext.ontological.relevantClasses).toBeDefined();
      expect(segmentContext.ontological.relevantRelationships).toBeDefined();
      
      // Context should be suitable for LLM prompts
      expect(segmentContext.semantic.domain).toBe('industrial');
      expect(segmentContext.ontological.domain).toBe('industrial');
    });
  });

  describe('error handling', () => {
    test('should handle malformed document gracefully', () => {
      const document = null;
      const segments = [];

      expect(() => {
        contextualizer.buildContext(document, segments);
      }).not.toThrow();
    });

    test('should handle missing metadata', () => {
      const document = {
        content: 'Sample content without metadata.'
      };

      const segments = [{
        content: 'Sample content.',
        segmentIndex: 0
      }];

      const result = contextualizer.buildContext(document, segments);
      
      expect(result.documentContext).toBeDefined();
      expect(result.segmentContexts).toHaveLength(1);
    });

    test('should handle very long content', () => {
      const longContent = 'A'.repeat(10000);
      const document = {
        content: longContent,
        metadata: { domain: 'general' }
      };

      const segments = [{
        content: longContent.substring(0, 100),
        segmentIndex: 0
      }];

      const result = contextualizer.buildContext(document, segments);
      
      expect(result).toBeDefined();
      expect(result.segmentContexts).toHaveLength(1);
    });
  });
});
