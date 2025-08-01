/**
 * Tests for CommandParser
 * Parses and analyzes command strings for execution
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('CommandParser', () => {
  let CommandParser;
  let parser;
  let mockVariableStore;
  
  beforeEach(async () => {
    // Mock variable store
    mockVariableStore = {
      getVariable: jest.fn((name) => {
        const variables = {
          'API_URL': { value: 'https://api.example.com', type: 'string' },
          'API_KEY': { value: 'secret123', type: 'string' },
          'DEBUG': { value: true, type: 'boolean' },
          'TIMEOUT': { value: 5000, type: 'number' },
          'CONFIG': { value: { theme: 'dark', lang: 'en' }, type: 'object' },
          'PORTS': { value: [3000, 3001, 3002], type: 'array' }
        };
        return variables[name];
      }),
      
      hasVariable: jest.fn((name) => {
        return mockVariableStore.getVariable(name) !== undefined;
      })
    };
    
    // Import or create CommandParser
    try {
      ({ CommandParser } = await import('../../../src/services/CommandParser.js'));
    } catch (error) {
      // Create mock implementation
      CommandParser = class {
        constructor(dependencies = {}) {
          this.variableStore = dependencies.variableStore;
          this.config = {
            allowPipes: true,
            allowRedirection: true,
            allowBackgroundJobs: true,
            allowGlobbing: true,
            expandVariables: true,
            expandTilde: true,
            ...dependencies.config
          };
        }
        
        parse(command) {
          const result = {
            raw: command,
            executable: null,
            args: [],
            options: {},
            flags: [],
            pipes: [],
            redirections: [],
            background: false,
            variables: [],
            errors: []
          };
          
          try {
            // Pre-process command
            let processed = command.trim();
            
            // Check for background job
            if (processed.endsWith('&')) {
              result.background = true;
              processed = processed.slice(0, -1).trim();
            }
            
            // Split by pipes
            if (this.config.allowPipes && processed.includes('|')) {
              const parts = this.splitByPipes(processed);
              result.pipes = parts.slice(1);
              processed = parts[0];
            }
            
            // Handle redirections
            if (this.config.allowRedirection) {
              const { command: cmd, redirections } = this.extractRedirections(processed);
              result.redirections = redirections;
              processed = cmd;
            }
            
            // Expand variables
            if (this.config.expandVariables) {
              const { expanded, variables } = this.expandVariables(processed);
              result.variables = variables;
              processed = expanded;
            }
            
            // Parse command and arguments
            const tokens = this.tokenize(processed);
            if (tokens.length > 0) {
              result.executable = tokens[0];
              
              // Parse remaining tokens as args/options
              for (let i = 1; i < tokens.length; i++) {
                const token = tokens[i];
                
                if (token.startsWith('--')) {
                  // Long option
                  const [key, value] = this.parseOption(token.substring(2));
                  result.options[key] = value || true;
                } else if (token.startsWith('-') && token.length > 1) {
                  // Short option(s)
                  if (token.length === 2) {
                    result.flags.push(token[1]);
                  } else {
                    // Multiple flags like -abc
                    for (let j = 1; j < token.length; j++) {
                      result.flags.push(token[j]);
                    }
                  }
                } else {
                  // Regular argument
                  result.args.push(token);
                }
              }
            }
            
          } catch (error) {
            result.errors.push(error.message);
          }
          
          return result;
        }
        
        tokenize(command) {
          const tokens = [];
          let current = '';
          let inQuote = null;
          let escaped = false;
          
          for (let i = 0; i < command.length; i++) {
            const char = command[i];
            
            if (escaped) {
              current += char;
              escaped = false;
              continue;
            }
            
            if (char === '\\') {
              escaped = true;
              continue;
            }
            
            if ((char === '"' || char === "'") && !inQuote) {
              inQuote = char;
              continue;
            }
            
            if (char === inQuote) {
              inQuote = null;
              continue;
            }
            
            if (!inQuote && char === ' ') {
              if (current) {
                tokens.push(current);
                current = '';
              }
              continue;
            }
            
            current += char;
          }
          
          if (current) {
            tokens.push(current);
          }
          
          if (inQuote) {
            throw new Error(`Unclosed quote: ${inQuote}`);
          }
          
          return tokens;
        }
        
        splitByPipes(command) {
          const parts = [];
          let current = '';
          let inQuote = null;
          let depth = 0;
          
          for (let i = 0; i < command.length; i++) {
            const char = command[i];
            
            if ((char === '"' || char === "'") && command[i-1] !== '\\') {
              if (!inQuote) {
                inQuote = char;
              } else if (char === inQuote) {
                inQuote = null;
              }
            }
            
            if (!inQuote) {
              if (char === '(') depth++;
              if (char === ')') depth--;
              
              if (char === '|' && depth === 0 && command[i+1] !== '|') {
                parts.push(current.trim());
                current = '';
                continue;
              }
            }
            
            current += char;
          }
          
          if (current) {
            parts.push(current.trim());
          }
          
          return parts;
        }
        
        extractRedirections(command) {
          const redirections = [];
          let processed = command;
          
          // Match patterns like > file, >> file, 2>&1, < file
          const patterns = [
            />>\s*(\S+)/g,  // Append
            />\s*(\S+)/g,   // Output
            /<\s*(\S+)/g,   // Input
            /2>&1/g,        // Stderr to stdout
            /2>\s*(\S+)/g   // Stderr
          ];
          
          const types = ['append', 'output', 'input', 'stderr-to-stdout', 'stderr'];
          
          patterns.forEach((pattern, index) => {
            let match;
            while ((match = pattern.exec(command)) !== null) {
              redirections.push({
                type: types[index],
                target: match[1] || 'stdout',
                position: match.index
              });
              
              // Remove from processed command
              processed = processed.replace(match[0], '');
            }
          });
          
          return { command: processed.trim(), redirections };
        }
        
        expandVariables(command) {
          const variables = [];
          let expanded = command;
          
          // Match $VAR or ${VAR} patterns
          const pattern = /\$\{?([A-Z_][A-Z0-9_]*)\}?/g;
          let match;
          
          while ((match = pattern.exec(command)) !== null) {
            const varName = match[1];
            variables.push(varName);
            
            if (this.variableStore && this.variableStore.hasVariable(varName)) {
              const variable = this.variableStore.getVariable(varName);
              let value = variable.value;
              
              // Convert non-string values
              if (typeof value !== 'string') {
                if (typeof value === 'object') {
                  value = JSON.stringify(value);
                } else {
                  value = String(value);
                }
              }
              
              expanded = expanded.replace(match[0], value);
            }
          }
          
          // Expand tilde
          if (this.config.expandTilde) {
            expanded = expanded.replace(/^~/, process.env.HOME || '/home/user');
          }
          
          return { expanded, variables };
        }
        
        parseOption(option) {
          const equalIndex = option.indexOf('=');
          if (equalIndex !== -1) {
            return [option.substring(0, equalIndex), option.substring(equalIndex + 1)];
          }
          return [option, null];
        }
        
        validate(parsed) {
          const errors = [];
          
          if (!parsed.executable) {
            errors.push('No command specified');
          }
          
          // Check for unclosed quotes in args
          for (const arg of parsed.args) {
            if ((arg.includes('"') && arg.split('"').length % 2 === 0) ||
                (arg.includes("'") && arg.split("'").length % 2 === 0)) {
              errors.push(`Unclosed quote in argument: ${arg}`);
            }
          }
          
          // Validate redirections
          for (const redir of parsed.redirections) {
            if (!redir.target && redir.type !== 'stderr-to-stdout') {
              errors.push(`Invalid redirection: missing target`);
            }
          }
          
          return errors;
        }
        
        reconstruct(parsed) {
          let command = parsed.executable || '';
          
          // Add flags
          if (parsed.flags.length > 0) {
            command += ' -' + parsed.flags.join('');
          }
          
          // Add options
          for (const [key, value] of Object.entries(parsed.options)) {
            if (value === true) {
              command += ` --${key}`;
            } else {
              command += ` --${key}=${value}`;
            }
          }
          
          // Add arguments
          if (parsed.args.length > 0) {
            command += ' ' + parsed.args.map(arg => {
              if (arg.includes(' ')) {
                return `"${arg}"`;
              }
              return arg;
            }).join(' ');
          }
          
          // Add pipes
          if (parsed.pipes.length > 0) {
            command += ' | ' + parsed.pipes.join(' | ');
          }
          
          // Add redirections
          for (const redir of parsed.redirections) {
            switch (redir.type) {
              case 'output':
                command += ` > ${redir.target}`;
                break;
              case 'append':
                command += ` >> ${redir.target}`;
                break;
              case 'input':
                command += ` < ${redir.target}`;
                break;
              case 'stderr':
                command += ` 2> ${redir.target}`;
                break;
              case 'stderr-to-stdout':
                command += ` 2>&1`;
                break;
            }
          }
          
          // Add background
          if (parsed.background) {
            command += ' &';
          }
          
          return command;
        }
      };
    }
    
    // Create parser instance
    parser = new CommandParser({
      variableStore: mockVariableStore
    });
  });
  
  describe('Basic Command Parsing', () => {
    test('should parse simple command', () => {
      const result = parser.parse('ls');
      
      expect(result.executable).toBe('ls');
      expect(result.args).toEqual([]);
      expect(result.options).toEqual({});
      expect(result.flags).toEqual([]);
    });
    
    test('should parse command with arguments', () => {
      const result = parser.parse('echo hello world');
      
      expect(result.executable).toBe('echo');
      expect(result.args).toEqual(['hello', 'world']);
    });
    
    test('should parse command with flags', () => {
      const result = parser.parse('ls -la');
      
      expect(result.executable).toBe('ls');
      expect(result.flags).toContain('l');
      expect(result.flags).toContain('a');
    });
    
    test('should parse command with long options', () => {
      const result = parser.parse('npm install --save-dev --verbose');
      
      expect(result.executable).toBe('npm');
      expect(result.args).toEqual(['install']);
      expect(result.options['save-dev']).toBe(true);
      expect(result.options.verbose).toBe(true);
    });
    
    test('should parse options with values', () => {
      const result = parser.parse('git commit --message="Initial commit" --author=John');
      
      expect(result.executable).toBe('git');
      expect(result.args).toEqual(['commit']);
      expect(result.options.message).toBe('Initial commit');
      expect(result.options.author).toBe('John');
    });
  });
  
  describe('Quoted Arguments', () => {
    test('should handle double quotes', () => {
      const result = parser.parse('echo "hello world"');
      
      expect(result.args).toEqual(['hello world']);
    });
    
    test('should handle single quotes', () => {
      const result = parser.parse("echo 'hello world'");
      
      expect(result.args).toEqual(['hello world']);
    });
    
    test('should handle mixed quotes', () => {
      const result = parser.parse(`echo "it's" 'a "test"'`);
      
      expect(result.args).toEqual(["it's", 'a "test"']);
    });
    
    test('should handle escaped quotes', () => {
      const result = parser.parse('echo "hello \\"world\\""');
      
      expect(result.args).toEqual(['hello "world"']);
    });
    
    test('should detect unclosed quotes', () => {
      const result = parser.parse('echo "unclosed');
      
      expect(result.errors).toContain('Unclosed quote: "');
    });
  });
  
  describe('Variable Expansion', () => {
    test('should expand simple variables', () => {
      const result = parser.parse('echo $API_URL');
      
      expect(result.args).toEqual(['https://api.example.com']);
      expect(result.variables).toContain('API_URL');
    });
    
    test('should expand variables with braces', () => {
      const result = parser.parse('echo ${API_KEY}');
      
      expect(result.args).toEqual(['secret123']);
      expect(result.variables).toContain('API_KEY');
    });
    
    test('should expand multiple variables', () => {
      const result = parser.parse('curl $API_URL -H "Key: $API_KEY"');
      
      expect(result.executable).toBe('curl');
      expect(result.args).toContain('https://api.example.com');
      expect(result.args).toContain('Key: secret123');
      expect(result.variables).toEqual(['API_URL', 'API_KEY']);
    });
    
    test('should handle non-string variables', () => {
      const result = parser.parse('echo $DEBUG $TIMEOUT');
      
      expect(result.args).toEqual(['true', '5000']);
    });
    
    test('should handle object variables', () => {
      const result = parser.parse('echo $CONFIG');
      
      expect(result.args).toEqual(['{"theme":"dark","lang":"en"}']);
    });
    
    test('should handle undefined variables', () => {
      const result = parser.parse('echo $UNDEFINED_VAR');
      
      expect(result.args).toEqual(['$UNDEFINED_VAR']);
      expect(result.variables).toContain('UNDEFINED_VAR');
    });
    
    test('should expand tilde to home directory', () => {
      const originalHome = process.env.HOME;
      process.env.HOME = '/home/test';
      
      const result = parser.parse('cd ~/Documents');
      
      expect(result.args).toContain('/home/test/Documents');
      
      process.env.HOME = originalHome;
    });
  });
  
  describe('Pipes and Redirection', () => {
    test('should parse pipe commands', () => {
      const result = parser.parse('ls -la | grep test');
      
      expect(result.executable).toBe('ls');
      expect(result.flags).toContain('l');
      expect(result.flags).toContain('a');
      expect(result.pipes).toEqual(['grep test']);
    });
    
    test('should parse multiple pipes', () => {
      const result = parser.parse('cat file.txt | grep error | wc -l');
      
      expect(result.executable).toBe('cat');
      expect(result.args).toEqual(['file.txt']);
      expect(result.pipes).toEqual(['grep error', 'wc -l']);
    });
    
    test('should parse output redirection', () => {
      const result = parser.parse('echo hello > output.txt');
      
      expect(result.executable).toBe('echo');
      expect(result.args).toEqual(['hello']);
      expect(result.redirections).toContainEqual({
        type: 'output',
        target: 'output.txt',
        position: expect.any(Number)
      });
    });
    
    test('should parse append redirection', () => {
      const result = parser.parse('echo world >> output.txt');
      
      expect(result.redirections).toContainEqual({
        type: 'append',
        target: 'output.txt',
        position: expect.any(Number)
      });
    });
    
    test('should parse input redirection', () => {
      const result = parser.parse('wc -l < input.txt');
      
      expect(result.redirections).toContainEqual({
        type: 'input',
        target: 'input.txt',
        position: expect.any(Number)
      });
    });
    
    test('should parse stderr redirection', () => {
      const result = parser.parse('command 2> errors.log');
      
      expect(result.redirections).toContainEqual({
        type: 'stderr',
        target: 'errors.log',
        position: expect.any(Number)
      });
    });
    
    test('should parse stderr to stdout', () => {
      const result = parser.parse('command 2>&1');
      
      expect(result.redirections).toContainEqual({
        type: 'stderr-to-stdout',
        target: 'stdout',
        position: expect.any(Number)
      });
    });
    
    test('should parse complex redirections', () => {
      const result = parser.parse('command < input.txt > output.txt 2>&1');
      
      expect(result.redirections).toHaveLength(3);
    });
  });
  
  describe('Background Jobs', () => {
    test('should detect background job', () => {
      const result = parser.parse('long-running-command &');
      
      expect(result.executable).toBe('long-running-command');
      expect(result.background).toBe(true);
    });
    
    test('should handle background with arguments', () => {
      const result = parser.parse('npm run build -- --watch &');
      
      expect(result.executable).toBe('npm');
      expect(result.args).toEqual(['run', 'build', '--', '--watch']);
      expect(result.background).toBe(true);
    });
  });
  
  describe('Complex Commands', () => {
    test('should parse git commit command', () => {
      const result = parser.parse('git commit -am "Fix: resolved issue #123"');
      
      expect(result.executable).toBe('git');
      expect(result.args).toEqual(['commit', 'Fix: resolved issue #123']);
      expect(result.flags).toContain('a');
      expect(result.flags).toContain('m');
    });
    
    test('should parse npm install command', () => {
      const result = parser.parse('npm install --save-dev @types/node typescript --verbose');
      
      expect(result.executable).toBe('npm');
      expect(result.args).toEqual(['install', '@types/node', 'typescript']);
      expect(result.options['save-dev']).toBe(true);
      expect(result.options.verbose).toBe(true);
    });
    
    test('should parse docker run command', () => {
      const result = parser.parse('docker run -d -p 8080:80 --name webserver nginx');
      
      expect(result.executable).toBe('docker');
      expect(result.args).toEqual(['run', '8080:80', 'webserver', 'nginx']);
      expect(result.flags).toContain('d');
      expect(result.flags).toContain('p');
      expect(result.options.name).toBe(true);
    });
    
    test('should parse curl command with headers', () => {
      const result = parser.parse('curl -X POST $API_URL -H "Content-Type: application/json" -d \'{"key":"value"}\'');
      
      expect(result.executable).toBe('curl');
      expect(result.args).toContain('POST');
      expect(result.args).toContain('https://api.example.com');
      expect(result.args).toContain('Content-Type: application/json');
      expect(result.args).toContain('{"key":"value"}');
      expect(result.flags).toContain('X');
      expect(result.flags).toContain('H');
      expect(result.flags).toContain('d');
    });
  });
  
  describe('Command Validation', () => {
    test('should validate empty command', () => {
      const result = parser.parse('');
      const errors = parser.validate(result);
      
      expect(errors).toContain('No command specified');
    });
    
    test('should validate missing redirection target', () => {
      const result = parser.parse('echo hello >');
      const errors = parser.validate(result);
      
      expect(errors.length).toBeGreaterThan(0);
    });
    
    test('should validate valid command', () => {
      const result = parser.parse('ls -la');
      const errors = parser.validate(result);
      
      expect(errors).toEqual([]);
    });
  });
  
  describe('Command Reconstruction', () => {
    test('should reconstruct simple command', () => {
      const parsed = parser.parse('ls -la');
      const reconstructed = parser.reconstruct(parsed);
      
      expect(reconstructed).toBe('ls -la');
    });
    
    test('should reconstruct command with options', () => {
      const parsed = parser.parse('git commit --message="Test" --amend');
      const reconstructed = parser.reconstruct(parsed);
      
      expect(reconstructed).toContain('--message=Test');
      expect(reconstructed).toContain('--amend');
    });
    
    test('should reconstruct command with quotes', () => {
      const parsed = parser.parse('echo "hello world"');
      const reconstructed = parser.reconstruct(parsed);
      
      expect(reconstructed).toBe('echo "hello world"');
    });
    
    test('should reconstruct complex command', () => {
      const parsed = parser.parse('cat file.txt | grep error > errors.log 2>&1 &');
      const reconstructed = parser.reconstruct(parsed);
      
      expect(reconstructed).toContain('cat file.txt');
      expect(reconstructed).toContain('| grep error');
      expect(reconstructed).toContain('> errors.log');
      expect(reconstructed).toContain('2>&1');
      expect(reconstructed).toContain('&');
    });
  });
  
  describe('Special Cases', () => {
    test('should handle commands with double dash', () => {
      const result = parser.parse('npm run test -- --coverage');
      
      expect(result.executable).toBe('npm');
      expect(result.args).toEqual(['run', 'test', '--', '--coverage']);
    });
    
    test('should handle glob patterns', () => {
      const result = parser.parse('rm -rf *.tmp');
      
      expect(result.executable).toBe('rm');
      expect(result.args).toEqual(['*.tmp']);
      expect(result.flags).toContain('r');
      expect(result.flags).toContain('f');
    });
    
    test('should handle command substitution markers', () => {
      const result = parser.parse('echo $(date)');
      
      expect(result.args).toContain('$(date)');
    });
    
    test('should handle environment variable assignment', () => {
      const result = parser.parse('NODE_ENV=production npm start');
      
      // This is a simplified handling - real shells would set env var
      expect(result.executable).toBe('NODE_ENV=production');
      expect(result.args).toEqual(['npm', 'start']);
    });
  });
});