/**
 * Exports KG to property graph formats (e.g., Cypher for Neo4j)
 */
export class PropertyGraphExporter {
  constructor(kgEngine) {
    this.kg = kgEngine;
  }

  /**
   * Export to Cypher CREATE statements
   */
  toCypher() {
    const nodes = new Map();
    const relationships = [];
    
    // Collect all triples
    const triples = this.kg.query('?', '?', '?');
    
    // Separate nodes and relationships
    triples.forEach(([subject, predicate, object]) => {
      // Add subject as node
      if (!nodes.has(subject)) {
        nodes.set(subject, this._getNodeProperties(subject));
      }
      
      // If object is a node (has properties), add it
      if (this._isNode(object)) {
        if (!nodes.has(object)) {
          nodes.set(object, this._getNodeProperties(object));
        }
        
        // Add relationship
        relationships.push({
          from: subject,
          to: object,
          type: predicate,
          properties: this._getRelationshipProperties(subject, predicate, object)
        });
      } else {
        // Object is a literal, add as node property
        if (!nodes.get(subject).properties[predicate]) {
          nodes.get(subject).properties[predicate] = object;
        }
      }
    });

    let cypher = '';
    
    // Create nodes
    for (const [nodeId, nodeData] of nodes) {
      const labels = nodeData.labels.map(l => `:${l}`).join('');
      const props = this._formatCypherProperties(nodeData.properties);
      cypher += `CREATE (${this._sanitizeId(nodeId)}${labels} ${props})\n`;
    }
    
    // Create relationships
    relationships.forEach(rel => {
      const props = Object.keys(rel.properties).length > 0 ? 
        ` ${this._formatCypherProperties(rel.properties)}` : '';
      cypher += `CREATE (${this._sanitizeId(rel.from)})-[:${rel.type}${props}]->(${this._sanitizeId(rel.to)})\n`;
    });

    return cypher;
  }

  /**
   * Export to GraphML format
   */
  toGraphML() {
    const nodes = new Map();
    const edges = [];
    
    const triples = this.kg.query('?', '?', '?');
    
    triples.forEach(([subject, predicate, object]) => {
      if (!nodes.has(subject)) {
        nodes.set(subject, this._getNodeProperties(subject));
      }
      
      if (this._isNode(object)) {
        if (!nodes.has(object)) {
          nodes.set(object, this._getNodeProperties(object));
        }
        edges.push({ source: subject, target: object, label: predicate });
      }
    });

    let graphml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    graphml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
    graphml += '  <graph id="KG" edgedefault="directed">\n';
    
    // Add nodes
    for (const [nodeId, nodeData] of nodes) {
      graphml += `    <node id="${nodeId}">\n`;
      for (const [key, value] of Object.entries(nodeData.properties)) {
        graphml += `      <data key="${key}">${value}</data>\n`;
      }
      graphml += '    </node>\n';
    }
    
    // Add edges
    edges.forEach((edge, index) => {
      graphml += `    <edge id="e${index}" source="${edge.source}" target="${edge.target}">\n`;
      graphml += `      <data key="label">${edge.label}</data>\n`;
      graphml += '    </edge>\n';
    });
    
    graphml += '  </graph>\n';
    graphml += '</graphml>';
    
    return graphml;
  }

  // Helper methods
  _getNodeProperties(nodeId) {
    const properties = {};
    const labels = new Set();
    
    // Get all properties for this node
    const nodeTriples = this.kg.query(nodeId, '?', '?');
    
    nodeTriples.forEach(([, predicate, object]) => {
      if (predicate === 'rdf:type') {
        labels.add(object);
      } else if (!this._isNode(object)) {
        properties[predicate] = object;
      }
    });

    return { labels: Array.from(labels), properties };
  }

  _getRelationshipProperties(subject, predicate, object) {
    // For reified relationships, get additional properties
    const relProps = {};
    
    // Find if this is a reified relationship
    const reifiedRels = this.kg.query('?', 'kg:from', subject)
      .filter(([relId]) => {
        const toTriples = this.kg.query(relId, 'kg:to', object);
        return toTriples.length > 0;
      });

    if (reifiedRels.length > 0) {
      const relId = reifiedRels[0][0];
      const relTriples = this.kg.query(relId, '?', '?');
      
      relTriples.forEach(([, prop, value]) => {
        if (!prop.startsWith('kg:from') && !prop.startsWith('kg:to') && prop !== 'rdf:type') {
          relProps[prop] = value;
        }
      });
    }

    return relProps;
  }

  _isNode(value) {
    return typeof value === 'string' && value.includes('_');
  }

  _sanitizeId(id) {
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  _formatCypherProperties(properties) {
    const props = Object.entries(properties)
      .map(([key, value]) => `${key}: ${this._formatCypherValue(value)}`)
      .join(', ');
    return `{${props}}`;
  }

  _formatCypherValue(value) {
    if (typeof value === 'string') {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
}
