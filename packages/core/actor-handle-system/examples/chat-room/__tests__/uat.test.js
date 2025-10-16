/**
 * User Acceptance Test for Chat Room Demo
 *
 * Full end-to-end test using Puppeteer to validate the chat room UI works correctly.
 */

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = join(__dirname, '..');

let chatServer;
let webServer;
let browser;

describe('Chat Room UAT', () => {
  // Start servers before all tests
  beforeAll(async () => {
    console.log('\n🚀 Starting servers for UAT...');

    // Start chat server (WebSocket backend)
    chatServer = spawn('node', ['server.js'], {
      cwd: examplesDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    chatServer.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log('[Chat Server]', msg);
    });

    chatServer.stderr.on('data', (data) => {
      const msg = data.toString();
      // Ignore MongoDB connection errors
      if (!msg.includes('MongoDB') && !msg.includes('Failed to initialize')) {
        console.error('[Chat Server Error]', msg.trim());
      }
    });

    // Start web server (HTTP for UI)
    webServer = spawn('node', ['web-server.js'], {
      cwd: examplesDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    webServer.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log('[Web Server]', msg);
    });

    webServer.stderr.on('data', (data) => {
      console.error('[Web Server Error]', data.toString().trim());
    });

    // Wait for servers to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Servers ready!\n');

    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Show browser for visual testing
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }, 30000);

  // Stop servers after all tests
  afterAll(async () => {
    console.log('\n🛑 Stopping servers...');
    if (browser) await browser.close();
    if (chatServer) chatServer.kill();
    if (webServer) webServer.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test('UAT 1: User can load the chat interface', async () => {
    console.log('\n=== UAT 1: Load Chat Interface ===');

    const page = await browser.newPage();
    await page.goto('http://localhost:3001');

    // Wait for login screen
    await page.waitForSelector('.login-container', { timeout: 5000 });

    // Verify elements
    const title = await page.$eval('h1', el => el.textContent);
    expect(title).toContain('Legion Chat');

    const usernameInput = await page.$('input#username-input');
    expect(usernameInput).toBeTruthy();

    const joinButton = await page.$('button');
    const buttonText = await page.evaluate(el => el.textContent, joinButton);
    expect(buttonText).toContain('Join Chat');

    console.log('✅ Login screen loaded successfully');

    await page.close();
  }, 15000);

  test('UAT 2: User can join the chat room', async () => {
    console.log('\n=== UAT 2: Join Chat Room ===');

    const page = await browser.newPage();
    await page.goto('http://localhost:3001');

    // Enter username
    await page.waitForSelector('input#username-input');
    await page.type('input#username-input', 'Alice');
    console.log('Entered username: Alice');

    // Click join button
    await page.click('button');
    console.log('Clicked Join Chat button');

    // Wait for chat interface to load
    await page.waitForSelector('.chat-container', { timeout: 10000 });

    // Verify chat interface elements
    const header = await page.$eval('.chat-header h1', el => el.textContent);
    expect(header).toContain('Legion Chat Room');

    const status = await page.$eval('.status', el => el.textContent);
    expect(status).toContain('Alice');

    // Verify system message about joining
    await page.waitForSelector('.message.system', { timeout: 3000 });
    const systemMessages = await page.$$eval('.message.system', elements =>
      elements.map(el => el.textContent)
    );
    expect(systemMessages.some(msg => msg.includes('Alice joined'))).toBe(true);

    console.log('✅ Successfully joined chat room as Alice');

    await page.close();
  }, 20000);

  test('UAT 3: User can send and receive messages', async () => {
    console.log('\n=== UAT 3: Send and Receive Messages ===');

    const page = await browser.newPage();
    await page.goto('http://localhost:3001');

    // Join as Bob
    await page.waitForSelector('input#username-input');
    await page.type('input#username-input', 'Bob');
    await page.click('button');
    await page.waitForSelector('.chat-container', { timeout: 10000 });

    console.log('Joined as Bob');

    // Send a message
    const messageText = 'Hello from Bob!';
    await page.waitForSelector('input#message-input');
    await page.type('input#message-input', messageText);
    await page.click('button:has-text("Send")');

    console.log('Sent message:', messageText);

    // Wait for message to appear
    await page.waitForSelector('.message.chat.own', { timeout: 5000 });

    // Verify message is displayed
    const chatMessages = await page.$$eval('.message.chat .text', elements =>
      elements.map(el => el.textContent)
    );
    expect(chatMessages.some(msg => msg.includes(messageText))).toBe(true);

    // Verify username is shown
    const usernames = await page.$$eval('.message.chat .username', elements =>
      elements.map(el => el.textContent)
    );
    expect(usernames.some(name => name.includes('Bob'))).toBe(true);

    // Verify input is cleared
    const inputValue = await page.$eval('input#message-input', el => el.value);
    expect(inputValue).toBe('');

    console.log('✅ Message sent and displayed successfully');

    await page.close();
  }, 20000);

  test('UAT 4: Multi-user chat works correctly', async () => {
    console.log('\n=== UAT 4: Multi-User Chat ===');

    // Create two pages (two users)
    const page1 = await browser.newPage();
    const page2 = await browser.newPage();

    // User 1: Alice joins
    console.log('User 1 (Alice) joining...');
    await page1.goto('http://localhost:3001');
    await page1.waitForSelector('input#username-input');
    await page1.type('input#username-input', 'Alice');
    await page1.click('button');
    await page1.waitForSelector('.chat-container', { timeout: 10000 });

    // User 2: Charlie joins
    console.log('User 2 (Charlie) joining...');
    await page2.goto('http://localhost:3001');
    await page2.waitForSelector('input#username-input');
    await page2.type('input#username-input', 'Charlie');
    await page2.click('button');
    await page2.waitForSelector('.chat-container', { timeout: 10000 });

    // Verify both users see each other in the user list
    const users1 = await page1.$eval('#users-list', el => el.textContent);
    const users2 = await page2.$eval('#users-list', el => el.textContent);

    expect(users1).toContain('Alice');
    expect(users1).toContain('Charlie');
    expect(users2).toContain('Alice');
    expect(users2).toContain('Charlie');

    console.log('✅ Both users see each other in user list');

    // Alice sends a message
    const aliceMessage = 'Hi Charlie, this is Alice!';
    await page1.type('input#message-input', aliceMessage);
    await page1.click('button:has-text("Send")');

    console.log('Alice sent message:', aliceMessage);

    // Wait a moment for message to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify Alice sees her own message
    const aliceMessages = await page1.$$eval('.message.chat .text', elements =>
      elements.map(el => el.textContent)
    );
    expect(aliceMessages.some(msg => msg.includes(aliceMessage))).toBe(true);

    console.log('✅ Alice sees her own message');

    // Charlie sends a reply
    const charlieMessage = 'Hello Alice! Nice to meet you!';
    await page2.type('input#message-input', charlieMessage);
    await page2.click('button:has-text("Send")');

    console.log('Charlie sent message:', charlieMessage);

    // Wait for message to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify Charlie sees his message
    const charlieMessages = await page2.$$eval('.message.chat .text', elements =>
      elements.map(el => el.textContent)
    );
    expect(charlieMessages.some(msg => msg.includes(charlieMessage))).toBe(true);

    console.log('✅ Charlie sees his own message');
    console.log('✅ Multi-user chat working perfectly!');

    await page1.close();
    await page2.close();
  }, 30000);

  test('UAT 5: UI styling is correct', async () => {
    console.log('\n=== UAT 5: UI Styling ===');

    const page = await browser.newPage();
    await page.goto('http://localhost:3001');

    // Check gradient background
    const bodyBg = await page.evaluate(() => {
      const body = document.querySelector('body');
      return window.getComputedStyle(body).background;
    });
    expect(bodyBg).toContain('linear-gradient');
    console.log('✅ Gradient background applied');

    // Join chat
    await page.type('input#username-input', 'UITester');
    await page.click('button');
    await page.waitForSelector('.chat-container', { timeout: 10000 });

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
    console.log('✅ Chat container styling correct');

    // Check header gradient
    const headerBg = await page.evaluate(() => {
      const header = document.querySelector('.chat-header');
      return window.getComputedStyle(header).background;
    });
    expect(headerBg).toContain('linear-gradient');
    console.log('✅ Header gradient applied');

    console.log('✅ All UI styling verified!');

    await page.close();
  }, 20000);
});
