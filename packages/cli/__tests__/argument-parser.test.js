import { jest } from '@jest/globals';
import CLI from '../src/index.js';

describe('Argument Parser', () => {
  let cli;

  beforeEach(() => {
    cli = new CLI();
  });

  describe('parseArgs method', () => {
    it('should parse module.tool syntax', () => {
      cli.parseArgs(['node', 'jsenvoy', 'calculator.evaluate']);
      
      expect(cli.command).toBe('execute');
      expect(cli.moduleName).toBe('calculator');
      expect(cli.toolName).toBe('evaluate');
    });

    it('should parse module.tool with arguments', () => {
      cli.parseArgs(['node', 'jsenvoy', 'calculator.evaluate', '--expression', '2+2']);
      
      expect(cli.command).toBe('execute');
      expect(cli.moduleName).toBe('calculator');
      expect(cli.toolName).toBe('evaluate');
      expect(cli.args.expression).toBe('2+2');
    });

    it('should parse list command', () => {
      cli.parseArgs(['node', 'jsenvoy', 'list']);
      
      expect(cli.command).toBe('list');
      expect(cli.listType).toBe('all');
    });

    it('should parse list modules command', () => {
      cli.parseArgs(['node', 'jsenvoy', 'list', 'modules']);
      
      expect(cli.command).toBe('list');
      expect(cli.listType).toBe('modules');
    });

    it('should parse list tools command', () => {
      cli.parseArgs(['node', 'jsenvoy', 'list', 'tools']);
      
      expect(cli.command).toBe('list');
      expect(cli.listType).toBe('tools');
    });

    it('should parse help command', () => {
      cli.parseArgs(['node', 'jsenvoy', 'help']);
      
      expect(cli.command).toBe('help');
      expect(cli.helpTopic).toBeUndefined();
    });

    it('should parse help with topic', () => {
      cli.parseArgs(['node', 'jsenvoy', 'help', 'calculator.evaluate']);
      
      expect(cli.command).toBe('help');
      expect(cli.helpTopic).toBe('calculator.evaluate');
    });

    it('should parse interactive command', () => {
      cli.parseArgs(['node', 'jsenvoy', 'interactive']);
      
      expect(cli.command).toBe('interactive');
    });

    it('should parse -i flag for interactive mode', () => {
      cli.parseArgs(['node', 'jsenvoy', '-i']);
      
      expect(cli.command).toBe('interactive');
    });

    it('should handle JSON arguments', () => {
      cli.parseArgs(['node', 'jsenvoy', 'file.read', '--json', '{"path": "/tmp/test.txt"}']);
      
      expect(cli.command).toBe('execute');
      expect(cli.moduleName).toBe('file');
      expect(cli.toolName).toBe('read');
      expect(cli.args.path).toBe('/tmp/test.txt');
    });

    it('should handle multiple named arguments', () => {
      cli.parseArgs(['node', 'jsenvoy', 'file.write', '--path', '/tmp/test.txt', '--content', 'hello world']);
      
      expect(cli.command).toBe('execute');
      expect(cli.moduleName).toBe('file');
      expect(cli.toolName).toBe('write');
      expect(cli.args.path).toBe('/tmp/test.txt');
      expect(cli.args.content).toBe('hello world');
    });

    it('should handle boolean flags', () => {
      cli.parseArgs(['node', 'jsenvoy', 'file.list', '--recursive', '--hidden']);
      
      expect(cli.command).toBe('execute');
      expect(cli.args.recursive).toBe(true);
      expect(cli.args.hidden).toBe(true);
    });

    it('should throw error for invalid command syntax', () => {
      expect(() => {
        cli.parseArgs(['node', 'jsenvoy', 'invalid-command']);
      }).toThrow('Invalid command');
    });

    it('should throw error for invalid module.tool syntax', () => {
      expect(() => {
        cli.parseArgs(['node', 'jsenvoy', 'modulewithouttool']);
      }).toThrow('Invalid command');
    });

    it('should parse global options', () => {
      cli.parseArgs(['node', 'jsenvoy', '--verbose', 'calculator.evaluate', '--expression', '2+2']);
      
      expect(cli.options.verbose).toBe(true);
      expect(cli.command).toBe('execute');
      expect(cli.moduleName).toBe('calculator');
      expect(cli.toolName).toBe('evaluate');
      expect(cli.args.expression).toBe('2+2');
    });

    it('should parse output format option', () => {
      cli.parseArgs(['node', 'jsenvoy', '--output', 'json', 'calculator.evaluate']);
      
      expect(cli.options.output).toBe('json');
    });
  });
});