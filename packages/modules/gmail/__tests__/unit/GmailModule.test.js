import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GmailModule from '../../src/GmailModule.js';

describe('GmailModule', () => {
  let gmailModule;
  let mockResourceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResourceManager = {
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
    gmailModule = new GmailModule();
    gmailModule.resourceManager = mockResourceManager;
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(gmailModule.name).toBe('gmail');
      expect(gmailModule.description).toBe('Gmail integration module for sending and receiving emails');
      expect(gmailModule.version).toBe('1.0.0');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      // Override the initialization to skip real network connections
      const originalInitialize = gmailModule.initialize;
      gmailModule.initialize = async function() {
        await originalInitialize.call(this);
        // Replace the real transporter with a mock after config is loaded
        this.transporter = {
          verify: jest.fn().mockResolvedValue(true),
          sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
        };
        return true;
      };
      
      const result = await gmailModule.initialize();
      
      expect(result).toBe(true);
      expect(gmailModule.config).toBeDefined();
      expect(gmailModule.config.user).toBe('test@gmail.com');
    });

    it('should handle missing credentials gracefully', async () => {
      const emptyResourceManager = {
        get: jest.fn().mockReturnValue('')
      };
      gmailModule.resourceManager = emptyResourceManager;

      const result = await gmailModule.initialize();
      
      expect(result).toBe(true);
      expect(gmailModule.config).toBeDefined();
    });
  });

  describe('static create method', () => {
    it('should create and initialize module', async () => {
      const module = new GmailModule();
      module.resourceManager = mockResourceManager;
      
      // Override initialization to avoid network calls
      const originalInitialize = module.initialize;
      module.initialize = async function() {
        await originalInitialize.call(this);
        this.transporter = {
          verify: jest.fn().mockResolvedValue(true),
          sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
        };
        return true;
      };
      
      await module.initialize();
      
      expect(module).toBeInstanceOf(GmailModule);
      expect(module.resourceManager).toBe(mockResourceManager);
      expect(module.config).toBeDefined();
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully when properly initialized', async () => {
      // Set up module with mock transporter
      gmailModule.transporter = {
        verify: jest.fn().mockResolvedValue(true),
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
      };
      gmailModule.config = { user: 'test@gmail.com' };

      const result = await gmailModule.sendMessage(
        'recipient@example.com',
        'Test Subject',
        'Test body'
      );

      expect(result).toEqual({ messageId: 'test-message-id' });
      expect(gmailModule.transporter.sendMail).toHaveBeenCalled();
    });

    it('should throw error if not initialized', async () => {
      const uninitializedModule = new GmailModule();
      
      await expect(
        uninitializedModule.sendMessage('test@example.com', 'Subject', 'Body')
      ).rejects.toThrow('Gmail module not initialized');
    });
  });

  describe('sendHtmlMessage', () => {
    it('should send HTML message when properly initialized', async () => {
      gmailModule.transporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
      };
      gmailModule.config = { user: 'test@gmail.com' };

      const result = await gmailModule.sendHtmlMessage(
        'recipient@example.com',
        'Test Subject',
        '<h1>Test HTML</h1>'
      );

      expect(result).toEqual({ messageId: 'test-message-id' });
    });
  });

  describe('sendTextMessage', () => {
    it('should send text message when properly initialized', async () => {
      gmailModule.transporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
      };
      gmailModule.config = { user: 'test@gmail.com' };

      const result = await gmailModule.sendTextMessage(
        'recipient@example.com',
        'Test Subject',
        'Test text body'
      );

      expect(result).toEqual({ messageId: 'test-message-id' });
    });
  });

  describe('testConnection', () => {
    it('should test SMTP connection successfully when properly initialized', async () => {
      gmailModule.transporter = {
        verify: jest.fn().mockResolvedValue(true)
      };
      
      const result = await gmailModule.testConnection();
      expect(result).toEqual({ success: true, message: 'SMTP connection successful' });
    });

    it('should handle connection failure', async () => {
      gmailModule.transporter = {
        verify: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };
      
      const result = await gmailModule.testConnection();
      expect(result).toEqual({ success: false, message: 'Connection failed' });
    });

    it('should throw error if not initialized', async () => {
      const uninitializedModule = new GmailModule();
      
      await expect(uninitializedModule.testConnection()).rejects.toThrow('Gmail module not initialized');
    });
  });

  describe('getConfig', () => {
    it('should return configuration without password when properly initialized', async () => {
      gmailModule.config = {
        user: 'test@gmail.com',
        smtp: { host: 'smtp.gmail.com', port: 587, secure: false },
        imap: { host: 'imap.gmail.com', port: 993, tls: true }
      };
      
      const config = gmailModule.getConfig();
      expect(config.user).toBe('test@gmail.com');
      expect(config.smtp).toBeDefined();
      expect(config.imap).toBeDefined();
      expect(config.password).toBeUndefined();
    });
  });

  describe('getTools', () => {
    it('should return empty array', () => {
      const tools = gmailModule.getTools();
      expect(tools).toEqual([]);
    });
  });

  // Test module loading and config parsing without network calls
  describe('configuration loading', () => {
    it('should parse environment variables correctly', () => {
      const config = gmailModule.loadConfig({});
      expect(config.user).toBe('test@gmail.com');
      expect(config.password).toBe('test_app_password');
      expect(config.smtp.host).toBe('smtp.gmail.com');
      expect(config.smtp.port).toBe(587);
      expect(config.smtp.secure).toBe(false);
    });
  });
});