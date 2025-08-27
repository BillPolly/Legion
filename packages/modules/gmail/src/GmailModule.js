import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { Module } from '@legion/tools-registry';
import { createValidator } from '@legion/schema';

const gmailConfigSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'string',
      format: 'email',
      description: 'Gmail email address'
    },
    password: {
      type: 'string',
      description: 'Gmail app password'
    },
    smtp: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          default: 'smtp.gmail.com'
        },
        port: {
          type: 'number',
          default: 587
        },
        secure: {
          type: 'boolean',
          default: false
        }
      },
      default: {}
    },
    imap: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          default: 'imap.gmail.com'
        },
        port: {
          type: 'number',
          default: 993
        },
        tls: {
          type: 'boolean',
          default: true
        }
      },
      default: {}
    }
  }
};

const GmailConfigValidator = createValidator(gmailConfigSchema);

class GmailModule extends Module {
  constructor() {
    super();
    this.name = 'gmail';
    this.description = 'Gmail integration module for sending and receiving emails';
    this.version = '1.0.0';
    this.resourceManager = null;
    this.config = null;
    this.transporter = null;
    this.imap = null;
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new GmailModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  loadConfig(providedConfig) {
    const envConfig = {
      user: this.resourceManager.get('env.GMAIL_USER'),
      password: this.resourceManager.get('env.GMAIL_APP_PASSWORD'),
      smtp: {
        host: this.resourceManager.get('env.GMAIL_SMTP_HOST') || 'smtp.gmail.com',
        port: parseInt(this.resourceManager.get('env.GMAIL_SMTP_PORT') || '587'),
        secure: this.resourceManager.get('env.GMAIL_SMTP_SECURE') === 'true'
      },
      imap: {
        host: this.resourceManager.get('env.GMAIL_IMAP_HOST') || 'imap.gmail.com',
        port: parseInt(this.resourceManager.get('env.GMAIL_IMAP_PORT') || '993'),
        tls: this.resourceManager.get('env.GMAIL_IMAP_TLS') !== 'false'
      }
    };

    const mergedConfig = { ...envConfig, ...providedConfig };
    const result = GmailConfigValidator.validate(mergedConfig);
    if (!result.valid) {
      throw new Error(`Gmail configuration validation failed: ${result.errors.map(e => e.message).join(', ')}`);
    }
    return result.data;
  }

  async initialize() {
    await super.initialize();
    
    // Load config using resourceManager
    try {
      this.config = this.loadConfig({});
    } catch (error) {
      // If validation fails, use defaults
      this.config = {
        user: this.resourceManager?.get('env.GMAIL_USER') || '',
        password: this.resourceManager?.get('env.GMAIL_APP_PASSWORD') || '',
        smtp: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false
        },
        imap: {
          host: 'imap.gmail.com',
          port: 993,
          tls: true
        }
      };
    }
    
    try {
      // Only initialize if we have valid config
      if (this.config.user && this.config.password) {
        // Initialize SMTP transporter
        this.transporter = nodemailer.createTransport({
          host: this.config.smtp.host,
          port: this.config.smtp.port,
          secure: this.config.smtp.secure,
          auth: {
            user: this.config.user,
            pass: this.config.password
          }
        });

        // Initialize IMAP connection
        this.imap = new Imap({
          user: this.config.user,
          password: this.config.password,
          host: this.config.imap.host,
          port: this.config.imap.port,
          tls: this.config.imap.tls,
          tlsOptions: {
            rejectUnauthorized: false
          },
          authTimeout: 3000
        });

        // Verify SMTP connection
        await this.transporter.verify();
      }
      return true;
    } catch (error) {
      // Don't throw, just log - module can still be loaded
      console.warn(`Gmail module initialization warning: ${error.message}`);
      return true;
    }
  }

  async sendMessage(to, subject, body, options = {}) {
    if (!this.transporter) {
      throw new Error('Gmail module not initialized. Call initialize() first.');
    }

    const { from, cc, bcc, html, attachments } = options;

    const mailOptions = {
      from: from || this.config.user,
      to,
      subject,
      text: html ? undefined : body,
      html: html ? body : undefined,
      cc,
      bcc,
      attachments
    };

    const info = await this.transporter.sendMail(mailOptions);
    return info;
  }

  async sendHtmlMessage(to, subject, htmlBody, options = {}) {
    return this.sendMessage(to, subject, htmlBody, { ...options, html: true });
  }

  async sendTextMessage(to, subject, textBody, options = {}) {
    return this.sendMessage(to, subject, textBody, { ...options, html: false });
  }

  async testConnection() {
    if (!this.transporter) {
      throw new Error('Gmail module not initialized. Call initialize() first.');
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'SMTP connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  getConfig() {
    return {
      user: this.config.user,
      smtp: this.config.smtp,
      imap: this.config.imap
    };
  }

  async connectImap() {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => resolve());
      this.imap.once('error', reject);
      this.imap.connect();
    });
  }

  async disconnectImap() {
    return new Promise((resolve) => {
      if (this.imap.state === 'disconnected') {
        resolve();
        return;
      }
      this.imap.once('end', () => resolve());
      this.imap.end();
    });
  }

  async openInbox() {
    return new Promise((resolve, reject) => {
      this.imap.openBox('INBOX', true, (err, box) => {
        if (err) reject(err);
        else resolve(box);
      });
    });
  }

  async getEmails(limit = 10, folder = 'INBOX') {
    if (!this.imap) {
      throw new Error('Gmail module not initialized. Call initialize() first.');
    }

    try {
      await this.connectImap();
      const box = await this.openInbox();
      
      if (box.messages.total === 0) {
        await this.disconnectImap();
        return [];
      }

      const emails = [];
      const fetchLimit = Math.min(limit, box.messages.total);
      const start = Math.max(1, box.messages.total - fetchLimit + 1);
      const end = box.messages.total;

      return new Promise((resolve, reject) => {
        const f = this.imap.seq.fetch(`${start}:${end}`, {
          bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
          struct: true
        });

        f.on('message', (msg, seqno) => {
          const email = { seqno };
          
          msg.on('body', (stream, info) => {
            let buffer = '';
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
            stream.once('end', () => {
              const parsed = Imap.parseHeader(buffer);
              email.from = parsed.from?.[0] || '';
              email.to = parsed.to?.[0] || '';
              email.subject = parsed.subject?.[0] || '';
              email.date = parsed.date?.[0] || '';
            });
          });

          msg.once('end', () => {
            emails.push(email);
          });
        });

        f.once('error', reject);
        f.once('end', async () => {
          await this.disconnectImap();
          // Sort by sequence number (newest first)
          emails.sort((a, b) => b.seqno - a.seqno);
          resolve(emails);
        });
      });
    } catch (error) {
      await this.disconnectImap();
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }
  }

  async getEmailContent(seqno) {
    if (!this.imap) {
      throw new Error('Gmail module not initialized. Call initialize() first.');
    }

    try {
      await this.connectImap();
      await this.openInbox();

      return new Promise((resolve, reject) => {
        const f = this.imap.seq.fetch(seqno, { bodies: '' });
        
        f.on('message', (msg) => {
          msg.on('body', (stream) => {
            simpleParser(stream, (err, parsed) => {
              if (err) reject(err);
              else resolve(parsed);
            });
          });
        });

        f.once('error', reject);
        f.once('end', async () => {
          await this.disconnectImap();
        });
      });
    } catch (error) {
      await this.disconnectImap();
      throw new Error(`Failed to fetch email content: ${error.message}`);
    }
  }

  async getFirstEmail() {
    const emails = await this.getEmails(1);
    if (emails.length === 0) {
      return null;
    }
    
    const firstEmail = emails[0];
    const content = await this.getEmailContent(firstEmail.seqno);
    
    return {
      ...firstEmail,
      content: {
        text: content.text,
        html: content.html,
        attachments: content.attachments
      }
    };
  }

  async findEmailBySubject(subject, limit = 50) {
    const emails = await this.getEmails(limit);
    return emails.find(email => 
      email.subject && email.subject.includes(subject)
    );
  }

  async getEmailWithContent(seqno) {
    const emails = await this.getEmails(100);
    const email = emails.find(e => e.seqno === seqno);
    if (!email) {
      throw new Error(`Email with sequence number ${seqno} not found`);
    }

    const content = await this.getEmailContent(seqno);
    return {
      ...email,
      content: {
        text: content.text,
        html: content.html,
        attachments: content.attachments || []
      }
    };
  }

  async downloadAttachment(attachment, outputPath) {
    const fs = await import('fs');
    const path = await import('path');
    
    if (!attachment.content) {
      throw new Error('Attachment has no content to download');
    }

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write attachment content to file
    fs.writeFileSync(outputPath, attachment.content);
    
    return {
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      path: outputPath
    };
  }

  async waitForEmailBySubject(subject, timeoutMs = 30000, checkIntervalMs = 2000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const email = await this.findEmailBySubject(subject);
        if (email) {
          return email;
        }
      } catch (error) {
        console.warn('Error checking for email:', error.message);
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }
    
    throw new Error(`Email with subject containing "${subject}" not found within ${timeoutMs}ms`);
  }

  /**
   * Get all tools provided by this module
   * @returns {Array<Object>} Array of tool definitions
   */
  getTools() {
    // Gmail module provides direct API methods instead of wrapped tools
    return [];
  }
}

export default GmailModule;