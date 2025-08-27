import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GmailModule from '../../src/GmailModule.js';
import { ResourceManager } from '@legion/resource-manager';

// Mock ResourceManager
const mockResourceManager = {
  get: jest.fn().mockImplementation((key) => {
    const values = {
      'env.GMAIL_USER': 'test@gmail.com',
      'env.GMAIL_APP_PASSWORD': 'test_app_password',
      'env.GMAIL_SMTP_HOST': 'smtp.gmail.com',
      'env.GMAIL_SMTP_PORT': '587',
      'env.GMAIL_SMTP_SECURE': 'false',
      'env.GMAIL_IMAP_HOST': 'imap.gmail.com',
      'env.GMAIL_IMAP_PORT': '993',
      'env.GMAIL_IMAP_TLS': 'true'
    };
    return values[key];
  })
};

describe('GmailModule Integration Tests', () => {
  let gmailModule;

  beforeEach(async () => {
    gmailModule = new GmailModule();
    gmailModule.resourceManager = mockResourceManager;
  });

  describe('Real SMTP Integration', () => {
    it('should handle invalid credentials gracefully', async () => {
      const invalidResourceManager = {
        get: jest.fn().mockReturnValue('')
      };
      const invalidModule = new GmailModule();
      invalidModule.resourceManager = invalidResourceManager;

      // Should not throw but should warn
      const result = await invalidModule.initialize();
      expect(result).toBe(true);
    });

    it('should handle missing configuration gracefully', async () => {
      const emptyResourceManager = {
        get: jest.fn().mockReturnValue(undefined)
      };
      const module = new GmailModule();
      module.resourceManager = emptyResourceManager;

      // Should not throw but use defaults
      const result = await module.initialize();
      expect(result).toBe(true);
    });

    it('should use provided configuration', async () => {
      const validResourceManager = {
        get: jest.fn().mockImplementation((key) => {
          const values = {
            'env.GMAIL_USER': 'valid@gmail.com',
            'env.GMAIL_APP_PASSWORD': 'valid_password'
          };
          return values[key];
        })
      };
      const module = new GmailModule();
      module.resourceManager = validResourceManager;

      const result = await module.initialize();
      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', async () => {
      const emptyResourceManager = {
        get: jest.fn().mockReturnValue('')
      };
      const module = new GmailModule();
      module.resourceManager = emptyResourceManager;

      const result = await module.initialize();
      expect(result).toBe(true);
    });

    it('should handle SMTP connection failures gracefully', async () => {
      const badResourceManager = {
        get: jest.fn().mockImplementation((key) => {
          const values = {
            'env.GMAIL_USER': 'test@gmail.com',
            'env.GMAIL_APP_PASSWORD': 'wrong_password',
            'env.GMAIL_SMTP_HOST': 'nonexistent.server.com',
            'env.GMAIL_SMTP_PORT': '9999'
          };
          return values[key];
        })
      };
      const module = new GmailModule();
      module.resourceManager = badResourceManager;

      // Should not throw but warn
      const result = await module.initialize();
      expect(result).toBe(true);
    });

    it('should require initialization before sending emails', async () => {
      await expect(
        gmailModule.sendMessage('test@example.com', 'Subject', 'Body')
      ).rejects.toThrow('Gmail module not initialized');
    });

    it('should require initialization before testing connection', async () => {
      await expect(gmailModule.testConnection()).rejects.toThrow('Gmail module not initialized');
    });
  });

  describe('Configuration Loading', () => {
    it('should load configuration from ResourceManager', async () => {
      const customResourceManager = {
        get: jest.fn().mockImplementation((key) => {
          const values = {
            'env.GMAIL_USER': 'custom@example.com',
            'env.GMAIL_APP_PASSWORD': 'custom_password',
            'env.GMAIL_SMTP_HOST': 'custom.smtp.com',
            'env.GMAIL_SMTP_PORT': '465',
            'env.GMAIL_SMTP_SECURE': 'true'
          };
          return values[key];
        })
      };
      const module = new GmailModule();
      module.resourceManager = customResourceManager;
      await module.initialize();

      const config = module.getConfig();
      expect(config.user).toBe('custom@example.com');
      expect(config.smtp.host).toBe('custom.smtp.com');
      expect(config.smtp.port).toBe(465);
      expect(config.smtp.secure).toBe(true);
    });

    it('should use default values for optional settings', async () => {
      const minimalResourceManager = {
        get: jest.fn().mockImplementation((key) => {
          const values = {
            'env.GMAIL_USER': 'test@gmail.com',
            'env.GMAIL_APP_PASSWORD': 'test_password'
          };
          return values[key];
        })
      };
      const module = new GmailModule();
      module.resourceManager = minimalResourceManager;
      await module.initialize();

      const config = module.getConfig();
      expect(config.smtp.host).toBe('smtp.gmail.com');
      expect(config.smtp.port).toBe(587);
      expect(config.smtp.secure).toBe(false);
    });
  });
});