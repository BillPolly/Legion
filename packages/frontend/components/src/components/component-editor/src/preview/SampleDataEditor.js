/**
 * SampleDataEditor - Inline editor for sample data
 * Phase 6.3
 *
 * Provides input fields for editing sample data based on schema
 */

export class SampleDataEditor {
  constructor(container, dataModel) {
    this.container = container;
    this.dataModel = dataModel;
    this.render();
  }

  /**
   * Render sample data editor UI
   */
  render() {
    const schema = this.dataModel.schema;
    const sample = this.dataModel.sampleData || {};
    const properties = schema.properties || {};

    this.container.innerHTML = `
      <div class="sample-data-editor">
        <h4>Sample Data</h4>
        ${Object.entries(properties).map(([field, def]) => `
          <div class="sample-field">
            <label>${this._escapeHtml(field)}</label>
            <input
              type="${this.getInputType(def.type)}"
              name="${this._escapeHtml(field)}"
              value="${this._escapeHtml(sample[field] || '')}"
              placeholder="${this._escapeHtml(def.description || '')}"
              ${def.type === 'boolean' && sample[field] ? 'checked' : ''}
            />
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Get HTML input type for schema type
   *
   * @param {string} schemaType - Schema type (string, number, boolean, date)
   * @returns {string} HTML input type
   */
  getInputType(schemaType) {
    const typeMap = {
      string: 'text',
      number: 'number',
      boolean: 'checkbox',
      date: 'date'
    };
    return typeMap[schemaType] || 'text';
  }

  /**
   * Get current sample data from input fields
   *
   * @returns {object} Current sample data
   */
  getSampleData() {
    const inputs = this.container.querySelectorAll('input');
    const data = {};

    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        data[input.name] = input.checked;
      } else {
        data[input.name] = input.value;
      }
    });

    return data;
  }

  /**
   * Attach change handler for sample data updates
   *
   * @param {function} callback - Called when data changes
   */
  onDataChange(callback) {
    this.container.addEventListener('input', () => {
      callback(this.getSampleData());
    });
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  _escapeHtml(text) {
    if (text === null || text === undefined) {
      return '';
    }
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }
}
