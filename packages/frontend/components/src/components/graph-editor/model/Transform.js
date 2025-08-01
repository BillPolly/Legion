/**
 * Transform - 2D affine transformation for graph elements
 * 
 * Represents position, scale, and rotation using a 2D affine transformation matrix.
 * Matrix format: [a, b, c, d, tx, ty] where:
 * - a, d: scale x, y
 * - b, c: rotation/skew
 * - tx, ty: translation x, y
 */

export class Transform {
  constructor(config = {}) {
    this._position = { x: config.position?.x || 0, y: config.position?.y || 0 };
    this._scale = { x: config.scale?.x || 1, y: config.scale?.y || 1 };
    this._rotation = config.rotation || 0; // Degrees
    
    this._matrix = [1, 0, 0, 1, 0, 0]; // Identity matrix
    this._dirty = true;
  }

  /**
   * Get position
   */
  getPosition() {
    return { ...this._position };
  }

  /**
   * Set position
   */
  setPosition(x, y) {
    this._position.x = x;
    this._position.y = y;
    this._dirty = true;
  }

  /**
   * Translate by delta
   */
  translate(dx, dy) {
    this._position.x += dx;
    this._position.y += dy;
    this._dirty = true;
  }

  /**
   * Get scale
   */
  getScale() {
    return { ...this._scale };
  }

  /**
   * Set scale
   */
  setScale(x, y = x) {
    this._scale.x = x;
    this._scale.y = y;
    this._dirty = true;
  }

  /**
   * Scale by factor
   */
  scale(sx, sy = sx) {
    this._scale.x *= sx;
    this._scale.y *= sy;
    this._dirty = true;
  }

  /**
   * Get rotation in degrees
   */
  getRotation() {
    return this._rotation;
  }

  /**
   * Set rotation in degrees
   */
  setRotation(degrees) {
    // Normalize to 0-360 range
    this._rotation = ((degrees % 360) + 360) % 360;
    this._dirty = true;
  }

  /**
   * Rotate by delta degrees
   */
  rotate(delta) {
    this.setRotation(this._rotation + delta);
  }

  /**
   * Get the transformation matrix
   */
  getMatrix() {
    if (this._dirty) {
      this._updateMatrix();
    }
    return [...this._matrix];
  }

  /**
   * Set the transformation matrix directly
   */
  setMatrix(matrix) {
    this._matrix = [...matrix];
    this._extractFromMatrix();
    this._dirty = false;
  }

  /**
   * Update the matrix from position, scale, rotation
   * @private
   */
  _updateMatrix() {
    const rad = (this._rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // Combine scale and rotation
    // Use +0 to avoid -0 in JavaScript
    this._matrix[0] = this._scale.x * cos;
    this._matrix[1] = this._scale.x * sin;
    this._matrix[2] = -this._scale.y * sin || 0; // Convert -0 to 0
    this._matrix[3] = this._scale.y * cos;
    this._matrix[4] = this._position.x;
    this._matrix[5] = this._position.y;
    
    this._dirty = false;
  }

  /**
   * Extract position, scale, rotation from matrix
   * @private
   */
  _extractFromMatrix() {
    const [a, b, c, d, tx, ty] = this._matrix;
    
    // Extract translation
    this._position.x = tx;
    this._position.y = ty;
    
    // Extract scale
    this._scale.x = Math.sqrt(a * a + b * b);
    this._scale.y = Math.sqrt(c * c + d * d);
    
    // Extract rotation
    const rotation = Math.atan2(b, a);
    this._rotation = ((rotation * 180 / Math.PI) % 360 + 360) % 360;
  }

  /**
   * Transform a point from local to world coordinates
   */
  transformPoint(point) {
    const matrix = this.getMatrix();
    const [a, b, c, d, tx, ty] = matrix;
    
    return {
      x: a * point.x + c * point.y + tx,
      y: b * point.x + d * point.y + ty
    };
  }

  /**
   * Transform a point from world to local coordinates
   */
  inverseTransformPoint(point) {
    const matrix = this.getMatrix();
    const [a, b, c, d, tx, ty] = matrix;
    
    // Calculate determinant
    const det = a * d - b * c;
    if (Math.abs(det) < 0.000001) {
      return { x: 0, y: 0 }; // Singular matrix
    }
    
    // Inverse matrix elements
    const ia = d / det;
    const ib = -b / det;
    const ic = -c / det;
    const id = a / det;
    const itx = (c * ty - d * tx) / det;
    const ity = (b * tx - a * ty) / det;
    
    return {
      x: ia * point.x + ic * point.y + itx,
      y: ib * point.x + id * point.y + ity
    };
  }

  /**
   * Transform bounds
   */
  transformBounds(bounds) {
    // Transform all four corners
    const corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height }
    ];
    
    const transformed = corners.map(p => this.transformPoint(p));
    
    // Find bounding box of transformed corners
    const xs = transformed.map(p => p.x);
    const ys = transformed.map(p => p.y);
    
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Reset to identity transform
   */
  reset() {
    this._position = { x: 0, y: 0 };
    this._scale = { x: 1, y: 1 };
    this._rotation = 0;
    this._matrix = [1, 0, 0, 1, 0, 0];
    this._dirty = false;
  }

  /**
   * Clone this transform
   */
  clone() {
    return new Transform({
      position: { ...this._position },
      scale: { ...this._scale },
      rotation: this._rotation
    });
  }

  /**
   * Check if this is an identity transform
   */
  isIdentity() {
    return (
      this._position.x === 0 &&
      this._position.y === 0 &&
      this._scale.x === 1 &&
      this._scale.y === 1 &&
      this._rotation === 0
    );
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      position: { ...this._position },
      scale: { ...this._scale },
      rotation: this._rotation
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json) {
    return new Transform(json);
  }

  /**
   * Multiply two transforms (parent * child)
   */
  static multiply(parent, child) {
    const pm = parent.getMatrix();
    const cm = child.getMatrix();
    
    // Matrix multiplication
    const result = new Transform();
    result.setMatrix([
      pm[0] * cm[0] + pm[2] * cm[1],
      pm[1] * cm[0] + pm[3] * cm[1],
      pm[0] * cm[2] + pm[2] * cm[3],
      pm[1] * cm[2] + pm[3] * cm[3],
      pm[0] * cm[4] + pm[2] * cm[5] + pm[4],
      pm[1] * cm[4] + pm[3] * cm[5] + pm[5]
    ]);
    
    return result;
  }

  /**
   * Interpolate between two transforms
   */
  static interpolate(from, to, t) {
    const fromPos = from.getPosition();
    const toPos = to.getPosition();
    const fromScale = from.getScale();
    const toScale = to.getScale();
    
    return new Transform({
      position: {
        x: fromPos.x + (toPos.x - fromPos.x) * t,
        y: fromPos.y + (toPos.y - fromPos.y) * t
      },
      scale: {
        x: fromScale.x + (toScale.x - fromScale.x) * t,
        y: fromScale.y + (toScale.y - fromScale.y) * t
      },
      rotation: from.getRotation() + (to.getRotation() - from.getRotation()) * t
    });
  }
}