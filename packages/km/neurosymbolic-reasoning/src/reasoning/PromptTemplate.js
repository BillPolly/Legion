/**
 * Prompt Template for LLM interaction
 * Handles variable substitution and few-shot examples
 */
export class PromptTemplate {
  /**
   * Create a prompt template
   * @param {string} template - Template string with {{variables}}
   * @param {Array} examples - Optional few-shot examples
   */
  constructor(template, examples = []) {
    if (!template || typeof template !== 'string') {
      throw new Error('Template must be a non-empty string');
    }

    if (!Array.isArray(examples)) {
      throw new Error('Examples must be an array');
    }

    this.template = template;
    this.examples = examples;
    this.exampleFormatter = null;
  }

  /**
   * Render template with variables
   * @param {object} variables - Variables to substitute
   * @returns {string} Rendered template
   */
  render(variables = {}) {
    let result = this.template;

    // Replace {{variable}} with values
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return result;
  }

  /**
   * Add an example to the template
   * @param {object} example - Example object
   * @returns {PromptTemplate} This template (for chaining)
   */
  addExample(example) {
    this.examples.push(example);
    return this;
  }

  /**
   * Set custom example formatter
   * @param {function} formatter - Function(example, index) => string
   */
  setExampleFormatter(formatter) {
    this.exampleFormatter = formatter;
  }

  /**
   * Format a single example
   * @param {object} example - Example to format
   * @param {number} index - Example index
   * @returns {string} Formatted example
   */
  formatExample(example, index) {
    if (this.exampleFormatter) {
      return this.exampleFormatter(example, index);
    }

    // Default formatter
    return this._defaultFormatExample(example, index);
  }

  /**
   * Default example formatter
   * @private
   */
  _defaultFormatExample(example, index) {
    const parts = [];

    // Format each key-value pair
    for (const [key, value] of Object.entries(example)) {
      parts.push(`${key}: ${value}`);
    }

    return parts.join('\n');
  }

  /**
   * Render template with examples included
   * @param {object} variables - Variables to substitute
   * @returns {string} Rendered template with examples
   */
  renderWithExamples(variables = {}) {
    // Format all examples
    const formattedExamples = this.examples
      .map((example, index) => this.formatExample(example, index))
      .join('\n\n');

    // Add examples to variables
    const varsWithExamples = {
      ...variables,
      examples: formattedExamples
    };

    return this.render(varsWithExamples);
  }
}
