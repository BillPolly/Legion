/**
 * YAML Indentation Preservation Tests
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('YAML Indentation Preservation', () => {
  let YamlHandler;
  let yamlHandler;

  beforeEach(async () => {
    const module = await import('../../../handlers/YamlHandler.js');
    YamlHandler = module.YamlHandler;
    yamlHandler = new YamlHandler();
  });

  describe('Basic Indentation', () => {
    test('should preserve 2-space indentation', () => {
      const yaml = `
parent:
  child1: value1
  child2: value2
  nested:
    deep: value3
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      const serialized = yamlHandler.serialize(result, { indent: '  ' });
      
      expect(serialized).toContain('parent:');
      expect(serialized).toContain('  child1: value1');
      expect(serialized).toContain('  child2: value2');
      expect(serialized).toContain('  nested:');
      expect(serialized).toContain('    deep: value3');
    });

    test('should preserve 4-space indentation', () => {
      const yaml = `
parent:
    child1: value1
    child2: value2
    nested:
        deep: value3
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      const serialized = yamlHandler.serialize(result, { indent: '    ' });
      
      expect(serialized).toContain('parent:');
      expect(serialized).toContain('    child1: value1');
      expect(serialized).toContain('    child2: value2');
      expect(serialized).toContain('    nested:');
      expect(serialized).toContain('        deep: value3');
    });

    test('should detect and preserve original indentation', () => {
      const yaml = `
config:
    server:
        host: localhost
        port: 8080
    database:
        host: db.example.com
        port: 5432
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      
      // Should detect 4-space indentation from original
      expect(result.metadata.indentSize).toBe(4);
      expect(result.metadata.indentChar).toBe(' ');
      
      const serialized = yamlHandler.serialize(result);
      expect(serialized).toContain('    server:');
      expect(serialized).toContain('        host: localhost');
    });
  });

  describe('Array Indentation', () => {
    test('should preserve array item indentation', () => {
      const yaml = `
items:
  - name: item1
    value: 100
  - name: item2
    value: 200
  - nested:
      - subitem1
      - subitem2
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      const serialized = yamlHandler.serialize(result, { indent: '  ' });
      
      expect(serialized).toContain('items:');
      expect(serialized).toContain('  - name: item1');
      expect(serialized).toContain('    value: 100');
      expect(serialized).toContain('  - name: item2');
      expect(serialized).toContain('    value: 200');
      expect(serialized).toContain('  - nested:');
      expect(serialized).toContain('      - subitem1');
      expect(serialized).toContain('      - subitem2');
    });

    test('should handle compact array notation', () => {
      const yaml = `
simple_array: [1, 2, 3, 4]
mixed_array: ['string', 42, true, null]
nested_compact: [[1, 2], [3, 4]]
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      const serialized = yamlHandler.serialize(result);
      
      // Should preserve compact notation for simple arrays
      expect(serialized).toContain('simple_array: [1, 2, 3, 4]');
      expect(serialized).toContain('mixed_array: [string, 42, true, null]');
    });
  });

  describe('Mixed Content Indentation', () => {
    test('should handle mixed objects and arrays', () => {
      const yaml = `
config:
  servers:
    - name: web1
      host: 192.168.1.10
      services:
        - http
        - https
    - name: web2
      host: 192.168.1.11
      services:
        - http
  database:
    primary:
      host: db1.example.com
      port: 5432
    replicas:
      - host: db2.example.com
        port: 5432
      - host: db3.example.com
        port: 5432
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      const serialized = yamlHandler.serialize(result, { indent: '  ' });
      
      expect(serialized).toContain('config:');
      expect(serialized).toContain('  servers:');
      expect(serialized).toContain('    - name: web1');
      expect(serialized).toContain('      host: 192.168.1.10');
      expect(serialized).toContain('      services:');
      expect(serialized).toContain('        - http');
      expect(serialized).toContain('        - https');
    });
  });

  describe('Special Formatting', () => {
    test('should preserve multiline string formatting', () => {
      const yaml = `
literal_style: |
  This is a literal string
  that preserves line breaks
  and trailing spaces    

folded_style: >
  This is a folded string
  that becomes a single line
  with spaces between words

plain_multiline:
  This is a plain string
  that spans multiple lines
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      const serialized = yamlHandler.serialize(result);
      
      expect(serialized).toContain('literal_style: |');
      expect(serialized).toContain('folded_style: >');
      
      const literalChild = result.children.find(child => child.name === 'literal_style');
      expect(literalChild.metadata.yamlStyle).toBe('|');
      
      const foldedChild = result.children.find(child => child.name === 'folded_style');
      expect(foldedChild.metadata.yamlStyle).toBe('>');
    });

    test('should handle quoted strings properly', () => {
      const yaml = `
single_quoted: 'This is a single quoted string'
double_quoted: "This is a double quoted string with \\"escapes\\""
plain_string: This is a plain string
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      const serialized = yamlHandler.serialize(result);
      
      // Should preserve quoting when necessary
      const singleQuoted = result.children.find(child => child.name === 'single_quoted');
      expect(singleQuoted.metadata.yamlQuoteStyle).toBe("'");
      
      const doubleQuoted = result.children.find(child => child.name === 'double_quoted');
      expect(doubleQuoted.metadata.yamlQuoteStyle).toBe('"');
    });
  });

  describe('Indentation Edge Cases', () => {
    test('should handle inconsistent indentation gracefully', () => {
      const yaml = `
root:
  child1: value1
    child2: value2  # Different indentation
  child3: value3
      `.trim();
      
      // Should still parse but normalize indentation
      const result = yamlHandler.parse(yaml);
      const serialized = yamlHandler.serialize(result, { indent: '  ' });
      
      expect(serialized).toContain('  child1: value1');
      expect(serialized).toContain('  child2: value2');
      expect(serialized).toContain('  child3: value3');
    });

    test('should handle tab characters', () => {
      const yaml = "root:\n\tchild1: value1\n\tchild2: value2";
      
      const result = yamlHandler.parse(yaml);
      
      // Should detect tab indentation
      expect(result.metadata.indentChar).toBe('\t');
      expect(result.metadata.indentSize).toBe(1);
    });

    test('should handle very deep nesting', () => {
      const yaml = `
level1:
  level2:
    level3:
      level4:
        level5:
          level6:
            deep_value: found
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      const serialized = yamlHandler.serialize(result, { indent: '  ' });
      
      expect(serialized).toContain('            deep_value: found');
    });
  });

  describe('Round-trip Indentation', () => {
    test('should maintain indentation through parse-serialize cycle', () => {
      const originalYaml = `
application:
  name: MyApp
  version: 1.0.0
  settings:
    debug: true
    features:
      - authentication
      - logging
      - metrics
    database:
      host: localhost
      port: 5432
      credentials:
        username: admin
        password: secret
      `.trim();
      
      const parsed = yamlHandler.parse(originalYaml);
      const serialized = yamlHandler.serialize(parsed);
      const reparsed = yamlHandler.parse(serialized);
      
      // Structure should be identical
      expect(reparsed.type).toBe('object');
      expect(reparsed.children).toHaveLength(1);
      
      const appChild = reparsed.children[0];
      expect(appChild.name).toBe('application');
      expect(appChild.children).toHaveLength(3);
      
      const settingsChild = appChild.children.find(child => child.name === 'settings');
      const featuresChild = settingsChild.children.find(child => child.name === 'features');
      expect(featuresChild.type).toBe('array');
      expect(featuresChild.children).toHaveLength(3);
    });

    test('should preserve formatting metadata', () => {
      const yaml = `
config:
  multiline: |
    Line 1
    Line 2
  folded: >
    Folded
    string
  quoted: "Special chars: \\"test\\""
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      const serialized = yamlHandler.serialize(result);
      
      // Should preserve special formatting
      expect(serialized).toContain('multiline: |');
      expect(serialized).toContain('folded: >');
      expect(serialized).toContain('"Special chars: \\"test\\""');
    });
  });
});