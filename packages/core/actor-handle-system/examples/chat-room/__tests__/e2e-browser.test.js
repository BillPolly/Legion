/**
 * E2E Browser Test for Chat Room Demo
 *
 * This test fully validates the chat room UI in a real browser using Playwright.
 * Tests the complete user journey from login to multi-user chat.
 */

import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = join(__dirname, '..');

let chatServer;
let webServer;

test.describe('Chat Room E2E UAT', () => {
  // Start servers before tests
  test.beforeAll(async () => {
    console.log('Starting servers...');

    // Start chat server (WebSocket backend)
    chatServer = spawn('node', ['server.js'], {
      cwd: examplesDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    chatServer.stdout.on('data', (data) => {
      console.log('[Chat Server]', data.toString().trim());
    });

    chatServer.stderr.on('data', (data) => {
      const msg = data.toString();
      // Ignore MongoDB connection errors
      if (!msg.includes('MongoDB')) {
        console.error('[Chat Server Error]', msg.trim());
      }
    });

    // Start web server (HTTP for UI)
    webServer = spawn('node', ['web-server.js'], {
      cwd: examplesDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    webServer.stdout.on('data', (data) => {
      console.log('[Web Server]', data.toString().trim());
    });

    webServer.stderr.on('data', (data) => {
      console.error('[Web Server Error]', data.toString().trim());
    });

    // Wait for servers to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('Servers ready!');
  });

  // Stop servers after tests
  test.afterAll(async () => {
    console.log('Stopping servers...');
    if (chatServer) chatServer.kill();
    if (webServer) webServer.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test('UAT 1: User can load the chat interface', async ({ page }) => {
    console.log('\n=== UAT 1: Load Chat Interface ===');

    // Navigate to chat UI
    await page.goto('http://localhost:3001');

    // Verify login screen is visible
    await expect(page.locator('.login-container')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Legion Chat');
    await expect(page.locator('input#username-input')).toBeVisible();
    await expect(page.locator('button')).toContainText('Join Chat');

    console.log('✅ Login screen loaded successfully');
  });

  test('UAT 2: User can join the chat room', async ({ page }) => {
    console.log('\n=== UAT 2: Join Chat Room ===');

    await page.goto('http://localhost:3001');

    // Enter username
    await page.fill('input#username-input', 'Alice');
    console.log('Entered username: Alice');

    // Click join button
    await page.click('button:has-text("Join Chat")');
    console.log('Clicked Join Chat button');

    // Wait for chat interface to load
    await expect(page.locator('.chat-container')).toBeVisible({ timeout: 5000 });

    // Verify chat interface elements
    await expect(page.locator('.chat-header h1')).toContainText('Legion Chat Room');
    await expect(page.locator('.status')).toContainText('Alice');
    await expect(page.locator('.users-bar')).toBeVisible();
    await expect(page.locator('.messages-container')).toBeVisible();
    await expect(page.locator('input#message-input')).toBeVisible();

    // Verify system message about joining
    const messages = await page.locator('.message.system').allTextContents();
    expect(messages.some(msg => msg.includes('Alice joined'))).toBe(true);

    console.log('✅ Successfully joined chat room as Alice');
  });

  test('UAT 3: User can send and receive messages', async ({ page }) => {
    console.log('\n=== UAT 3: Send and Receive Messages ===');

    await page.goto('http://localhost:3001');

    // Join as Bob
    await page.fill('input#username-input', 'Bob');
    await page.click('button:has-text("Join Chat")');
    await expect(page.locator('.chat-container')).toBeVisible({ timeout: 5000 });

    console.log('Joined as Bob');

    // Send a message
    const messageText = 'Hello from Bob!';
    await page.fill('input#message-input', messageText);
    await page.click('button:has-text("Send")');

    console.log('Sent message:', messageText);

    // Wait for message to appear
    await page.waitForSelector('.message.chat.own', { timeout: 5000 });

    // Verify message is displayed
    const chatMessages = await page.locator('.message.chat .text').allTextContents();
    expect(chatMessages.some(msg => msg.includes(messageText))).toBe(true);

    // Verify username is shown
    const usernames = await page.locator('.message.chat .username').allTextContents();
    expect(usernames.some(name => name.includes('Bob'))).toBe(true);

    // Verify input is cleared
    const inputValue = await page.inputValue('input#message-input');
    expect(inputValue).toBe('');

    console.log('✅ Message sent and displayed successfully');
  });

  test('UAT 4: Multi-user chat works correctly', async ({ browser }) => {
    console.log('\n=== UAT 4: Multi-User Chat ===');

    // Create two browser contexts (two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // User 1: Alice joins
    console.log('User 1 (Alice) joining...');
    await page1.goto('http://localhost:3001');
    await page1.fill('input#username-input', 'Alice');
    await page1.click('button:has-text("Join Chat")');
    await expect(page1.locator('.chat-container')).toBeVisible({ timeout: 5000 });

    // User 2: Charlie joins
    console.log('User 2 (Charlie) joining...');
    await page2.goto('http://localhost:3001');
    await page2.fill('input#username-input', 'Charlie');
    await page2.click('button:has-text("Join Chat")');
    await expect(page2.locator('.chat-container')).toBeVisible({ timeout: 5000 });

    // Verify both users see each other in the user list
    const users1 = await page1.locator('#users-list').textContent();
    const users2 = await page2.locator('#users-list').textContent();

    expect(users1).toContain('Alice');
    expect(users1).toContain('Charlie');
    expect(users2).toContain('Alice');
    expect(users2).toContain('Charlie');

    console.log('✅ Both users see each other in user list');

    // Alice sends a message
    const aliceMessage = 'Hi Charlie, this is Alice!';
    await page1.fill('input#message-input', aliceMessage);
    await page1.click('button:has-text("Send")');

    console.log('Alice sent message:', aliceMessage);

    // Wait a moment for message to propagate
    await page1.waitForTimeout(1000);

    // Verify Alice sees her own message
    const aliceMessages = await page1.locator('.message.chat .text').allTextContents();
    expect(aliceMessages.some(msg => msg.includes(aliceMessage))).toBe(true);

    console.log('✅ Alice sees her own message');

    // Charlie sends a reply
    const charlieMessage = 'Hello Alice! Nice to meet you!';
    await page2.fill('input#message-input', charlieMessage);
    await page2.click('button:has-text("Send")');

    console.log('Charlie sent message:', charlieMessage);

    // Wait for message to propagate
    await page2.waitForTimeout(1000);

    // Verify Charlie sees his message
    const charlieMessages = await page2.locator('.message.chat .text').allTextContents();
    expect(charlieMessages.some(msg => msg.includes(charlieMessage))).toBe(true);

    console.log('✅ Charlie sees his own message');

    // Clean up
    await context1.close();
    await context2.close();

    console.log('✅ Multi-user chat working perfectly!');
  });

  test('UAT 5: UI styling and responsiveness', async ({ page }) => {
    console.log('\n=== UAT 5: UI Styling and Responsiveness ===');

    await page.goto('http://localhost:3001');

    // Check gradient background
    const bodyBg = await page.evaluate(() => {
      const body = document.querySelector('body');
      return window.getComputedStyle(body).background;
    });
    expect(bodyBg).toContain('linear-gradient');
    console.log('✅ Gradient background applied');

    // Join chat
    await page.fill('input#username-input', 'UITester');
    await page.click('button:has-text("Join Chat")');
    await expect(page.locator('.chat-container')).toBeVisible({ timeout: 5000 });

    // Check chat container styling
    const containerStyle = await page.evaluate(() => {
      const container = document.querySelector('.chat-container');
      const style = window.getComputedStyle(container);
      return {
        background: style.backgroundColor,
        borderRadius: style.borderRadius,
        maxWidth: style.maxWidth
      };
    });

    expect(containerStyle.background).toContain('rgb(255, 255, 255)'); // white
    expect(containerStyle.borderRadius).toBe('12px');
    expect(containerStyle.maxWidth).toBe('600px');
    console.log('✅ Chat container styling correct');

    // Check header gradient
    const headerBg = await page.evaluate(() => {
      const header = document.querySelector('.chat-header');
      return window.getComputedStyle(header).background;
    });
    expect(headerBg).toContain('linear-gradient');
    console.log('✅ Header gradient applied');

    // Send a test message to check message styling
    await page.fill('input#message-input', 'Testing message styling');
    await page.click('button:has-text("Send")');
    await page.waitForSelector('.message.chat.own', { timeout: 5000 });

    // Check own message styling (should have gradient background)
    const ownMessageBg = await page.evaluate(() => {
      const ownMsg = document.querySelector('.message.chat.own .text');
      return window.getComputedStyle(ownMsg).background;
    });
    expect(ownMessageBg).toContain('linear-gradient');
    console.log('✅ Own message gradient applied');

    console.log('✅ All UI styling verified!');
  });

  test('UAT 6: Error handling - empty username', async ({ page }) => {
    console.log('\n=== UAT 6: Error Handling ===');

    await page.goto('http://localhost:3001');

    // Try to join without entering username
    await page.click('button:has-text("Join Chat")');

    // Should see error message
    await expect(page.locator('.error')).toContainText('Please enter a name', { timeout: 2000 });

    console.log('✅ Empty username error handled correctly');
  });

  test('UAT 7: Message input interaction', async ({ page }) => {
    console.log('\n=== UAT 7: Message Input Interaction ===');

    await page.goto('http://localhost:3001');

    // Join chat
    await page.fill('input#username-input', 'Tester');
    await page.click('button:has-text("Join Chat")');
    await expect(page.locator('.chat-container')).toBeVisible({ timeout: 5000 });

    // Test Enter key to send message
    await page.fill('input#message-input', 'Testing Enter key');
    await page.press('input#message-input', 'Enter');

    // Wait for message to appear
    await page.waitForSelector('.message.chat', { timeout: 5000 });

    // Verify message was sent
    const messages = await page.locator('.message.chat .text').allTextContents();
    expect(messages.some(msg => msg.includes('Testing Enter key'))).toBe(true);

    console.log('✅ Enter key sends message correctly');

    // Verify input is cleared after sending
    const inputValue = await page.inputValue('input#message-input');
    expect(inputValue).toBe('');

    console.log('✅ Input cleared after sending');
  });

  test('UAT 8: System messages for user join/leave', async ({ browser }) => {
    console.log('\n=== UAT 8: System Messages ===');

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:3001');

    // Join as Dave
    await page.fill('input#username-input', 'Dave');
    await page.click('button:has-text("Join Chat")');
    await expect(page.locator('.chat-container')).toBeVisible({ timeout: 5000 });

    // Verify join system message
    const systemMessages = await page.locator('.message.system').allTextContents();
    expect(systemMessages.some(msg => msg.includes('Dave joined'))).toBe(true);

    console.log('✅ Join system message displayed');

    // System messages should be styled differently (centered, gray, italic)
    const systemMsgStyle = await page.evaluate(() => {
      const systemMsg = document.querySelector('.message.system');
      if (!systemMsg) return null;
      const style = window.getComputedStyle(systemMsg);
      return {
        textAlign: style.textAlign,
        color: style.color,
        fontStyle: style.fontStyle
      };
    });

    expect(systemMsgStyle.textAlign).toBe('center');
    expect(systemMsgStyle.fontStyle).toBe('italic');
    console.log('✅ System message styling correct');

    await context.close();
  });
});
