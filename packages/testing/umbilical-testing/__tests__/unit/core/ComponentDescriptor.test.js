/**
 * Unit tests for ComponentDescriptor
 */
import { describe, test, expect } from '@jest/globals';
import { ComponentDescriptor } from '../../../src/core/ComponentDescriptor.js';

describe('ComponentDescriptor', () => {
  let descriptor;

  beforeEach(() => {
    descriptor = new ComponentDescriptor();
  });

  describe('dependency declaration', () => {
    test('should declare required dependencies', () => {
      descriptor.requires('dom', 'HTMLElement', { description: 'Container element' });

      const description = descriptor.getDescription();
      expect(description.dependencies).toHaveLength(1);
      expect(description.dependencies[0]).toEqual({
        name: 'dom',
        type: 'HTMLElement',
        required: true,
        description: 'Container element'
      });
    });

    test('should declare optional dependencies', () => {
      descriptor.optional('config', 'Object', { default: {}, description: 'Configuration' });

      const description = descriptor.getDescription();
      expect(description.dependencies).toHaveLength(1);
      expect(description.dependencies[0]).toEqual({
        name: 'config',
        type: 'Object',
        required: false,
        default: {},
        description: 'Configuration'
      });
    });

    test('should chain dependency declarations', () => {
      descriptor
        .requires('dom', 'HTMLElement')
        .optional('config', 'Object')
        .requires('actorSpace', 'ActorSpace');

      const description = descriptor.getDescription();
      expect(description.dependencies).toHaveLength(3);
      expect(description.dependencies[0].name).toBe('dom');
      expect(description.dependencies[1].name).toBe('config');
      expect(description.dependencies[2].name).toBe('actorSpace');
    });
  });

  describe('DOM structure declaration', () => {
    test('should declare created elements', () => {
      descriptor.creates('.terminal', { 
        description: 'Main container',
        attributes: { 'data-testid': 'terminal' }
      });

      const description = descriptor.getDescription();
      expect(description.domStructure).toHaveLength(1);
      expect(description.domStructure[0]).toEqual({
        type: 'creates',
        selector: '.terminal',
        description: 'Main container',
        attributes: { 'data-testid': 'terminal' }
      });
    });

    test('should declare contained elements', () => {
      descriptor.contains('input[type=text]', { 
        within: '.terminal',
        description: 'Input field'
      });

      const description = descriptor.getDescription();
      expect(description.domStructure).toHaveLength(1);
      expect(description.domStructure[0]).toEqual({
        type: 'contains',
        selector: 'input[type=text]',
        within: '.terminal',
        description: 'Input field'
      });
    });

    test('should handle multiple DOM declarations', () => {
      descriptor
        .creates('.terminal')
        .creates('input[type=text]')
        .contains('.output-area');

      const description = descriptor.getDescription();
      expect(description.domStructure).toHaveLength(3);
      expect(description.domStructure[0].type).toBe('creates');
      expect(description.domStructure[1].type).toBe('creates');
      expect(description.domStructure[2].type).toBe('contains');
    });
  });

  describe('state management declaration', () => {
    test('should declare managed properties', () => {
      descriptor.manages('currentCommand', 'string', {
        description: 'Current command text',
        default: '',
        constraints: { maxLength: 1000 }
      });

      const description = descriptor.getDescription();
      expect(description.stateProperties).toHaveLength(1);
      expect(description.stateProperties[0]).toEqual({
        property: 'currentCommand',
        type: 'string',
        description: 'Current command text',
        default: '',
        constraints: { maxLength: 1000 }
      });
    });

    test('should handle multiple state properties', () => {
      descriptor
        .manages('currentCommand', 'string', { default: '' })
        .manages('commandHistory', 'Array<string>', { default: [] })
        .manages('executing', 'boolean', { default: false });

      const description = descriptor.getDescription();
      expect(description.stateProperties).toHaveLength(3);
      expect(description.stateProperties.map(p => p.property)).toEqual([
        'currentCommand', 'commandHistory', 'executing'
      ]);
    });
  });

  describe('event declaration', () => {
    test('should declare emitted events', () => {
      descriptor.emits('command', 'string', {
        description: 'Fired when user executes command',
        when: 'User presses Enter'
      });

      const description = descriptor.getDescription();
      expect(description.events).toHaveLength(1);
      expect(description.events[0]).toEqual({
        type: 'emits',
        event: 'command',
        payloadType: 'string',
        description: 'Fired when user executes command',
        when: 'User presses Enter'
      });
    });

    test('should declare listened events', () => {
      descriptor.listens('output', 'OutputLine', {
        description: 'Displays command output',
        from: 'ui-actor'
      });

      const description = descriptor.getDescription();
      expect(description.events).toHaveLength(1);
      expect(description.events[0]).toEqual({
        type: 'listens',
        event: 'output',
        payloadType: 'OutputLine',
        description: 'Displays command output',
        from: 'ui-actor'
      });
    });

    test('should handle mixed event declarations', () => {
      descriptor
        .emits('command', 'string')
        .emits('input', 'string')
        .listens('output', 'OutputLine')
        .listens('autocomplete', 'Array<string>');

      const description = descriptor.getDescription();
      expect(description.events).toHaveLength(4);
      expect(description.events.filter(e => e.type === 'emits')).toHaveLength(2);
      expect(description.events.filter(e => e.type === 'listens')).toHaveLength(2);
    });
  });

  describe('user interaction declaration', () => {
    test('should declare user interactions', () => {
      const validator = (input) => typeof input === 'string';
      descriptor.handles('typing', validator);

      const description = descriptor.getDescription();
      expect(description.userInteractions).toHaveLength(1);
      expect(description.userInteractions[0]).toEqual({
        interaction: 'typing',
        validator
      });
    });

    test('should handle multiple interactions', () => {
      const typingValidator = (input) => typeof input === 'string';
      const keyValidator = (key) => ['Enter', 'Tab'].includes(key);

      descriptor
        .handles('typing', typingValidator)
        .handles('special-keys', keyValidator);

      const description = descriptor.getDescription();
      expect(description.userInteractions).toHaveLength(2);
      expect(description.userInteractions[0].interaction).toBe('typing');
      expect(description.userInteractions[1].interaction).toBe('special-keys');
    });
  });

  describe('actor communication declaration', () => {
    test('should declare messages sent to actors', () => {
      descriptor.sendsToActor('command-actor', 'execute', {
        command: 'string',
        requestId: 'string'
      });

      const description = descriptor.getDescription();
      expect(description.actorCommunication).toHaveLength(1);
      expect(description.actorCommunication[0]).toEqual({
        type: 'sends',
        actorId: 'command-actor',
        messageType: 'execute',
        schema: {
          command: 'string',
          requestId: 'string'
        }
      });
    });

    test('should declare messages received from actors', () => {
      descriptor.receivesFromActor('ui-actor', 'output', {
        content: 'string',
        type: 'string'
      });

      const description = descriptor.getDescription();
      expect(description.actorCommunication).toHaveLength(1);
      expect(description.actorCommunication[0]).toEqual({
        type: 'receives',
        actorId: 'ui-actor',
        messageType: 'output',
        schema: {
          content: 'string',
          type: 'string'
        }
      });
    });

    test('should handle bidirectional actor communication', () => {
      descriptor
        .sendsToActor('command-actor', 'execute', { command: 'string' })
        .receivesFromActor('command-actor', 'response', { result: 'any' })
        .sendsToActor('ui-actor', 'progress', { percentage: 'number' });

      const description = descriptor.getDescription();
      expect(description.actorCommunication).toHaveLength(3);
      expect(description.actorCommunication.filter(c => c.type === 'sends')).toHaveLength(2);
      expect(description.actorCommunication.filter(c => c.type === 'receives')).toHaveLength(1);
    });
  });

  describe('user flow declaration', () => {
    test('should declare user flows', () => {
      const steps = [
        { type: 'user-input', action: 'type', value: 'help' },
        { type: 'user-input', action: 'press-enter' },
        { type: 'verify-event', event: 'command', payload: 'help' }
      ];

      descriptor.flow('type-and-execute', steps);

      const description = descriptor.getDescription();
      expect(description.userFlows).toHaveLength(1);
      expect(description.userFlows[0]).toEqual({
        name: 'type-and-execute',
        steps
      });
    });

    test('should handle multiple flows', () => {
      const flow1 = [{ type: 'user-input', action: 'type', value: 'test' }];
      const flow2 = [{ type: 'user-input', action: 'click', target: '.button' }];

      descriptor
        .flow('typing-flow', flow1)
        .flow('clicking-flow', flow2);

      const description = descriptor.getDescription();
      expect(description.userFlows).toHaveLength(2);
      expect(description.userFlows[0].name).toBe('typing-flow');
      expect(description.userFlows[1].name).toBe('clicking-flow');
    });
  });

  describe('invariant declaration', () => {
    test('should declare invariants', () => {
      const checker = (component) => component.view.inputElement.value === component.model.currentCommand;
      descriptor.invariant('input-state-sync', checker);

      const description = descriptor.getDescription();
      expect(description.invariants).toHaveLength(1);
      expect(description.invariants[0]).toEqual({
        name: 'input-state-sync',
        checker
      });
    });

    test('should handle multiple invariants', () => {
      const checker1 = (c) => c.model.executing ? c.view.inputElement.disabled : true;
      const checker2 = (c) => c.model.commandHistory.length <= 100;

      descriptor
        .invariant('executing-disables-input', checker1)
        .invariant('history-size-limit', checker2);

      const description = descriptor.getDescription();
      expect(description.invariants).toHaveLength(2);
      expect(description.invariants[0].name).toBe('executing-disables-input');
      expect(description.invariants[1].name).toBe('history-size-limit');
    });
  });

  describe('contract declaration', () => {
    test('should declare interface implementations', () => {
      descriptor.implements('TerminalContract');

      const description = descriptor.getDescription();
      expect(description.contracts).toHaveLength(1);
      expect(description.contracts[0]).toEqual({
        type: 'interface',
        name: 'TerminalContract'
      });
    });

    test('should handle multiple contracts', () => {
      descriptor
        .implements('TerminalContract')
        .implements('EventEmitterContract');

      const description = descriptor.getDescription();
      expect(description.contracts).toHaveLength(2);
      expect(description.contracts.map(c => c.name)).toEqual([
        'TerminalContract', 'EventEmitterContract'
      ]);
    });
  });

  describe('validation', () => {
    test('should validate complete descriptions', () => {
      descriptor
        .requires('dom', 'HTMLElement')
        .creates('.terminal')
        .manages('value', 'string')
        .emits('change', 'string')
        .invariant('test', () => true);

      const validation = descriptor.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should warn about missing dependencies', () => {
      descriptor.creates('.terminal');

      const validation = descriptor.validate();
      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('No dependencies declared - component may not be properly isolated');
    });

    test('should warn about missing DOM structure', () => {
      descriptor.requires('dom', 'HTMLElement');

      const validation = descriptor.validate();
      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('No DOM structure declared - component may not render anything');
    });

    test('should error on invalid invariants', () => {
      descriptor.invariant('bad-invariant', 'not-a-function');

      const validation = descriptor.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Invariant 'bad-invariant' must have a checker function");
    });
  });

  describe('method chaining', () => {
    test('should support complete method chaining', () => {
      const result = descriptor
        .requires('dom', 'HTMLElement')
        .optional('config', 'Object')
        .creates('.terminal')
        .contains('input[type=text]')
        .manages('value', 'string')
        .emits('change', 'string')
        .listens('update', 'Object')
        .handles('typing', () => true)
        .sendsToActor('actor', 'message', {})
        .receivesFromActor('actor', 'response', {})
        .flow('test-flow', [])
        .invariant('test', () => true)
        .implements('TestContract');

      expect(result).toBe(descriptor);

      const description = descriptor.getDescription();
      expect(description.dependencies).toHaveLength(2);
      expect(description.domStructure).toHaveLength(2);
      expect(description.stateProperties).toHaveLength(1);
      expect(description.events).toHaveLength(2);
      expect(description.userInteractions).toHaveLength(1);
      expect(description.actorCommunication).toHaveLength(2);
      expect(description.userFlows).toHaveLength(1);
      expect(description.invariants).toHaveLength(1);
      expect(description.contracts).toHaveLength(1);
    });
  });

  describe('description immutability', () => {
    test('should return copies of internal arrays', () => {
      descriptor.requires('dom', 'HTMLElement');
      
      const description1 = descriptor.getDescription();
      const description2 = descriptor.getDescription();

      expect(description1.dependencies).not.toBe(description2.dependencies);
      expect(description1.dependencies).toEqual(description2.dependencies);

      // Modifying returned description should not affect original
      description1.dependencies.push({ name: 'test' });
      expect(description2.dependencies).toHaveLength(1);
    });
  });
});