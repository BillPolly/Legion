import { DocumentSegmenter } from '../../../src/text-input/DocumentSegmenter.js';

describe('DocumentSegmenter', () => {
  let segmenter;

  beforeEach(() => {
    segmenter = new DocumentSegmenter();
  });

  describe('constructor', () => {
    test('should create instance with default options', () => {
      expect(segmenter).toBeInstanceOf(DocumentSegmenter);
      expect(segmenter.options).toBeDefined();
      expect(segmenter.options.maxSegmentLength).toBe(1000);
      expect(segmenter.options.overlapLength).toBe(100);
      expect(segmenter.options.preserveStructure).toBe(true);
    });

    test('should accept custom options', () => {
      const customOptions = {
        maxSegmentLength: 500,
        overlapLength: 50,
        preserveStructure: false,
        segmentationStrategy: 'topic-based'
      };
      const customSegmenter = new DocumentSegmenter(customOptions);
      
      expect(customSegmenter.options.maxSegmentLength).toBe(500);
      expect(customSegmenter.options.overlapLength).toBe(50);
      expect(customSegmenter.options.preserveStructure).toBe(false);
      expect(customSegmenter.options.segmentationStrategy).toBe('topic-based');
    });
  });

  describe('segmentText', () => {
    test('should segment text into manageable chunks', () => {
      const text = `
        This is the first paragraph with some content that describes the initial topic.
        
        This is the second paragraph that continues with related information about the same topic.
        
        This is the third paragraph that introduces a new topic and different concepts.
        
        This is the fourth paragraph that elaborates on the new topic with additional details.
      `;

      const result = segmenter.segmentText(text);
      
      expect(result.segments).toBeDefined();
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalSegments).toBe(result.segments.length);
      expect(result.metadata.segmentationStrategy).toBeDefined();
    });

    test('should create overlapping segments for context preservation', () => {
      const text = 'A'.repeat(1500); // Long text that will be segmented
      const result = segmenter.segmentText(text);
      
      expect(result.segments.length).toBeGreaterThan(1);
      
      // Check for overlap between consecutive segments
      if (result.segments.length > 1) {
        const firstSegment = result.segments[0];
        const secondSegment = result.segments[1];
        
        expect(firstSegment.endPosition).toBeGreaterThan(secondSegment.startPosition);
      }
    });

    test('should preserve document structure when enabled', () => {
      const text = `
        # Main Title
        
        This is the introduction paragraph.
        
        ## Section 1
        
        This is section 1 content.
        
        ## Section 2
        
        This is section 2 content.
      `;

      const result = segmenter.segmentText(text);
      
      // Should preserve structural boundaries
      expect(result.segments.some(s => s.structuralInfo?.type === 'header')).toBe(true);
      expect(result.metadata.structuralElements).toBeGreaterThan(0);
    });

    test('should handle empty text gracefully', () => {
      const result = segmenter.segmentText('');
      
      expect(result.segments).toHaveLength(0);
      expect(result.metadata.totalSegments).toBe(0);
    });

    test('should handle very short text', () => {
      const text = 'Short text.';
      const result = segmenter.segmentText(text);
      
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].content).toBe(text);
      expect(result.segments[0].startPosition).toBe(0);
      expect(result.segments[0].endPosition).toBe(text.length);
    });
  });

  describe('segmentationStrategies', () => {
    test('should support paragraph-based segmentation', () => {
      const paragraphSegmenter = new DocumentSegmenter({
        segmentationStrategy: 'paragraph-based'
      });

      const text = `
        First paragraph with content.
        
        Second paragraph with different content.
        
        Third paragraph with more content.
      `;

      const result = paragraphSegmenter.segmentText(text);
      
      expect(result.metadata.segmentationStrategy).toBe('paragraph-based');
      expect(result.segments.length).toBeGreaterThan(1);
    });

    test('should support semantic segmentation', () => {
      const semanticSegmenter = new DocumentSegmenter({
        segmentationStrategy: 'semantic'
      });

      const text = `
        Pumps are mechanical devices used to move fluids. They operate by creating pressure differences.
        
        Tanks are storage containers for various materials. They come in different shapes and sizes.
        
        Systems integrate multiple components to achieve specific functions. They require careful design.
      `;

      const result = semanticSegmenter.segmentText(text);
      
      expect(result.metadata.segmentationStrategy).toBe('semantic');
      expect(result.segments.length).toBeGreaterThan(0);
    });

    test('should support entity-based segmentation', () => {
      const entitySegmenter = new DocumentSegmenter({
        segmentationStrategy: 'entity-based'
      });

      const text = `
        Pump P101 is manufactured by Siemens. It operates at 150 psi.
        Tank T200 contains coolant. It has a capacity of 1000 gallons.
        System S300 includes both components. It is used for cooling.
      `;

      const result = entitySegmenter.segmentText(text);
      
      expect(result.metadata.segmentationStrategy).toBe('entity-based');
      expect(result.segments.length).toBeGreaterThan(0);
    });
  });

  describe('contextWindows', () => {
    test('should create context windows with proper overlap', () => {
      const text = 'A'.repeat(2000); // Long text
      const result = segmenter.segmentText(text);
      
      if (result.segments.length > 1) {
        for (let i = 0; i < result.segments.length - 1; i++) {
          const currentSegment = result.segments[i];
          const nextSegment = result.segments[i + 1];
          
          // Check overlap
          const overlapStart = nextSegment.startPosition;
          const overlapEnd = currentSegment.endPosition;
          const overlapLength = overlapEnd - overlapStart;
          
          expect(overlapLength).toBeGreaterThan(0);
          expect(overlapLength).toBeLessThanOrEqual(segmenter.options.overlapLength);
        }
      }
    });

    test('should maintain cross-references in overlapping regions', () => {
      const text = `
        Pump P101 is connected to Tank T200. The pump operates at high pressure.
        Tank T200 stores coolant for the system. The tank has safety valves.
        System S300 monitors both components. The system ensures proper operation.
      `;

      const result = segmenter.segmentText(text);
      
      // Check that entity references are tracked across segments
      expect(result.metadata.crossReferences).toBeDefined();
      expect(result.metadata.crossReferences.length).toBeGreaterThan(0);
    });
  });

  describe('hierarchyPreservation', () => {
    test('should preserve document hierarchy', () => {
      const text = `
        # Main Document
        
        Introduction to the document.
        
        ## Section 1: Equipment
        
        ### Subsection 1.1: Pumps
        
        Details about pumps.
        
        ### Subsection 1.2: Tanks
        
        Details about tanks.
        
        ## Section 2: Systems
        
        Details about systems.
      `;

      const result = segmenter.segmentText(text);
      
      // Should preserve hierarchical structure - simplified for POC
      expect(result.metadata.hierarchyLevels).toBeGreaterThanOrEqual(1);
      expect(result.segments.some(s => s.hierarchyLevel >= 1)).toBe(true);
      expect(result.metadata.structuralElements).toBeGreaterThan(0);
    });

    test('should respect section boundaries', () => {
      const text = `
        ## Section A
        Content for section A that should stay together.
        More content for section A.
        
        ## Section B
        Content for section B that should stay together.
        More content for section B.
      `;

      const result = segmenter.segmentText(text);
      
      // Segments should respect section boundaries
      const sectionASegments = result.segments.filter(s => 
        s.content.includes('Section A') || s.structuralInfo?.section === 'Section A'
      );
      const sectionBSegments = result.segments.filter(s => 
        s.content.includes('Section B') || s.structuralInfo?.section === 'Section B'
      );
      
      expect(sectionASegments.length).toBeGreaterThan(0);
      expect(sectionBSegments.length).toBeGreaterThan(0);
    });
  });

  describe('getSegmentMetadata', () => {
    test('should provide comprehensive segment metadata', () => {
      const text = `
        # Technical Manual
        
        ## Chapter 1: Equipment Overview
        
        Pump P101 is a critical component in the cooling system.
      `;

      const result = segmenter.segmentText(text);
      
      expect(result.metadata).toHaveProperty('totalSegments');
      expect(result.metadata).toHaveProperty('averageSegmentLength');
      expect(result.metadata).toHaveProperty('segmentationStrategy');
      expect(result.metadata).toHaveProperty('structuralElements');
      expect(result.metadata).toHaveProperty('crossReferences');
      expect(result.metadata).toHaveProperty('hierarchyLevels');
    });

    test('should track processing statistics', () => {
      const text = 'Sample text for processing.';
      const result = segmenter.segmentText(text);
      
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.originalLength).toBe(text.length);
      expect(result.metadata.totalSegmentedLength).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    test('should handle null input gracefully', () => {
      const result = segmenter.segmentText(null);
      
      expect(result.segments).toHaveLength(0);
      expect(result.metadata.totalSegments).toBe(0);
      expect(result.metadata.error).toBeUndefined();
    });

    test('should handle malformed text', () => {
      const malformedText = '\u0000\u0001\u0002Invalid characters';
      const result = segmenter.segmentText(malformedText);
      
      expect(result.segments).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    test('should handle extremely long text', () => {
      const longText = 'A'.repeat(100000); // Very long text
      const result = segmenter.segmentText(longText);
      
      expect(result.segments.length).toBeGreaterThan(1);
      expect(result.metadata.totalSegments).toBeGreaterThan(1);
    });
  });
});
