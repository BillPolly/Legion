import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GmailModule } from '../../src/GmailModule.js';

jest.mock('nodemailer', () => ({
  default: {
    createTransport: jest.fn().mockReturnValue({
      verify: jest.fn().mockResolvedValue(true),
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
    })
  }
}));

jest.mock('@legion/resource-manager', () => ({
  ResourceManager: {
    getInstance: jest.fn().mockReturnValue({
      get: jest.fn((key) => {
        const envVars = {
          'env.GMAIL_USER': 'test@gmail.com',
          'env.GMAIL_APP_PASSWORD': 'test_app_password',
          'env.GMAIL_HOST': 'smtp.gmail.com',
          'env.GMAIL_PORT': '587',
          'env.GMAIL_SECURE': 'false'
        };
        return envVars[key];
      })
    })
  }
}));

describe('GmailModule', () => {
  let gmailModule;

  beforeEach(() => {
    jest.clearAllMocks();
    gmailModule = new GmailModule({
      user: 'test@gmail.com',
      password: 'test_app_password'
    });
  });

  describe('constructor', () => {
    it('should create instance with resource manager', () => {
      expect(gmailModule.resourceManager).toBeDefined();
      expect(gmailModule.config).toBeDefined();
    });

    it('should load config from provided values', () => {
      expect(gmailModule.config.user).toBe('test@gmail.com');
      expect(gmailModule.config.password).toBe('test_app_password');
      expect(gmailModule.config.host).toBe('smtp.gmail.com');
      expect(gmailModule.config.port).toBe(587);
      expect(gmailModule.config.secure).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize SMTP transporter successfully', async () => {
      const result = await gmailModule.initialize();
      expect(result).toBe(true);
      expect(gmailModule.transporter).toBeDefined();
    });

    it('should verify SMTP connection during initialization', async () => {
      await gmailModule.initialize();
      expect(gmailModule.transporter.verify).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      await gmailModule.initialize();
    });

    it('should send text message successfully', async () => {
      const result = await gmailModule.sendMessage('recipient@example.com', 'Test Subject', 'Test Body');
      
      expect(result).toEqual({ messageId: 'test-message-id' });
      expect(gmailModule.transporter.sendMail).toHaveBeenCalledWith({
        from: 'test@gmail.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test Body',
        html: undefined,
        cc: undefined,
        bcc: undefined
      });
    });

    it('should send message with options', async () => {
      await gmailModule.sendMessage(
        'recipient@example.com',
        'Test Subject',
        'Test Body',
        { cc: 'cc@example.com', bcc: 'bcc@example.com' }
      );

      expect(gmailModule.transporter.sendMail).toHaveBeenCalledWith({
        from: 'test@gmail.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test Body',
        html: undefined,
        cc: 'cc@example.com',
        bcc: 'bcc@example.com'
      });
    });

    it('should throw error if not initialized', async () => {
      const uninitializedModule = new GmailModule({
        user: 'test@gmail.com',
        password: 'test_password'
      });
      await expect(uninitializedModule.sendMessage('test@example.com', 'Subject', 'Body'))
        .rejects.toThrow('Gmail module not initialized');
    });
  });

  describe('sendHtmlMessage', () => {
    beforeEach(async () => {
      await gmailModule.initialize();
    });

    it('should send HTML message', async () => {
      await gmailModule.sendHtmlMessage('recipient@example.com', 'Test Subject', '<h1>Test Body</h1>');

      expect(gmailModule.transporter.sendMail).toHaveBeenCalledWith({
        from: 'test@gmail.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: undefined,
        html: '<h1>Test Body</h1>',
        cc: undefined,
        bcc: undefined
      });
    });
  });

  describe('sendTextMessage', () => {
    beforeEach(async () => {
      await gmailModule.initialize();
    });

    it('should send text message', async () => {
      await gmailModule.sendTextMessage('recipient@example.com', 'Test Subject', 'Plain text body');

      expect(gmailModule.transporter.sendMail).toHaveBeenCalledWith({
        from: 'test@gmail.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Plain text body',
        html: undefined,
        cc: undefined,
        bcc: undefined
      });
    });
  });

  describe('testConnection', () => {
    it('should test SMTP connection successfully', async () => {
      await gmailModule.initialize();
      const result = await gmailModule.testConnection();
      
      expect(result).toEqual({ success: true, message: 'SMTP connection successful' });
      expect(gmailModule.transporter.verify).toHaveBeenCalled();
    });

    it('should handle connection failure', async () => {
      await gmailModule.initialize();
      gmailModule.transporter.verify.mockRejectedValue(new Error('Connection failed'));
      
      const result = await gmailModule.testConnection();
      expect(result).toEqual({ success: false, message: 'Connection failed' });
    });

    it('should throw error if not initialized', async () => {
      await expect(gmailModule.testConnection()).rejects.toThrow('Gmail module not initialized');
    });
  });

  describe('getConfig', () => {
    it('should return configuration without password', () => {
      const config = gmailModule.getConfig();
      
      expect(config).toEqual({
        user: 'test@gmail.com',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false
      });
      expect(config.password).toBeUndefined();
    });
  });
});