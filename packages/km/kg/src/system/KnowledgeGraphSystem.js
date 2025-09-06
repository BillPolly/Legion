import { KGEngine } from '../core/KGEngine.js';
import { QueryBuilder } from '../core/QueryBuilder.js';
import { idManager } from '../core/IDManager.js';
import { NamespaceManager, RDFSerializer, RDFParser } from '@legion/kg-rdf';
import { ObjectReconstructor } from '../reconstruction/ObjectReconstructor.js';
import { KGToolRegistry } from '../tools/KGToolRegistry.js';
import { KGSchemaGenerator } from '../tools/KGSchemaGenerator.js';
import { ToolDependencyManager } from '../tools/ToolDependencyManager.js';
import { JSONSchemaGenerator } from '../export/JSONSchemaGenerator.js';
import { PropertyGraphExporter } from '../export/PropertyGraphExporter.js';

/**
 * Main Knowledge Graph System with complete functionality
 */
export class KnowledgeGraphSystem {
  constructor() {
    this.engine = new KGEngine();
    this.namespaceManager = new NamespaceManager();
    this.rdfSerializer = new RDFSerializer(this.engine, this.namespaceManager);
    this.rdfParser = new RDFParser(this.engine, this.namespaceManager);
    this.objectReconstructor = new ObjectReconstructor(this.engine, this.namespaceManager);
    this.toolRegistry = new KGToolRegistry(this.engine);
    this.schemaGenerator = new KGSchemaGenerator(this.engine);
    this.jsonSchemaGenerator = new JSONSchemaGenerator(this.engine);
    this.toolDependencyManager = new ToolDependencyManager(this.engine);
    this.propertyGraphExporter = new PropertyGraphExporter(this.engine);
    this.idManager = idManager;
  }

  /**
   * Create a query builder
   */
  query() {
    return new QueryBuilder(this.engine);
  }

  /**
   * Register a tool with dependencies
   */
  registerTool(ToolClass, metadata) {
    const toolId = this.toolRegistry.registerTool(ToolClass, metadata);
    
    // Handle dependencies
    if (metadata.dependencies) {
      metadata.dependencies.forEach(dep => {
        this.toolDependencyManager.addToolDependency(ToolClass, dep.tool, dep.type || 'dependsOn');
      });
    }

    // Handle method subgoals
    if (metadata.methods) {
      Object.entries(metadata.methods).forEach(([methodName, methodMeta]) => {
        if (methodMeta.subgoals) {
          const methodId = idManager.generateMethodId(ToolClass.name, methodName);
          methodMeta.subgoals.forEach(subgoal => {
            this.toolDependencyManager.addSubgoal(methodId, subgoal);
          });
        }
      });
    }

    return toolId;
  }

  /**
   * Generate tool schemas for LLMs
   */
  generateToolSchemas() {
    return this.schemaGenerator.generateAllToolSchemas();
  }

  /**
   * Generate JSON schemas for classes
   */
  generateJSONSchemas() {
    return this.jsonSchemaGenerator.generateAllClassSchemas();
  }

  /**
   * Generate OpenAPI schemas
   */
  generateOpenAPISchemas() {
    return this.jsonSchemaGenerator.generateOpenAPISchemas();
  }

  /**
   * Find tools by various criteria
   */
  findTools(criteria) {
    if (criteria.capability) {
      return this.toolRegistry.findToolsByCapability(criteria.capability);
    }
    if (criteria.goal) {
      return this.toolRegistry.findToolsByGoal(criteria.goal);
    }
    return this.toolRegistry.getAvailableTools(criteria.context || {});
  }

  /**
   * Check if a goal can be achieved with available tools
   */
  canAchieveGoal(goal, availableTools) {
    return this.toolDependencyManager.canAchieveGoal(goal, availableTools);
  }

  /**
   * Add object to knowledge graph
   */
  addObject(obj) {
    const triples = obj.toTriples();
    triples.forEach(([s, p, o]) => {
      this.engine.addTriple(s, p, o);
    });
    return obj.getId();
  }

  /**
   * Add relationship to knowledge graph
   */
  addRelationship(relationship) {
    const triples = relationship.toTriples();
    triples.forEach(([s, p, o]) => {
      this.engine.addTriple(s, p, o);
    });
    return relationship.getId();
  }

  /**
   * Add belief to knowledge graph
   */
  addBelief(belief) {
    const triples = belief.toTriples();
    triples.forEach(([s, p, o]) => {
      this.engine.addTriple(s, p, o);
    });
    return belief.getId();
  }

  /**
   * Add method execution record
   */
  addMethodExecution(execution) {
    const triples = execution.toTriples();
    triples.forEach(([s, p, o]) => {
      this.engine.addTriple(s, p, o);
    });
    return execution.getId();
  }

  /**
   * Reconstruct object from KG
   */
  getObject(objectId) {
    return this.objectReconstructor.reconstructObject(objectId);
  }

  /**
   * Reconstruct class from KG
   */
  getClass(classId) {
    return this.objectReconstructor.reconstructClass(classId);
  }

  /**
   * Export to various RDF formats
   */
  exportToTurtle() {
    return this.rdfSerializer.toTurtle();
  }

  exportToNTriples() {
    return this.rdfSerializer.toNTriples();
  }

  exportToJsonLD() {
    return this.rdfSerializer.toJsonLD();
  }

  exportToRDFXML() {
    return this.rdfSerializer.toRDFXML();
  }

  /**
   * Export to property graph formats
   */
  exportToCypher() {
    return this.propertyGraphExporter.toCypher();
  }

  exportToGraphML() {
    return this.propertyGraphExporter.toGraphML();
  }

  /**
   * Import from various RDF formats
   */
  importFromTurtle(turtleString) {
    this.rdfParser.parseTurtle(turtleString);
  }

  importFromNTriples(ntriplesString) {
    this.rdfParser.parseNTriples(ntriplesString);
  }

  importFromJsonLD(jsonldData) {
    this.rdfParser.parseJsonLD(jsonldData);
  }

  /**
   * Schema evolution - add property to existing class
   */
  evolveSchema(classId, changes) {
    if (changes.addProperty) {
      const { name, type, required = false, description } = changes.addProperty;
      const propId = idManager.generatePropertyId(classId, name);
      
      this.engine.addTriple(classId, 'kg:hasProperty', propId);
      this.engine.addTriple(propId, 'rdf:type', 'kg:Property');
      this.engine.addTriple(propId, 'kg:propertyName', name);
      this.engine.addTriple(propId, 'kg:hasType', type);
      this.engine.addTriple(propId, 'kg:required', required);
      
      if (description) {
        this.engine.addTriple(propId, 'kg:description', description);
      }
    }

    if (changes.addMethod) {
      // Implementation for adding methods dynamically
      const { name, parameters = [], returnType, goal, effect } = changes.addMethod;
      const methodId = idManager.generateMethodId(classId, name);
      
      this.engine.addTriple(methodId, 'rdf:type', 'kg:InstanceMethod');
      this.engine.addTriple(methodId, 'kg:methodOf', classId);
      this.engine.addTriple(methodId, 'kg:methodName', name);
      
      if (returnType) {
        this.engine.addTriple(methodId, 'kg:hasReturnType', returnType);
      }
      if (goal) {
        this.engine.addTriple(methodId, 'kg:hasGoal', goal);
      }
      if (effect) {
        this.engine.addTriple(methodId, 'kg:hasEffect', effect);
      }
    }
  }

  /**
   * Full round-trip test
   */
  roundTripTest(obj) {
    // 1. Object → KG
    const originalId = this.addObject(obj);
    
    // 2. KG → RDF
    const turtle = this.exportToTurtle();
    
    // 3. Clear KG
    this.engine = new KGEngine();
    this.rdfSerializer = new RDFSerializer(this.engine, this.namespaceManager);
    this.rdfParser = new RDFParser(this.engine, this.namespaceManager);
    this.objectReconstructor = new ObjectReconstructor(this.engine, this.namespaceManager);
    
    // 4. RDF → KG
    this.importFromTurtle(turtle);
    
    // 5. KG → Object
    const reconstructed = this.getObject(originalId);
    
    return { original: obj, reconstructed, turtle };
  }
}
