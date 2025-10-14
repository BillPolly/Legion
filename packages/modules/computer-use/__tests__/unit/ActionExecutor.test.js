/**
 * Unit tests for ActionExecutor
 */

import { jest } from '@jest/globals';
import { ActionExecutor } from '../../src/actions/ActionExecutor.js';

describe('ActionExecutor', () => {
  let actionExecutor;
  let mockPage;
  let mockLogger;

  beforeEach(() => {
    // Mock page object
    mockPage = {
      goto: jest.fn(),
      keyboard: {
        press: jest.fn().mockResolvedValue(undefined),
        type: jest.fn(),
      },
      mouse: {
        click: jest.fn(),
        dblclick: jest.fn(),
        move: jest.fn(),
        down: jest.fn(),
        up: jest.fn(),
        wheel: jest.fn(),
      },
      evaluateHandle: jest.fn(),
      evaluate: jest.fn(),
      accessibility: {
        snapshot: jest.fn(),
      },
      $: jest.fn(),
      waitForTimeout: jest.fn(),
      goBack: jest.fn(),
      goForward: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      log: jest.fn(),
    };

    actionExecutor = new ActionExecutor(mockPage, mockLogger, {
      width: 1440,
      height: 900,
    });
  });

  describe('Constructor', () => {
    test('should initialize with default dimensions', () => {
      expect(actionExecutor.screenWidth).toBe(1440);
      expect(actionExecutor.screenHeight).toBe(900);
    });

    test('should initialize with custom dimensions', () => {
      const executor = new ActionExecutor(mockPage, mockLogger, {
        width: 1024,
        height: 768,
      });
      expect(executor.screenWidth).toBe(1024);
      expect(executor.screenHeight).toBe(768);
    });

    test('should store allowlist hosts', () => {
      const executor = new ActionExecutor(mockPage, mockLogger, {
        allowlistHosts: ['example.com', 'test.com'],
      });
      expect(executor.allowlistHosts).toEqual(['example.com', 'test.com']);
    });
  });

  describe('Navigate Action', () => {
    test('should navigate to URL', async () => {
      await actionExecutor.execute('navigate', { url: 'https://example.com' });
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'load',
        timeout: 20000,
      });
    });

    test('should enforce allowlist when configured', async () => {
      const executor = new ActionExecutor(mockPage, mockLogger, {
        allowlistHosts: ['example.com'],
      });

      await expect(
        executor.execute('navigate', { url: 'https://evil.com' })
      ).rejects.toThrow('Disallowed host: evil.com');
    });

    test('should allow navigation to allowlisted hosts', async () => {
      const executor = new ActionExecutor(mockPage, mockLogger, {
        allowlistHosts: ['example.com'],
      });

      await executor.execute('navigate', { url: 'https://example.com' });
      expect(mockPage.goto).toHaveBeenCalled();
    });
  });

  describe('Coordinate Denormalization', () => {
    test('should denormalize coordinates correctly', () => {
      const [px, py] = actionExecutor.denorm(500, 500);
      expect(px).toBe(720); // 500/1000 * 1440
      expect(py).toBe(450); // 500/1000 * 900
    });

    test('should clamp coordinates to screen bounds', () => {
      const [px1, py1] = actionExecutor.denorm(-100, -100);
      expect(px1).toBe(0);
      expect(py1).toBe(0);

      const [px2, py2] = actionExecutor.denorm(2000, 2000);
      expect(px2).toBe(1439); // width - 1
      expect(py2).toBe(899); // height - 1
    });

    test('should handle edge values', () => {
      const [px1, py1] = actionExecutor.denorm(0, 0);
      expect(px1).toBe(0);
      expect(py1).toBe(0);

      const [px2, py2] = actionExecutor.denorm(999, 999);
      expect(px2).toBe(1439); // 999/1000 * 1440 = 1438.56 rounds to 1439
      expect(py2).toBe(899); // 999/1000 * 900 = 899.1 rounds to 899
    });
  });

  describe('Click Actions', () => {
    test('should click at coordinates', async () => {
      mockPage.evaluateHandle.mockResolvedValue({
        asElement: () => null,
      });
      mockPage.accessibility.snapshot.mockResolvedValue(null);

      await actionExecutor.execute('click_at', { x: 500, y: 500 });
      expect(mockPage.mouse.click).toHaveBeenCalledWith(720, 450);
    });

    test('should double click at coordinates', async () => {
      mockPage.evaluateHandle.mockResolvedValue({
        asElement: () => null,
      });
      mockPage.accessibility.snapshot.mockResolvedValue(null);

      await actionExecutor.execute('double_click', { x: 500, y: 500 });
      expect(mockPage.mouse.dblclick).toHaveBeenCalledWith(720, 450);
    });

    test('should right click at coordinates', async () => {
      mockPage.evaluateHandle.mockResolvedValue({
        asElement: () => null,
      });
      mockPage.accessibility.snapshot.mockResolvedValue(null);

      await actionExecutor.execute('right_click', { x: 500, y: 500 });
      expect(mockPage.mouse.click).toHaveBeenCalledWith(720, 450, { button: 'right' });
    });
  });

  describe('Type Text Action', () => {
    test('should type text at coordinates', async () => {
      mockPage.evaluateHandle.mockResolvedValue({
        asElement: () => null,
      });
      mockPage.accessibility.snapshot.mockResolvedValue(null);

      await actionExecutor.execute('type_text_at', {
        x: 500,
        y: 500,
        text: 'hello',
        press_enter: true,
        clear_before_typing: false,
      });

      expect(mockPage.mouse.click).toHaveBeenCalled();
      expect(mockPage.keyboard.type).toHaveBeenCalledWith('hello');
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    });

    test('should clear before typing when requested', async () => {
      const mockElement = {
        click: jest.fn(),
        dispose: jest.fn(),
      };

      mockPage.evaluateHandle.mockResolvedValue({
        asElement: () => mockElement,
      });

      await actionExecutor.execute('type_text_at', {
        x: 500,
        y: 500,
        text: 'hello',
        clear_before_typing: true,
      });

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Control+A');
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Meta+A');
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Backspace');
    });
  });

  describe('Scroll Actions', () => {
    test('should scroll document down', async () => {
      await actionExecutor.execute('scroll_document', { direction: 'down' });
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('PageDown');
    });

    test('should scroll document up', async () => {
      await actionExecutor.execute('scroll_document', { direction: 'up' });
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('PageUp');
    });

    test('should scroll at coordinates', async () => {
      await actionExecutor.execute('scroll_at', {
        x: 500,
        y: 500,
        direction: 'down',
        magnitude: 800,
      });

      expect(mockPage.mouse.move).toHaveBeenCalledWith(720, 450);
      expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 720); // 800 * 900 / 1000
    });
  });

  describe('Navigation Actions', () => {
    test('should go back', async () => {
      await actionExecutor.execute('go_back', {});
      expect(mockPage.goBack).toHaveBeenCalled();
    });

    test('should go forward', async () => {
      await actionExecutor.execute('go_forward', {});
      expect(mockPage.goForward).toHaveBeenCalled();
    });
  });

  describe('Wait Action', () => {
    test('should wait 5 seconds', async () => {
      await actionExecutor.execute('wait_5_seconds', {});
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(5000);
    });
  });

  describe('Unimplemented Actions', () => {
    test('should handle unimplemented actions gracefully', async () => {
      await actionExecutor.execute('unknown_action', {});
      expect(mockLogger.log).toHaveBeenCalled();
    });

    test('should handle open_web_browser as no-op', async () => {
      await expect(actionExecutor.execute('open_web_browser', {})).resolves.toBeUndefined();
    });
  });

  describe('Accessibility Snapshot', () => {
    test('should get accessibility snapshot', async () => {
      const mockAxNode = {
        role: 'button',
        name: 'Click me',
        children: [
          {
            role: 'text',
            name: 'Label',
          },
        ],
      };

      mockPage.accessibility.snapshot.mockResolvedValue(mockAxNode);

      const ax = await actionExecutor.accessibilitySnapshot();

      expect(ax).toHaveLength(2);
      expect(ax[0].role).toBe('button');
      expect(ax[1].role).toBe('text');
    });

    test('should handle null accessibility snapshot', async () => {
      mockPage.accessibility.snapshot.mockResolvedValue(null);

      const ax = await actionExecutor.accessibilitySnapshot();

      expect(ax).toEqual([]);
    });
  });

  describe('Element Resolution', () => {
    test('should find element by hit testing', async () => {
      const mockElement = {
        click: jest.fn(),
        dispose: jest.fn(),
      };

      mockPage.evaluateHandle.mockResolvedValue({
        asElement: () => mockElement,
      });

      const el = await actionExecutor.elementAtOrNearest(500, 500);

      expect(el).toBe(mockElement);
    });

    test('should return null if no element found', async () => {
      mockPage.evaluateHandle.mockResolvedValue({
        asElement: () => null,
      });
      mockPage.accessibility.snapshot.mockResolvedValue(null);
      mockPage.evaluate.mockResolvedValue(null);

      const el = await actionExecutor.elementAtOrNearest(500, 500);

      expect(el).toBeNull();
    });
  });
});
