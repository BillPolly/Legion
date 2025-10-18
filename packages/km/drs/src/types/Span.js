/**
 * Span - Character offsets in the original text (half-open intervals)
 */
export class Span {
  /**
   * @param {number} start - Inclusive start offset
   * @param {number} end - Exclusive end offset
   */
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}
