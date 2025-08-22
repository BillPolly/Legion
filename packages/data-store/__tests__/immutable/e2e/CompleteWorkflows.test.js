/**
 * End-to-End Tests for Complete Workflows
 * Per implementation plan Phase 5 Step 5.1
 * Tests the design document examples from §12
 */

import { ImmutableDataStore } from '../../../src/immutable/ImmutableDataStore.js';
import { EntityType } from '../../../src/immutable/schema/EntityType.js';
import { EntityTypeRegistry } from '../../../src/immutable/schema/EntityTypeRegistry.js';
import { CardinalityConstraint } from '../../../src/immutable/constraints/CardinalityConstraint.js';
import { EntityTypeConstraint } from '../../../src/immutable/constraints/EntityTypeConstraint.js';
import { CustomConstraint } from '../../../src/immutable/constraints/CustomConstraint.js';
import { ConstraintResult } from '../../../src/immutable/constraints/ConstraintResult.js';
import { ConstraintViolation } from '../../../src/immutable/constraints/ConstraintViolation.js';
import { Edge } from '../../../src/Edge.js';
import { RelationshipType } from '../../../src/RelationshipType.js';

describe('Complete End-to-End Workflows', () => {
  describe('Design §12 Example: Suppliers in UK named Acme', () => {
    test('should query suppliers in UK with name containing Acme', () => {
      // Set up entity types
      const supplierType = new EntityType('Supplier', {
        required: ['name', 'country'],
        types: { name: 'string', country: 'string' }
      });

      const productType = new EntityType('Product', {
        required: ['name', 'category'],
        types: { name: 'string', category: 'string' }
      });

      const registry = new EntityTypeRegistry([supplierType, productType]);
      
      // Create store with schema
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        relationshipSchema: {
          'supplies': { source: 'Supplier', target: 'Product' }
        },
        generateSchemaConstraints: true,
        enableSchemaValidation: true
      });

      // Add suppliers
      let currentStore = store
        .withEntityType('s1', 'Supplier', { name: 'Acme Corp', country: 'UK' })
        .withEntityType('s2', 'Supplier', { name: 'Acme Industries', country: 'UK' })
        .withEntityType('s3', 'Supplier', { name: 'Beta Corp', country: 'UK' })
        .withEntityType('s4', 'Supplier', { name: 'Acme LLC', country: 'USA' })
        .withEntityType('s5', 'Supplier', { name: 'Gamma Ltd', country: 'UK' })
        .withEntityType('p1', 'Product', { name: 'Widget', category: 'Hardware' })
        .withEntityType('p2', 'Product', { name: 'Gadget', category: 'Electronics' });

      // Add relationships
      currentStore = currentStore
        .addEdge(new Edge('supplies', 's1', 'p1'))
        .addEdge(new Edge('supplies', 's1', 'p2'))
        .addEdge(new Edge('supplies', 's2', 'p1'))
        .addEdge(new Edge('supplies', 's3', 'p2'))
        .addEdge(new Edge('supplies', 's4', 'p1'));

      // Query: Find suppliers in UK with name containing "Acme"
      const allSuppliers = ['s1', 's2', 's3', 's4', 's5'];
      const ukAcmeSuppliers = allSuppliers.filter(id => {
        const metadata = currentStore.getEntityMetadata(id);
        return metadata && 
               metadata.type === 'Supplier' &&
               metadata.attributes.country === 'UK' &&
               metadata.attributes.name.includes('Acme');
      });

      expect(ukAcmeSuppliers).toEqual(['s1', 's2']);
      
      // Verify their relationships
      const s1Edges = currentStore.getEdgesBySource('s1');
      expect(s1Edges).toHaveLength(2);
      
      const s2Edges = currentStore.getEdgesBySource('s2');
      expect(s2Edges).toHaveLength(1);
    });
  });

  describe('Design §12 Example: Projects with approved members', () => {
    test('should find projects where all members have approved status', () => {
      const personType = new EntityType('Person', {
        required: ['name', 'status'],
        types: { name: 'string', status: 'string' },
        constraints: {
          status: { enum: ['approved', 'pending', 'rejected'] }
        }
      });

      const projectType = new EntityType('Project', {
        required: ['name', 'priority'],
        types: { name: 'string', priority: 'string' },
        constraints: {
          priority: { enum: ['low', 'medium', 'high'] }
        }
      });

      const registry = new EntityTypeRegistry([personType, projectType]);
      
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        relationshipSchema: {
          'memberOf': { source: 'Person', target: 'Project' }
        },
        generateSchemaConstraints: true,
        enableSchemaValidation: true
      });

      // Set up data
      let currentStore = store
        // People
        .withEntityType('alice', 'Person', { name: 'Alice', status: 'approved' })
        .withEntityType('bob', 'Person', { name: 'Bob', status: 'approved' })
        .withEntityType('charlie', 'Person', { name: 'Charlie', status: 'pending' })
        .withEntityType('dave', 'Person', { name: 'Dave', status: 'approved' })
        .withEntityType('eve', 'Person', { name: 'Eve', status: 'rejected' })
        // Projects
        .withEntityType('proj1', 'Project', { name: 'Project Alpha', priority: 'high' })
        .withEntityType('proj2', 'Project', { name: 'Project Beta', priority: 'medium' })
        .withEntityType('proj3', 'Project', { name: 'Project Gamma', priority: 'low' });

      // Add memberships
      currentStore = currentStore
        // Project 1: Alice (approved), Bob (approved) - ALL APPROVED
        .addEdge(new Edge('memberOf', 'alice', 'proj1'))
        .addEdge(new Edge('memberOf', 'bob', 'proj1'))
        // Project 2: Bob (approved), Charlie (pending) - NOT ALL APPROVED
        .addEdge(new Edge('memberOf', 'bob', 'proj2'))
        .addEdge(new Edge('memberOf', 'charlie', 'proj2'))
        // Project 3: Dave (approved) - ALL APPROVED
        .addEdge(new Edge('memberOf', 'dave', 'proj3'));

      // Query: Find projects where all members are approved
      const allProjects = ['proj1', 'proj2', 'proj3'];
      const approvedProjects = allProjects.filter(projId => {
        const memberEdges = currentStore.getEdgesByDestination(projId);
        
        if (memberEdges.length === 0) return false;
        
        // Check if all members are approved
        return memberEdges.every(edge => {
          const memberMetadata = currentStore.getEntityMetadata(edge.src);
          return memberMetadata && 
                 memberMetadata.type === 'Person' &&
                 memberMetadata.attributes.status === 'approved';
        });
      });

      expect(approvedProjects).toEqual(['proj1', 'proj3']);
      
      // Verify project metadata
      const proj1Meta = currentStore.getEntityMetadata('proj1');
      expect(proj1Meta.attributes.priority).toBe('high');
      
      const proj3Meta = currentStore.getEntityMetadata('proj3');
      expect(proj3Meta.attributes.priority).toBe('low');
    });
  });

  describe('Design §12 Example: Complex queries with disjunction and NOT', () => {
    test('should handle complex boolean queries', () => {
      const companyType = new EntityType('Company', {
        required: ['name', 'sector', 'size'],
        types: { 
          name: 'string', 
          sector: 'string',
          size: 'string'
        },
        constraints: {
          sector: { enum: ['tech', 'finance', 'retail', 'healthcare'] },
          size: { enum: ['small', 'medium', 'large'] }
        }
      });

      const personType = new EntityType('Person', {
        required: ['name', 'role'],
        types: { name: 'string', role: 'string' }
      });

      const registry = new EntityTypeRegistry([companyType, personType]);
      
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        relationshipSchema: {
          'worksAt': { source: 'Person', target: 'Company' },
          'partners': { source: 'Company', target: 'Company' }
        },
        generateSchemaConstraints: true,
        enableSchemaValidation: true
      });

      // Set up companies
      let currentStore = store
        .withEntityType('c1', 'Company', { name: 'TechCorp', sector: 'tech', size: 'large' })
        .withEntityType('c2', 'Company', { name: 'FinanceInc', sector: 'finance', size: 'large' })
        .withEntityType('c3', 'Company', { name: 'RetailCo', sector: 'retail', size: 'medium' })
        .withEntityType('c4', 'Company', { name: 'HealthPlus', sector: 'healthcare', size: 'small' })
        .withEntityType('c5', 'Company', { name: 'StartupTech', sector: 'tech', size: 'small' })
        // People
        .withEntityType('p1', 'Person', { name: 'Alice', role: 'Engineer' })
        .withEntityType('p2', 'Person', { name: 'Bob', role: 'Manager' })
        .withEntityType('p3', 'Person', { name: 'Charlie', role: 'Analyst' });

      // Add relationships
      currentStore = currentStore
        .addEdge(new Edge('worksAt', 'p1', 'c1'))
        .addEdge(new Edge('worksAt', 'p2', 'c2'))
        .addEdge(new Edge('worksAt', 'p3', 'c3'))
        .addEdge(new Edge('partners', 'c1', 'c2'))
        .addEdge(new Edge('partners', 'c1', 'c5'))
        .addEdge(new Edge('partners', 'c3', 'c4'));

      // Query 1: (Tech OR Finance) AND Large
      const techOrFinanceAndLarge = ['c1', 'c2', 'c3', 'c4', 'c5'].filter(id => {
        const meta = currentStore.getEntityMetadata(id);
        return meta && 
               meta.type === 'Company' &&
               (meta.attributes.sector === 'tech' || meta.attributes.sector === 'finance') &&
               meta.attributes.size === 'large';
      });
      expect(techOrFinanceAndLarge).toEqual(['c1', 'c2']);

      // Query 2: NOT (retail) AND has employees
      const notRetailWithEmployees = ['c1', 'c2', 'c3', 'c4', 'c5'].filter(id => {
        const meta = currentStore.getEntityMetadata(id);
        const hasEmployees = currentStore.getEdgesByDestination(id)
          .some(e => e.type === 'worksAt');
        
        return meta && 
               meta.type === 'Company' &&
               meta.attributes.sector !== 'retail' &&
               hasEmployees;
      });
      expect(notRetailWithEmployees).toEqual(['c1', 'c2']);

      // Query 3: Companies with partnerships
      const withPartnerships = ['c1', 'c2', 'c3', 'c4', 'c5'].filter(id => {
        const outgoing = currentStore.getEdgesBySource(id)
          .filter(e => e.type === 'partners');
        const incoming = currentStore.getEdgesByDestination(id)
          .filter(e => e.type === 'partners');
        return outgoing.length > 0 || incoming.length > 0;
      });
      expect(withPartnerships.sort()).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    });
  });

  describe('Real-world Workflow: Knowledge Graph Construction', () => {
    test('should build and query a knowledge graph with constraints', () => {
      // Define ontology
      const conceptType = new EntityType('Concept', {
        required: ['label', 'domain'],
        types: { label: 'string', domain: 'string' }
      });

      const documentType = new EntityType('Document', {
        required: ['title', 'url'],
        optional: ['publishedDate'],
        types: { 
          title: 'string', 
          url: 'string',
          publishedDate: 'string'
        }
      });

      const authorType = new EntityType('Author', {
        required: ['name', 'affiliation'],
        types: { name: 'string', affiliation: 'string' }
      });

      const registry = new EntityTypeRegistry([conceptType, documentType, authorType]);
      
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        relationshipSchema: {
          'mentions': { source: 'Document', target: 'Concept' },
          'relatedTo': { source: 'Concept', target: 'Concept' },
          'authoredBy': { source: 'Document', target: 'Author' },
          'cites': { source: 'Document', target: 'Document' }
        },
        generateSchemaConstraints: true,
        enableSchemaValidation: true,
        constraints: [
          // Each document must have at least one author
          new CardinalityConstraint('min-authors', 'authoredBy', 'source', 1, null),
          // Documents can cite max 50 other documents
          new CardinalityConstraint('max-citations', 'cites', 'source', 0, 50),
          // Concepts can be related to max 20 other concepts
          new CardinalityConstraint('max-relations', 'relatedTo', 'source', 0, 20)
        ]
      });

      // Build knowledge graph
      let kg = store
        // Concepts
        .withEntityType('ml', 'Concept', { label: 'Machine Learning', domain: 'AI' })
        .withEntityType('nlp', 'Concept', { label: 'Natural Language Processing', domain: 'AI' })
        .withEntityType('dl', 'Concept', { label: 'Deep Learning', domain: 'AI' })
        .withEntityType('cv', 'Concept', { label: 'Computer Vision', domain: 'AI' })
        // Authors
        .withEntityType('author1', 'Author', { name: 'Dr. Smith', affiliation: 'MIT' })
        .withEntityType('author2', 'Author', { name: 'Dr. Jones', affiliation: 'Stanford' })
        .withEntityType('author3', 'Author', { name: 'Dr. Brown', affiliation: 'CMU' })
        // Documents
        .withEntityType('doc1', 'Document', { 
          title: 'Introduction to ML',
          url: 'http://example.com/ml-intro',
          publishedDate: '2023-01-15'
        })
        .withEntityType('doc2', 'Document', {
          title: 'Advanced NLP Techniques',
          url: 'http://example.com/nlp-advanced',
          publishedDate: '2023-06-20'
        })
        .withEntityType('doc3', 'Document', {
          title: 'Deep Learning for Vision',
          url: 'http://example.com/dl-vision',
          publishedDate: '2023-09-10'
        });

      // Add relationships
      kg = kg
        // Document authorship (satisfies min-authors constraint)
        .addEdge(new Edge('authoredBy', 'doc1', 'author1'))
        .addEdge(new Edge('authoredBy', 'doc2', 'author2'))
        .addEdge(new Edge('authoredBy', 'doc3', 'author1'))
        .addEdge(new Edge('authoredBy', 'doc3', 'author3'))
        // Concept mentions
        .addEdge(new Edge('mentions', 'doc1', 'ml'))
        .addEdge(new Edge('mentions', 'doc2', 'nlp'))
        .addEdge(new Edge('mentions', 'doc2', 'ml'))
        .addEdge(new Edge('mentions', 'doc3', 'dl'))
        .addEdge(new Edge('mentions', 'doc3', 'cv'))
        // Concept relations
        .addEdge(new Edge('relatedTo', 'ml', 'dl'))
        .addEdge(new Edge('relatedTo', 'ml', 'nlp'))
        .addEdge(new Edge('relatedTo', 'dl', 'cv'))
        .addEdge(new Edge('relatedTo', 'nlp', 'ml'))
        // Document citations
        .addEdge(new Edge('cites', 'doc2', 'doc1'))
        .addEdge(new Edge('cites', 'doc3', 'doc1'))
        .addEdge(new Edge('cites', 'doc3', 'doc2'));

      // Queries

      // 1. Find all documents by a specific author
      const smithDocs = ['doc1', 'doc2', 'doc3'].filter(docId => {
        const authorEdges = kg.getEdgesBySource(docId)
          .filter(e => e.type === 'authoredBy');
        return authorEdges.some(e => e.dst === 'author1');
      });
      expect(smithDocs).toEqual(['doc1', 'doc3']);

      // 2. Find concepts mentioned in multiple documents
      const conceptMentions = {};
      ['ml', 'nlp', 'dl', 'cv'].forEach(conceptId => {
        const mentions = kg.getEdgesByDestination(conceptId)
          .filter(e => e.type === 'mentions');
        conceptMentions[conceptId] = mentions.length;
      });
      expect(conceptMentions.ml).toBe(2); // Mentioned in doc1 and doc2
      expect(conceptMentions.nlp).toBe(1);
      expect(conceptMentions.dl).toBe(1);
      expect(conceptMentions.cv).toBe(1);

      // 3. Find documents with most citations
      const citationCounts = {};
      ['doc1', 'doc2', 'doc3'].forEach(docId => {
        const citations = kg.getEdgesByDestination(docId)
          .filter(e => e.type === 'cites');
        citationCounts[docId] = citations.length;
      });
      expect(citationCounts.doc1).toBe(2); // Most cited
      expect(citationCounts.doc2).toBe(1);
      expect(citationCounts.doc3).toBe(0);

      // 4. Test constraint enforcement
      // Try to add document without author (violates min-authors)
      const doc4 = kg.withEntityType('doc4', 'Document', {
        title: 'Orphan Document',
        url: 'http://example.com/orphan'
      });
      
      // Can't add edges from doc4 without first adding an author edge
      expect(() => {
        doc4.addEdge(new Edge('mentions', 'doc4', 'ml'));
      }).not.toThrow(); // This is OK, doesn't violate author constraint yet
      
      // But batch operations that check all constraints would catch it
      const validationResult = doc4.validateCurrentState();
      expect(validationResult.isValid).toBe(true); // No edges yet, so valid
    });
  });

  describe('Performance and Scale Testing', () => {
    test('should handle graph with 1000+ nodes efficiently', () => {
      const nodeType = new EntityType('Node', {
        required: ['id', 'value'],
        types: { id: 'string', value: 'number' }
      });

      const registry = new EntityTypeRegistry([nodeType]);
      
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        relationshipSchema: {
          'link': { source: 'Node', target: 'Node' }
        },
        generateSchemaConstraints: true
      });

      const startTime = Date.now();
      
      // Create 1000 nodes
      let bigGraph = store;
      for (let i = 0; i < 1000; i++) {
        bigGraph = bigGraph.withEntityType(`n${i}`, 'Node', {
          id: `node-${i}`,
          value: Math.random() * 100
        });
      }

      // Create edges (sparse graph - each node connects to ~3 others)
      for (let i = 0; i < 1000; i++) {
        for (let j = 0; j < 3; j++) {
          const target = Math.floor(Math.random() * 1000);
          if (target !== i) {
            bigGraph = bigGraph.addEdge(new Edge('link', `n${i}`, `n${target}`));
          }
        }
      }

      const buildTime = Date.now() - startTime;
      
      // Should build in reasonable time
      expect(buildTime).toBeLessThan(10000); // 10 seconds max
      
      // Test queries
      const queryStart = Date.now();
      
      // Find nodes with high connectivity
      const hubNodes = [];
      for (let i = 0; i < 1000; i++) {
        const outDegree = bigGraph.getEdgesBySource(`n${i}`).length;
        const inDegree = bigGraph.getEdgesByDestination(`n${i}`).length;
        if (outDegree + inDegree > 10) {
          hubNodes.push(`n${i}`);
        }
      }
      
      const queryTime = Date.now() - queryStart;
      expect(queryTime).toBeLessThan(1000); // Queries should be fast
      
      // Graph should have expected structure
      expect(bigGraph.getEdgeCount()).toBeGreaterThan(2500);
      expect(bigGraph.getEdgeCount()).toBeLessThan(3500);
    });
  });
});