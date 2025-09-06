/**
 * Base Path Expression Class
 */
export class PathExpression {
  constructor(type = 'fixed') {
    this.type = type; // 'fixed', 'variable', 'conditional'
    this._kgId = `path_${Math.random().toString(36).substr(2, 9)}`;
  }

  getId() {
    return this._kgId;
  }
}

export default PathExpression;
