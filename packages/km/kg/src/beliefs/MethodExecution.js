/**
 * Represents temporal execution of methods
 */
export class MethodExecution {
  constructor(method, caller, args = [], data = {}) {
    this.method = method;
    this.caller = caller;
    this.args = args;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.succeeded = data.succeeded;
    this.result = data.result;
    this.duration = data.duration;
  }

  toTriples() {
    const executionId = this.getId();
    const triples = [];

    triples.push([executionId, 'rdf:type', 'kg:MethodExecution']);
    triples.push([executionId, 'kg:methodCall', this.method]);
    triples.push([executionId, 'kg:caller', this.caller.getId()]);
    triples.push([executionId, 'kg:timestamp', this.timestamp]);
    
    if (this.succeeded !== undefined) {
      triples.push([executionId, 'kg:succeeded', this.succeeded]);
    }
    if (this.result !== undefined) {
      triples.push([executionId, 'kg:result', this.result]);
    }
    if (this.duration !== undefined) {
      triples.push([executionId, 'kg:duration', this.duration]);
    }

    // Add arguments
    this.args.forEach((arg, index) => {
      const argValue = arg.getId ? arg.getId() : arg;
      triples.push([executionId, `kg:arg_${index}`, argValue]);
    });

    return triples;
  }
}
