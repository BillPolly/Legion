import { describe, it, expect, beforeEach } from '@jest/globals';
import { GmailModule } from '../../src/GmailModule.js';

describe('GmailModule Integration Tests', () => {
  let gmailModule;

  beforeEach(() => {
    gmailModule = new GmailModule({
      user: 'test@gmail.com',
      password: 'test_password'
    });
  });

  describe('Real SMTP Integration', () => {
    it('should fail fast without valid credentials', async () => {
      const invalidModule = new GmailModule({
        user: 'invalid@example.com',
        password: 'invalid_password'
      });

      await expect(invalidModule.initialize()).rejects.toThrow();
    });

    it('should validate configuration schema', () => {
      expect(() => {
        new GmailModule({
          user: 'not-an-email',
          password: ''
        });
      }).toThrow();
    });

    it('should require valid email format', () => {
      expect(() => {
        new GmailModule({
          user: 'invalid-email',
          password: 'valid_password'
        });
      }).toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw meaningful errors for missing configuration', () => {
      expect(() => {
        new GmailModule({
          user: '',
          password: ''
        });
      }).toThrow();
    });

    it('should handle SMTP connection failures gracefully', async () => {
      const moduleWithBadConfig = new GmailModule({
        user: 'test@gmail.com',
        password: 'wrong_password',
        host: 'nonexistent.smtp.server',
        port: 9999
      });

      await expect(moduleWithBadConfig.initialize()).rejects.toThrow();
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
    it('should prioritize provided config over environment', () => {
      const customModule = new GmailModule({
        user: 'custom@example.com',
        password: 'custom_password',
        host: 'custom.smtp.com',
        port: 465,
        secure: true
      });

      const config = customModule.getConfig();
      expect(config.user).toBe('custom@example.com');
      expect(config.host).toBe('custom.smtp.com');
      expect(config.port).toBe(465);
      expect(config.secure).toBe(true);
    });

    it('should use default values for optional settings', () => {
      const minimalModule = new GmailModule({
        user: 'test@gmail.com',
        password: 'test_password'
      });

      const config = minimalModule.getConfig();
      expect(config.host).toBe('smtp.gmail.com');
      expect(config.port).toBe(587);
      expect(config.secure).toBe(false);
    });
  });
});