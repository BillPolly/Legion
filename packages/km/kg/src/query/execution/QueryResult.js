/**
 * Query Result System
 */
export class QueryResult {
  constructor(query, bindings = [], variableNames = []) {
    this.query = query;
    this.bindings = bindings;
    this.variableNames = variableNames;
    this.executionTime = 0;
    this.metadata = {};
    this.pageInfo = null;
    this._kgId = `result_${Math.random().toString(36).substr(2, 9)}`;
  }

  getId() {
    return this._kgId;
  }

  size() {
    return this.bindings.length;
  }

  isEmpty() {
    return this.bindings.length === 0;
  }

  first() {
    return this.bindings.length > 0 ? this.bindings[0] : null;
  }

  getBinding(index) {
    if (index < 0 || index >= this.bindings.length) {
      return undefined;
    }
    return this.bindings[index];
  }

  // Iterator support
  [Symbol.iterator]() {
    return this.bindings[Symbol.iterator]();
  }

  map(fn) {
    return this.bindings.map(fn);
  }

  filter(fn) {
    const filteredBindings = this.bindings.filter(fn);
    return new QueryResult(this.query, filteredBindings, this.variableNames);
  }

  project(variables) {
    const projectedBindings = this.bindings.map(binding => {
      const newBinding = new Map();
      for (const variable of variables) {
        if (binding.has(variable)) {
          newBinding.set(variable, binding.get(variable));
        }
      }
      return newBinding;
    });
    return new QueryResult(this.query, projectedBindings, variables);
  }

  distinct() {
    const seen = new Set();
    const distinctBindings = [];
    
    for (const binding of this.bindings) {
      const key = JSON.stringify([...binding.entries()].sort());
      if (!seen.has(key)) {
        seen.add(key);
        distinctBindings.push(binding);
      }
    }
    
    return new QueryResult(this.query, distinctBindings, this.variableNames);
  }

  orderBy(field, direction = 'ASC') {
    if (typeof field === 'function') {
      // Custom comparator function
      const sortedBindings = [...this.bindings].sort(field);
      return new QueryResult(this.query, sortedBindings, this.variableNames);
    }
    
    if (Array.isArray(field)) {
      // Multi-field sorting
      const sortedBindings = [...this.bindings].sort((a, b) => {
        for (const f of field) {
          const aVal = a.get(f);
          const bVal = b.get(f);
          
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
        }
        return 0;
      });
      return new QueryResult(this.query, sortedBindings, this.variableNames);
    }
    
    // Single field sorting
    const sortedBindings = [...this.bindings].sort((a, b) => {
      const aVal = a.get(field);
      const bVal = b.get(field);
      
      if (direction === 'DESC') {
        if (aVal > bVal) return -1;
        if (aVal < bVal) return 1;
      } else {
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
      }
      return 0;
    });
    
    return new QueryResult(this.query, sortedBindings, this.variableNames);
  }

  sort(compareFn) {
    const sortedBindings = [...this.bindings].sort(compareFn);
    return new QueryResult(this.query, sortedBindings, this.variableNames);
  }

  limit(count) {
    if (count < 0) count = 0;
    const limitedBindings = this.bindings.slice(0, count);
    return new QueryResult(this.query, limitedBindings, this.variableNames);
  }

  offset(start) {
    if (start < 0) start = 0;
    const offsetBindings = this.bindings.slice(start);
    return new QueryResult(this.query, offsetBindings, this.variableNames);
  }

  paginate(pageSize, pageNumber) {
    const totalItems = this.bindings.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const offset = pageNumber * pageSize;
    const paginatedBindings = this.bindings.slice(offset, offset + pageSize);
    
    const result = new QueryResult(this.query, paginatedBindings, this.variableNames);
    result.pageInfo = {
      pageSize,
      currentPage: pageNumber,
      totalItems,
      totalPages,
      hasNextPage: pageNumber < totalPages - 1,
      hasPreviousPage: pageNumber > 0
    };
    
    return result;
  }

  toArray() {
    return this.bindings.map(binding => {
      const obj = {};
      binding.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    });
  }

  toObjects() {
    return this.toArray();
  }

  toJSON() {
    return {
      bindings: this.bindings.map(binding => {
        if (binding instanceof Map) {
          return Object.fromEntries(binding);
        } else {
          return binding;
        }
      }),
      variableNames: this.variableNames,
      size: this.size(),
      executionTime: this.executionTime,
      metadata: this.metadata
    };
  }

  serialize() {
    return JSON.stringify(this.toJSON());
  }

  static deserialize(serialized) {
    const data = JSON.parse(serialized);
    const bindings = data.bindings.map(obj => new Map(Object.entries(obj)));
    const result = new QueryResult(null, bindings, data.variableNames);
    result.executionTime = data.executionTime || 0;
    result.metadata = data.metadata || {};
    return result;
  }

  toCSV() {
    if (this.isEmpty()) return '';
    
    const header = this.variableNames.join(',');
    const rows = this.bindings.map(binding => {
      return this.variableNames.map(varName => {
        const value = binding.get(varName);
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });
    
    return [header, ...rows].join('\n');
  }

  toTSV() {
    if (this.isEmpty()) return '';
    
    const header = this.variableNames.join('\t');
    const rows = this.bindings.map(binding => {
      return this.variableNames.map(varName => binding.get(varName)).join('\t');
    });
    
    return [header, ...rows].join('\n');
  }

  toXML() {
    let xml = '<result>\n';
    
    for (const binding of this.bindings) {
      xml += '  <binding>\n';
      for (const [variable, value] of binding) {
        xml += `    <${variable}>${this.escapeXml(value)}</${variable}>\n`;
      }
      xml += '  </binding>\n';
    }
    
    xml += '</result>';
    return xml;
  }

  escapeXml(value) {
    if (typeof value !== 'string') return value;
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  toTriples(options = {}) {
    const id = this.getId();
    const triples = [];

    triples.push([id, 'rdf:type', 'kg:QueryResult']);
    if (this.query) {
      triples.push([id, 'kg:resultOf', this.query.getId()]);
    }
    triples.push([id, 'kg:resultCount', this.bindings.length]);
    triples.push([id, 'kg:executionTime', this.executionTime]);

    if (options.includeMetadata) {
      triples.push([id, 'kg:queryType', this.query?.constructor?.name || 'Unknown']);
      triples.push([id, 'kg:variableCount', this.variableNames.length]);
      
      this.variableNames.forEach(varName => {
        triples.push([id, 'kg:hasVariable', varName]);
      });
    }

    this.bindings.forEach((binding, index) => {
      const bindingId = `${id}_binding_${index}`;
      triples.push([id, 'kg:hasBinding', bindingId]);
      triples.push([bindingId, 'rdf:type', 'kg:ResultBinding']);
      triples.push([bindingId, 'kg:bindingIndex', index]);

      binding.forEach((value, variable) => {
        triples.push([bindingId, 'kg:bindsVariable', variable]);
        triples.push([bindingId, 'kg:boundValue', value]);
        
        if (options.includeTypes) {
          triples.push([bindingId, 'kg:valueType', typeof value]);
        }
      });
    });

    return triples;
  }
}

export default QueryResult;
