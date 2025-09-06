/**
 * Serializes JavaScript classes to KG triples
 */
export class ClassSerializer {
  constructor(idManager) {
    this.idManager = idManager;
  }

  /**
   * Serialize a class to triples
   */
  serializeClass(ClassDef, metadata = {}) {
    const classId = ClassDef.getId();
    const triples = [];

    // Class metadata
    triples.push([classId, 'rdf:type', 'kg:EntityClass']);
    triples.push([classId, 'kg:className', ClassDef.name]);
    
    if (metadata && metadata.namespace) {
      triples.push([classId, 'kg:namespace', metadata.namespace]);
    }

    // Serialize constructor
    if (ClassDef.prototype.constructor) {
      const constructorTriples = this.serializeMethod(
        ClassDef, 
        'constructor', 
        ClassDef.prototype.constructor,
        (metadata && metadata.constructor) || {}
      );
      triples.push(...constructorTriples);
    }

    // Serialize instance methods
    const proto = ClassDef.prototype;
    const methodNames = Object.getOwnPropertyNames(proto)
      .filter(name => name !== 'constructor' && typeof proto[name] === 'function');

    for (const methodName of methodNames) {
      const methodTriples = this.serializeMethod(
        ClassDef,
        methodName, 
        proto[methodName],
        (metadata && metadata.methods?.[methodName]) || {}
      );
      triples.push(...methodTriples);
    }

    // Serialize static methods
    const staticMethodNames = Object.getOwnPropertyNames(ClassDef)
      .filter(name => typeof ClassDef[name] === 'function' && name !== 'name' && name !== 'length');

    for (const methodName of staticMethodNames) {
      const methodTriples = this.serializeMethod(
        ClassDef,
        methodName,
        ClassDef[methodName], 
        (metadata && metadata.staticMethods?.[methodName]) || {},
        true
      );
      triples.push(...methodTriples);
    }

    return triples;
  }

  /**
   * Serialize a method to triples
   */
  serializeMethod(ClassDef, methodName, methodFunc, metadata = {}, isStatic = false) {
    const methodId = this.idManager.generateMethodId(ClassDef.name, methodName);
    const classId = ClassDef.getId();
    const triples = [];

    // Method metadata
    const methodType = methodName === 'constructor' ? 'kg:Constructor' :
                      isStatic ? 'kg:StaticMethod' : 'kg:InstanceMethod';
    
    triples.push([methodId, 'rdf:type', methodType]);
    triples.push([methodId, 'kg:methodName', methodName]);
    
    if (methodName === 'constructor') {
      triples.push([methodId, 'kg:constructorOf', classId]);
    } else if (isStatic) {
      triples.push([methodId, 'kg:staticMethodOf', classId]);
    } else {
      triples.push([methodId, 'kg:methodOf', classId]);
    }

    // Method body (if needed for reconstruction)
    if (metadata.includeBody) {
      triples.push([methodId, 'kg:methodBody', methodFunc.toString()]);
    }

    // Method semantics from metadata
    if (metadata.goal) {
      triples.push([methodId, 'kg:hasGoal', metadata.goal]);
    }
    if (metadata.effect) {
      triples.push([methodId, 'kg:hasEffect', metadata.effect]);
    }
    if (metadata.preconditions) {
      metadata.preconditions.forEach(condition => {
        triples.push([methodId, 'kg:hasPrecondition', condition]);
      });
    }
    if (metadata.capabilities) {
      metadata.capabilities.forEach(capability => {
        triples.push([methodId, 'kg:requiresCapability', capability]);
      });
    }

    // Parameter serialization
    if (metadata.parameters) {
      metadata.parameters.forEach((param, index) => {
        const paramId = `${methodId}_${param.name}`;
        triples.push([paramId, 'rdf:type', 'kg:Parameter']);
        triples.push([paramId, 'kg:parameterOf', methodId]);
        triples.push([paramId, 'kg:parameterIndex', index]);
        triples.push([paramId, 'kg:parameterName', param.name]);
        triples.push([paramId, 'kg:hasType', param.type]);
        
        if (param.required !== undefined) {
          triples.push([paramId, 'kg:isRequired', param.required]);
        }
        if (param.defaultValue !== undefined) {
          triples.push([paramId, 'kg:defaultValue', param.defaultValue]);
        }
        if (param.description) {
          triples.push([paramId, 'kg:description', param.description]);
        }
        if (param.allowedValues) {
          param.allowedValues.forEach(value => {
            triples.push([paramId, 'kg:allowedValue', value]);
          });
        }
      });
    }

    // Return type
    if (metadata.returnType) {
      triples.push([methodId, 'kg:hasReturnType', metadata.returnType]);
    }

    return triples;
  }
}
