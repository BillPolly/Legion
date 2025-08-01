/**
 * YAML Parser Tests
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('YAML Parser', () => {
  let YamlHandler;
  let yamlHandler;

  beforeEach(async () => {
    const module = await import('../../../handlers/YamlHandler.js');
    YamlHandler = module.YamlHandler;
    yamlHandler = new YamlHandler();
  });

  describe('Basic YAML Parsing', () => {
    test('should parse simple key-value pairs', () => {
      const yaml = `
name: John Doe
age: 30
active: true
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      
      expect(result).toBeDefined();
      expect(result.type).toBe('object');
      expect(result.children).toHaveLength(3);
      
      const nameChild = result.children.find(child => child.name === 'name');
      expect(nameChild.type).toBe('value');
      expect(nameChild.value).toBe('John Doe');
      
      const ageChild = result.children.find(child => child.name === 'age');
      expect(ageChild.type).toBe('value');
      expect(ageChild.value).toBe(30);
      
      const activeChild = result.children.find(child => child.name === 'active');
      expect(activeChild.type).toBe('value');
      expect(activeChild.value).toBe(true);
    });

    test('should parse nested objects', () => {
      const yaml = `
person:
  name: John Doe
  age: 30
  address:
    street: 123 Main St
    city: Springfield
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      
      expect(result.type).toBe('object');
      expect(result.children).toHaveLength(1);
      
      const personChild = result.children[0];
      expect(personChild.name).toBe('person');
      expect(personChild.type).toBe('object');
      expect(personChild.children).toHaveLength(3);
      
      const addressChild = personChild.children.find(child => child.name === 'address');
      expect(addressChild.type).toBe('object');
      expect(addressChild.children).toHaveLength(2);
    });

    test('should parse arrays', () => {
      const yaml = `
fruits:
  - apple
  - banana
  - orange
numbers:
  - 1
  - 2
  - 3
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      
      expect(result.type).toBe('object');
      expect(result.children).toHaveLength(2);
      
      const fruitsChild = result.children.find(child => child.name === 'fruits');
      expect(fruitsChild.type).toBe('array');
      expect(fruitsChild.children).toHaveLength(3);
      expect(fruitsChild.children[0].value).toBe('apple');
      expect(fruitsChild.children[1].value).toBe('banana');
      expect(fruitsChild.children[2].value).toBe('orange');
      
      const numbersChild = result.children.find(child => child.name === 'numbers');
      expect(numbersChild.type).toBe('array');
      expect(numbersChild.children).toHaveLength(3);
      expect(numbersChild.children[0].value).toBe(1);
      expect(numbersChild.children[1].value).toBe(2);
      expect(numbersChild.children[2].value).toBe(3);
    });

    test('should parse mixed arrays with objects', () => {
      const yaml = `
users:
  - name: John
    age: 30
  - name: Jane
    age: 25
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      
      const usersChild = result.children[0];
      expect(usersChild.name).toBe('users');
      expect(usersChild.type).toBe('array');
      expect(usersChild.children).toHaveLength(2);
      
      const user1 = usersChild.children[0];
      expect(user1.type).toBe('object');
      expect(user1.children).toHaveLength(2);
      expect(user1.children.find(child => child.name === 'name').value).toBe('John');
      expect(user1.children.find(child => child.name === 'age').value).toBe(30);
    });
  });

  describe('YAML Data Types', () => {
    test('should parse strings', () => {
      const yaml = `
plain_string: Hello World
quoted_string: "Hello World"
single_quoted: 'Hello World'
multiline: |
  This is a
  multiline string
folded: >
  This is a folded
  string that becomes
  one line
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      
      const plainString = result.children.find(child => child.name === 'plain_string');
      expect(plainString.value).toBe('Hello World');
      
      const quotedString = result.children.find(child => child.name === 'quoted_string');
      expect(quotedString.value).toBe('Hello World');
      
      const singleQuoted = result.children.find(child => child.name === 'single_quoted');
      expect(singleQuoted.value).toBe('Hello World');
      
      const multiline = result.children.find(child => child.name === 'multiline');
      expect(multiline.value).toContain('This is a\nmultiline string');
      
      const folded = result.children.find(child => child.name === 'folded');
      expect(folded.value).toBe('This is a folded string that becomes one line');
    });

    test('should parse numbers', () => {
      const yaml = `
integer: 42
float: 3.14159
negative: -17
scientific: 1.23e+10
octal: 0o17
hex: 0xFF
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      
      expect(result.children.find(child => child.name === 'integer').value).toBe(42);
      expect(result.children.find(child => child.name === 'float').value).toBe(3.14159);
      expect(result.children.find(child => child.name === 'negative').value).toBe(-17);
      expect(result.children.find(child => child.name === 'scientific').value).toBe(1.23e+10);
      expect(result.children.find(child => child.name === 'octal').value).toBe(15); // 0o17 = 15
      expect(result.children.find(child => child.name === 'hex').value).toBe(255); // 0xFF = 255
    });

    test('should parse booleans and nulls', () => {
      const yaml = `
true_bool: true
false_bool: false
yes_bool: yes
no_bool: no
null_value: null
tilde_null: ~
empty_null:
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      
      expect(result.children.find(child => child.name === 'true_bool').value).toBe(true);
      expect(result.children.find(child => child.name === 'false_bool').value).toBe(false);
      expect(result.children.find(child => child.name === 'yes_bool').value).toBe(true);
      expect(result.children.find(child => child.name === 'no_bool').value).toBe(false);
      expect(result.children.find(child => child.name === 'null_value').value).toBe(null);
      expect(result.children.find(child => child.name === 'tilde_null').value).toBe(null);
      expect(result.children.find(child => child.name === 'empty_null').value).toBe(null);
    });
  });

  describe('YAML Special Features', () => {
    test('should handle comments', () => {
      const yaml = `
# This is a comment
name: John Doe  # Inline comment
age: 30
# Another comment
active: true
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      
      // Comments should be ignored in parsing
      expect(result.children).toHaveLength(3);
      expect(result.children.find(child => child.name === 'name').value).toBe('John Doe');
    });

    test('should handle anchors and aliases', () => {
      const yaml = `
default: &default
  name: Default User
  role: user

admin:
  <<: *default
  name: Admin User
  role: admin

guest:
  <<: *default
  name: Guest User
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      
      const adminChild = result.children.find(child => child.name === 'admin');
      expect(adminChild.children.find(child => child.name === 'name').value).toBe('Admin User');
      expect(adminChild.children.find(child => child.name === 'role').value).toBe('admin');
      
      const guestChild = result.children.find(child => child.name === 'guest');
      expect(guestChild.children.find(child => child.name === 'name').value).toBe('Guest User');
      expect(guestChild.children.find(child => child.name === 'role').value).toBe('user'); // From default
    });

    test('should handle explicit typing', () => {
      const yaml = `
string_int: !!str 123
int_string: !!int "456"
float_string: !!float "7.89"
binary_data: !!binary |
  R0lGODlhDAAMAIQAAP//9/X17unp5WZmZgAAAOfn515eXvPz7Y6OjuDg4J+fn5
  OTk6enp56enmlpaWNjY6Ojo4SEhP/++f/++f/++f/++f/++f/++f/++f/++f/+
  +f/++f/++f/++f/++f/++SH+Dk1hZGUgd2l0aCBHSU1QACwAAAAADAAMAAAFLC
      `.trim();
      
      const result = yamlHandler.parse(yaml);
      
      expect(result.children.find(child => child.name === 'string_int').value).toBe('123');
      expect(result.children.find(child => child.name === 'int_string').value).toBe(456);
      expect(result.children.find(child => child.name === 'float_string').value).toBe(7.89);
      
      const binaryData = result.children.find(child => child.name === 'binary_data');
      expect(typeof binaryData.value).toBe('string');
      expect(binaryData.metadata.yamlType).toBe('!!binary');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed YAML gracefully', () => {
      const malformedYaml = `
name: John
  age: 30
    invalid indentation
      `;
      
      expect(() => {
        yamlHandler.parse(malformedYaml);
      }).toThrow();
    });

    test('should handle empty YAML', () => {
      const emptyYaml = '';
      
      const result = yamlHandler.parse(emptyYaml);
      expect(result).toBeNull();
    });

    test('should handle YAML with only comments', () => {
      const commentOnlyYaml = `
# This is just a comment
# Another comment
      `.trim();
      
      const result = yamlHandler.parse(commentOnlyYaml);
      expect(result).toBeNull();
    });

    test('should handle duplicate keys', () => {
      const duplicateKeyYaml = `
name: John
age: 30
name: Jane
      `.trim();
      
      // YAML spec says later values should override earlier ones
      const result = yamlHandler.parse(duplicateKeyYaml);
      expect(result.children.find(child => child.name === 'name').value).toBe('Jane');
    });
  });

  describe('Complex Structures', () => {
    test('should parse real-world configuration', () => {
      const configYaml = `
server:
  host: localhost
  port: 8080
  ssl:
    enabled: true
    cert: /path/to/cert.pem
    key: /path/to/key.pem

database:
  host: db.example.com
  port: 5432
  name: myapp
  credentials:
    username: dbuser
    password: secret123

logging:
  level: info
  outputs:
    - console
    - file
  file:
    path: /var/log/app.log
    max_size: 100MB
      `.trim();
      
      const result = yamlHandler.parse(configYaml);
      
      expect(result.type).toBe('object');
      expect(result.children).toHaveLength(3);
      
      const serverChild = result.children.find(child => child.name === 'server');
      expect(serverChild.type).toBe('object');
      
      const sslChild = serverChild.children.find(child => child.name === 'ssl');
      expect(sslChild.type).toBe('object');
      expect(sslChild.children.find(child => child.name === 'enabled').value).toBe(true);
      
      const loggingChild = result.children.find(child => child.name === 'logging');
      const outputsChild = loggingChild.children.find(child => child.name === 'outputs');
      expect(outputsChild.type).toBe('array');
      expect(outputsChild.children).toHaveLength(2);
    });
  });
});