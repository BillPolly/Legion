/**
 * CSSGenerator - Generates CSS stylesheets and rules
 * 
 * Creates CSS files, stylesheets, responsive layouts, animations,
 * and theme systems based on design specifications.
 */

class CSSGenerator {
  constructor(config = {}) {
    this.config = {
      format: 'expanded', // 'expanded', 'compact', 'compressed'
      indentation: 2,
      quotes: 'double', // 'single', 'double'
      semicolons: true,
      vendorPrefixes: true,
      minify: false,
      sourceMaps: false,
      framework: null, // 'bootstrap', 'tailwind', 'bulma', etc.
      methodology: 'bem', // 'bem', 'atomic', 'smacss', 'oocss'
      units: 'rem', // 'px', 'rem', 'em', '%'
      ...config
    };

    // CSS properties that require vendor prefixes
    this.vendorPrefixProperties = new Set([
      'transform', 'transition', 'animation', 'box-shadow', 'border-radius',
      'user-select', 'appearance', 'backdrop-filter', 'clip-path'
    ]);

    // Common breakpoints for responsive design
    this.breakpoints = {
      xs: '480px',
      sm: '768px',
      md: '1024px',
      lg: '1200px',
      xl: '1440px',
      ...config.breakpoints
    };

    // CSS color utilities
    this.colors = {
      primary: '#007bff',
      secondary: '#6c757d',
      success: '#28a745',
      danger: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8',
      light: '#f8f9fa',
      dark: '#343a40',
      ...config.colors
    };

    // Style cache for performance
    this.styleCache = new Map();
  }

  /**
   * Generate complete CSS stylesheet
   * 
   * @param {Object} spec - CSS specification
   * @returns {Promise<string>} Generated CSS
   */
  async generateStylesheet(spec) {
    const validation = await this.validateSpec(spec);
    if (!validation.isValid) {
      throw new Error(`Invalid CSS spec: ${validation.errors.join(', ')}`);
    }

    const parts = [];

    // Add CSS header comment
    if (spec.header) {
      parts.push(this._generateHeader(spec));
    }

    // Add CSS custom properties (variables)
    if (spec.variables) {
      parts.push(this._generateVariables(spec.variables));
    }

    // Add CSS reset/normalize
    if (spec.reset) {
      parts.push(this._generateReset(spec.reset));
    }

    // Add base styles
    if (spec.base) {
      parts.push(this._generateBaseStyles(spec.base));
    }

    // Add utility classes
    if (spec.utilities) {
      parts.push(this._generateUtilities(spec.utilities));
    }

    // Add component styles
    if (spec.components) {
      for (const component of spec.components) {
        parts.push(await this.generateComponent(component));
      }
    }

    // Add layout styles
    if (spec.layout) {
      parts.push(this._generateLayout(spec.layout));
    }

    // Add responsive styles
    if (spec.responsive) {
      parts.push(this._generateResponsive(spec.responsive));
    }

    // Add animations
    if (spec.animations) {
      parts.push(this._generateAnimations(spec.animations));
    }

    // Add theme styles
    if (spec.themes) {
      parts.push(this._generateThemes(spec.themes));
    }

    const css = parts.filter(Boolean).join('\n\n');
    
    return this.config.minify ? this._minifyCSS(css) : css;
  }

  /**
   * Generate component styles
   * 
   * @param {Object} componentSpec - Component specification
   * @returns {Promise<string>} Generated component CSS
   */
  async generateComponent(componentSpec) {
    const {
      name,
      selector,
      styles = {},
      variants = {},
      states = {},
      modifiers = {},
      responsive = {}
    } = componentSpec;

    const parts = [];
    const baseSelector = selector || this._generateSelector(name);

    // Add component comment
    parts.push(`/* ${name} Component */`);

    // Base component styles
    if (Object.keys(styles).length > 0) {
      parts.push(this._generateRule(baseSelector, styles));
    }

    // Component variants (e.g., .button--large, .button--small)
    for (const [variant, variantStyles] of Object.entries(variants)) {
      const variantSelector = this._generateVariantSelector(baseSelector, variant);
      parts.push(this._generateRule(variantSelector, variantStyles));
    }

    // Component states (e.g., :hover, :focus, :active)
    for (const [state, stateStyles] of Object.entries(states)) {
      const stateSelector = `${baseSelector}:${state}`;
      parts.push(this._generateRule(stateSelector, stateStyles));
    }

    // Component modifiers (e.g., .button.is-disabled)
    for (const [modifier, modifierStyles] of Object.entries(modifiers)) {
      const modifierSelector = this._generateModifierSelector(baseSelector, modifier);
      parts.push(this._generateRule(modifierSelector, modifierStyles));
    }

    // Responsive styles
    if (Object.keys(responsive).length > 0) {
      parts.push(this._generateComponentResponsive(baseSelector, responsive));
    }

    return parts.join('\n\n');
  }

  /**
   * Generate responsive layout
   * 
   * @param {Object} layoutSpec - Layout specification
   * @returns {Promise<string>} Generated layout CSS
   */
  async generateLayout(layoutSpec) {
    const {
      type = 'flexbox', // 'flexbox', 'grid', 'float'
      container = {},
      columns = 12,
      gutters = '1rem',
      responsive = true
    } = layoutSpec;

    const parts = [];
    parts.push('/* Layout System */');

    if (type === 'flexbox') {
      parts.push(this._generateFlexboxLayout(container, columns, gutters, responsive));
    } else if (type === 'grid') {
      parts.push(this._generateGridLayout(container, columns, gutters, responsive));
    }

    return parts.join('\n\n');
  }

  /**
   * Generate CSS animations and keyframes
   * 
   * @param {Object} animationSpec - Animation specification
   * @returns {Promise<string>} Generated animation CSS
   */
  async generateAnimations(animationSpec) {
    const parts = [];
    parts.push('/* Animations */');

    // Generate keyframes
    if (animationSpec.keyframes) {
      for (const [name, frames] of Object.entries(animationSpec.keyframes)) {
        parts.push(this._generateKeyframes(name, frames));
      }
    }

    // Generate animation utilities
    if (animationSpec.utilities) {
      for (const [name, props] of Object.entries(animationSpec.utilities)) {
        const selector = `.animate-${name}`;
        parts.push(this._generateRule(selector, props));
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Generate theme variations
   * 
   * @param {Object} themeSpec - Theme specification
   * @returns {Promise<string>} Generated theme CSS
   */
  async generateThemes(themeSpec) {
    const parts = [];
    parts.push('/* Themes */');

    for (const [themeName, themeVars] of Object.entries(themeSpec)) {
      const themeSelector = `[data-theme="${themeName}"], .theme-${themeName}`;
      parts.push(this._generateRule(themeSelector, this._convertToCustomProperties(themeVars)));
    }

    return parts.join('\n\n');
  }

  /**
   * Validate CSS specification
   * 
   * @param {Object} spec - Specification to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateSpec(spec) {
    const errors = [];

    if (!spec || typeof spec !== 'object') {
      errors.push('Specification must be an object');
      return { isValid: false, errors };
    }

    // Validate components
    if (spec.components) {
      if (!Array.isArray(spec.components)) {
        errors.push('Components must be an array');
      } else {
        spec.components.forEach((component, index) => {
          if (!component.name) {
            errors.push(`Component at index ${index} missing name`);
          }
        });
      }
    }

    // Validate color values
    if (spec.variables && spec.variables.colors) {
      for (const [name, value] of Object.entries(spec.variables.colors)) {
        if (!this._isValidColor(value)) {
          errors.push(`Invalid color value for ${name}: ${value}`);
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  // Private helper methods

  _generateHeader(spec) {
    const lines = [];
    lines.push('/**');
    
    if (spec.description) {
      lines.push(` * ${spec.description}`);
    } else if (spec.name) {
      lines.push(` * ${spec.name} - Generated CSS stylesheet`);
    }
    
    if (spec.author) lines.push(` * @author ${spec.author}`);
    if (spec.version) lines.push(` * @version ${spec.version}`);
    
    lines.push(` * @generated ${new Date().toISOString()}`);
    lines.push(' */');
    
    return lines.join('\n');
  }

  _generateVariables(variables) {
    const parts = [];
    parts.push('/* CSS Custom Properties */');
    parts.push(':root {');

    for (const [category, values] of Object.entries(variables)) {
      parts.push(`  /* ${category} */`);
      for (const [name, value] of Object.entries(values)) {
        parts.push(`  --${category}-${name}: ${value};`);
      }
      parts.push('');
    }

    parts.push('}');
    return parts.join('\n');
  }

  _generateReset(resetType) {
    const resets = {
      normalize: this._getNormalizeCSS(),
      reset: this._getResetCSS(),
      modern: this._getModernResetCSS()
    };

    return resets[resetType] || resets.modern;
  }

  _generateBaseStyles(baseSpec) {
    const parts = [];
    parts.push('/* Base Styles */');

    const baseSelectors = {
      html: baseSpec.html || {},
      body: baseSpec.body || {},
      'h1, h2, h3, h4, h5, h6': baseSpec.headings || {},
      'p': baseSpec.paragraphs || {},
      'a': baseSpec.links || {},
      'img': baseSpec.images || {}
    };

    for (const [selector, styles] of Object.entries(baseSelectors)) {
      if (Object.keys(styles).length > 0) {
        parts.push(this._generateRule(selector, styles));
      }
    }

    return parts.join('\n\n');
  }

  _generateUtilities(utilities) {
    const parts = [];
    parts.push('/* Utility Classes */');

    for (const [category, utils] of Object.entries(utilities)) {
      parts.push(`/* ${category} utilities */`);
      
      for (const [name, styles] of Object.entries(utils)) {
        const selector = `.${category}-${name}`;
        parts.push(this._generateRule(selector, styles));
      }
    }

    return parts.join('\n\n');
  }

  _generateLayout(layoutSpec) {
    const parts = [];
    parts.push('/* Layout */');

    if (layoutSpec.container) {
      parts.push(this._generateRule('.container', layoutSpec.container));
    }

    if (layoutSpec.grid) {
      parts.push(this._generateGridSystem(layoutSpec.grid));
    }

    return parts.join('\n\n');
  }

  _generateResponsive(responsiveSpec) {
    const parts = [];
    parts.push('/* Responsive Styles */');

    for (const [breakpoint, styles] of Object.entries(responsiveSpec)) {
      const mediaQuery = `@media (min-width: ${this.breakpoints[breakpoint] || breakpoint})`;
      parts.push(`${mediaQuery} {`);
      
      for (const [selector, rules] of Object.entries(styles)) {
        parts.push(this._indentCSS(this._generateRule(selector, rules)));
      }
      
      parts.push('}');
    }

    return parts.join('\n\n');
  }

  _generateRule(selector, styles) {
    const rules = [];
    
    for (const [property, value] of Object.entries(styles)) {
      const cssProperty = this._camelToKebab(property);
      const cssValue = this._processCSSValue(property, value);
      
      if (this.vendorPrefixes && this.vendorPrefixProperties.has(cssProperty)) {
        rules.push(...this._generateVendorPrefixes(cssProperty, cssValue));
      }
      
      rules.push(`${cssProperty}: ${cssValue};`);
    }

    if (rules.length === 0) return '';

    const indentedRules = rules.map(rule => `  ${rule}`).join('\n');
    return `${selector} {\n${indentedRules}\n}`;
  }

  _generateSelector(name) {
    if (this.config.methodology === 'bem') {
      return `.${name}`;
    } else if (this.config.methodology === 'atomic') {
      return `.${name}`;
    }
    return `.${name}`;
  }

  _generateVariantSelector(baseSelector, variant) {
    if (this.config.methodology === 'bem') {
      return `${baseSelector}--${variant}`;
    }
    return `${baseSelector}-${variant}`;
  }

  _generateModifierSelector(baseSelector, modifier) {
    if (this.config.methodology === 'bem') {
      return `${baseSelector}.is-${modifier}`;
    }
    return `${baseSelector}.${modifier}`;
  }

  _generateKeyframes(name, frames) {
    const parts = [];
    parts.push(`@keyframes ${name} {`);
    
    for (const [percentage, styles] of Object.entries(frames)) {
      const rules = Object.entries(styles)
        .map(([prop, val]) => `${this._camelToKebab(prop)}: ${val};`)
        .map(rule => `    ${rule}`)
        .join('\n');
      
      parts.push(`  ${percentage} {\n${rules}\n  }`);
    }
    
    parts.push('}');
    return parts.join('\n');
  }

  _generateFlexboxLayout(container, columns, gutters, responsive) {
    const parts = [];
    
    // Container
    parts.push(this._generateRule('.container', {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: `0 ${gutters}`,
      ...container
    }));

    // Row
    parts.push(this._generateRule('.row', {
      display: 'flex',
      flexWrap: 'wrap',
      margin: `0 -${gutters}`
    }));

    // Columns
    for (let i = 1; i <= columns; i++) {
      const width = `${(i / columns) * 100}%`;
      parts.push(this._generateRule(`.col-${i}`, {
        flex: `0 0 ${width}`,
        maxWidth: width,
        padding: `0 ${gutters}`
      }));
    }

    return parts.join('\n\n');
  }

  _generateGridSystem(gridSpec) {
    return this._generateRule('.grid', {
      display: 'grid',
      gridTemplateColumns: `repeat(${gridSpec.columns || 12}, 1fr)`,
      gap: gridSpec.gap || '1rem',
      ...gridSpec.styles
    });
  }

  _generateVendorPrefixes(property, value) {
    const prefixes = ['-webkit-', '-moz-', '-ms-', '-o-'];
    return prefixes.map(prefix => `${prefix}${property}: ${value};`);
  }

  _processCSSValue(property, value) {
    // Add units if numeric and property requires them
    if (typeof value === 'number' && this._requiresUnit(property)) {
      return `${value}${this.config.units}`;
    }
    
    // Process color variables
    if (typeof value === 'string' && value.startsWith('$')) {
      const colorName = value.slice(1);
      return this.colors[colorName] || `var(--color-${colorName})`;
    }
    
    return value;
  }

  _requiresUnit(property) {
    const unitProperties = new Set([
      'width', 'height', 'margin', 'padding', 'font-size', 'border-width',
      'top', 'right', 'bottom', 'left', 'border-radius'
    ]);
    return unitProperties.has(property);
  }

  _camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  _indentCSS(css, level = 1) {
    const indent = ' '.repeat(this.config.indentation * level);
    return css.split('\n').map(line => line.trim() ? `${indent}${line}` : line).join('\n');
  }

  _minifyCSS(css) {
    return css
      .replace(/\/\*.*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove last semicolon in rules
      .replace(/\s*{\s*/g, '{') // Remove spaces around braces
      .replace(/;\s*/g, ';') // Remove spaces after semicolons
      .trim();
  }

  _isValidColor(color) {
    // Basic color validation
    const colorRegex = /^(#[0-9A-Fa-f]{3,6}|rgb\(|rgba\(|hsl\(|hsla\(|var\()/;
    return colorRegex.test(color) || /^[a-zA-Z]+$/.test(color);
  }

  _convertToCustomProperties(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[`--${key}`] = value;
    }
    return result;
  }

  _getNormalizeCSS() {
    return `/* Normalize CSS */
html { line-height: 1.15; -webkit-text-size-adjust: 100%; }
body { margin: 0; }
main { display: block; }
h1 { font-size: 2em; margin: 0.67em 0; }
hr { box-sizing: content-box; height: 0; overflow: visible; }
pre { font-family: monospace, monospace; font-size: 1em; }`;
  }

  _getResetCSS() {
    return `/* CSS Reset */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }`;
  }

  _getModernResetCSS() {
    return `/* Modern CSS Reset */
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; }
img, picture, video, canvas, svg { display: block; max-width: 100%; }
input, button, textarea, select { font: inherit; }`;
  }
}

export { CSSGenerator };