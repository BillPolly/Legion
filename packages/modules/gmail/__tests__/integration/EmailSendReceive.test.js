import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import GmailModule from '../../src/GmailModule.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs';
import path from 'path';

describe('Gmail Send/Receive Integration Tests', () => {
  let gmailModule;
  let resourceManager;
  const testSubjectPrefix = `Legion Test ${Date.now()}`;
  const testResultsDir = path.join(process.cwd(), '__tests__', 'results');
  const testDownloadsDir = path.join(testResultsDir, 'downloads');
  const testArtifactsDir = path.join(testResultsDir, 'artifacts');

  beforeAll(async () => {
    // Clean up before tests (as per project guidelines)
    if (fs.existsSync(testResultsDir)) {
      fs.rmSync(testResultsDir, { recursive: true, force: true });
    }
    
    // Create test directories
    fs.mkdirSync(testDownloadsDir, { recursive: true });
    fs.mkdirSync(testArtifactsDir, { recursive: true });
    
    // Initialize ResourceManager to load environment variables
    resourceManager = await ResourceManager.getInstance();
    
    // Initialize Gmail module
    gmailModule = new GmailModule();
    gmailModule.resourceManager = resourceManager;
    await gmailModule.initialize();

    console.log('Gmail integration tests initialized');
    console.log(`Test results will be saved to: ${testResultsDir}`);
  }, 30000);

  it('should send a plain text email and then read it back', async () => {
    const testSubject = `${testSubjectPrefix} - Plain Text Test`;
    const testBody = 'This is a test email sent by the Legion Gmail module integration test.';
    const recipient = resourceManager.get('env.GMAIL_USER');

    console.log(`Sending email with subject: ${testSubject}`);
    
    // Send the email
    const sendResult = await gmailModule.sendTextMessage(
      recipient,
      testSubject,
      testBody
    );

    expect(sendResult).toBeDefined();
    expect(sendResult.messageId).toBeDefined();
    console.log(`Email sent successfully. Message ID: ${sendResult.messageId}`);

    // Wait for the email to arrive and find it
    console.log('Waiting for email to arrive...');
    const foundEmail = await gmailModule.waitForEmailBySubject(testSubject, 30000);
    
    expect(foundEmail).toBeDefined();
    expect(foundEmail.subject).toContain(testSubject);
    console.log(`Found email: ${foundEmail.subject}`);

    // Get the full email content
    const emailWithContent = await gmailModule.getEmailWithContent(foundEmail.seqno);
    
    expect(emailWithContent.content.text).toContain(testBody);
    expect(emailWithContent.from).toContain(recipient);
    
    // Save test results for inspection
    const testResult = {
      test: 'plain-text-email',
      timestamp: new Date().toISOString(),
      sentEmail: {
        messageId: sendResult.messageId,
        subject: testSubject,
        body: testBody
      },
      receivedEmail: {
        seqno: foundEmail.seqno,
        subject: foundEmail.subject,
        from: foundEmail.from,
        date: foundEmail.date,
        contentPreview: emailWithContent.content.text?.substring(0, 200)
      }
    };
    
    fs.writeFileSync(
      path.join(testArtifactsDir, 'plain-text-test-result.json'),
      JSON.stringify(testResult, null, 2)
    );
    
    console.log('✅ Plain text email send/receive test passed!');
    console.log(`📄 Test results saved to: ${path.join(testArtifactsDir, 'plain-text-test-result.json')}`);
  }, 45000);

  it('should send an email with PDF attachment and download it', async () => {
    const testSubject = `${testSubjectPrefix} - PDF Attachment Test`;
    const testBody = 'This email contains a PDF attachment for testing.';
    const recipient = resourceManager.get('env.GMAIL_USER');

    // Create a test PDF file in artifacts directory
    const testPdfContent = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Legion Test PDF) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
0000000185 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
279
%%EOF`);

    const testPdfPath = path.join(testArtifactsDir, 'legion-test-original.pdf');
    fs.writeFileSync(testPdfPath, testPdfContent);

    console.log(`Sending email with PDF attachment. Subject: ${testSubject}`);

    // Send email with PDF attachment
    const sendResult = await gmailModule.sendMessage(
      recipient,
      testSubject,
      testBody,
      {
        attachments: [
          {
            filename: 'legion-test.pdf',
            path: testPdfPath,
            contentType: 'application/pdf'
          }
        ]
      }
    );

    expect(sendResult).toBeDefined();
    expect(sendResult.messageId).toBeDefined();
    console.log(`Email with attachment sent. Message ID: ${sendResult.messageId}`);

    // Wait for the email to arrive
    console.log('Waiting for email with attachment to arrive...');
    const foundEmail = await gmailModule.waitForEmailBySubject(testSubject, 30000);
    
    expect(foundEmail).toBeDefined();
    expect(foundEmail.subject).toContain(testSubject);
    console.log(`Found email with attachment: ${foundEmail.subject}`);

    // Get the full email content including attachments
    const emailWithContent = await gmailModule.getEmailWithContent(foundEmail.seqno);
    
    expect(emailWithContent.content.text).toContain(testBody);
    expect(emailWithContent.content.attachments).toBeDefined();
    expect(emailWithContent.content.attachments.length).toBeGreaterThan(0);

    const attachment = emailWithContent.content.attachments[0];
    expect(attachment.filename).toContain('legion-test.pdf');
    expect(attachment.contentType).toContain('pdf');
    
    console.log(`Found attachment: ${attachment.filename} (${attachment.contentType})`);

    // Download the attachment to downloads directory
    const downloadPath = path.join(testDownloadsDir, 'downloaded-legion-test.pdf');
    
    const downloadResult = await gmailModule.downloadAttachment(attachment, downloadPath);
    
    expect(downloadResult).toBeDefined();
    expect(downloadResult.path).toBe(downloadPath);
    expect(fs.existsSync(downloadPath)).toBe(true);
    
    // Verify the downloaded file content
    const downloadedContent = fs.readFileSync(downloadPath);
    expect(downloadedContent.length).toBeGreaterThan(0);
    expect(downloadedContent.toString()).toContain('Legion Test PDF');
    
    // Save test results for inspection
    const testResult = {
      test: 'pdf-attachment-email',
      timestamp: new Date().toISOString(),
      sentEmail: {
        messageId: sendResult.messageId,
        subject: testSubject,
        body: testBody,
        attachment: {
          originalPath: testPdfPath,
          filename: 'legion-test.pdf',
          contentType: 'application/pdf'
        }
      },
      receivedEmail: {
        seqno: foundEmail.seqno,
        subject: foundEmail.subject,
        from: foundEmail.from,
        date: foundEmail.date,
        attachment: {
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          downloadPath: downloadPath
        }
      },
      downloadResult: {
        success: true,
        path: downloadResult.path,
        fileExists: fs.existsSync(downloadPath),
        fileSize: downloadedContent.length
      }
    };
    
    fs.writeFileSync(
      path.join(testArtifactsDir, 'pdf-attachment-test-result.json'),
      JSON.stringify(testResult, null, 2)
    );
    
    console.log(`✅ PDF attachment downloaded successfully to: ${downloadPath}`);
    console.log(`📄 Test results saved to: ${path.join(testArtifactsDir, 'pdf-attachment-test-result.json')}`);
    console.log('✅ PDF attachment send/receive test passed!');
  }, 60000);
});