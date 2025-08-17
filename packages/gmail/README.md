# @legion/gmail

Gmail integration module for the Legion framework, providing secure access to Gmail API functionality.

## Features

- OAuth2 authentication with Google
- Send and receive emails
- List and search messages
- Get user profile information
- Resource manager integration for configuration
- Full TypeScript-style validation with Zod

## Installation

```bash
npm install @legion/gmail
```

## Configuration

The module uses the resource manager singleton for configuration. Set these environment variables:

```bash
GMAIL_CLIENT_ID=your_google_client_id
GMAIL_CLIENT_SECRET=your_google_client_secret
GMAIL_REDIRECT_URI=your_redirect_uri  # Optional, defaults to urn:ietf:wg:oauth:2.0:oob
GMAIL_TOKEN={"access_token":"...","refresh_token":"..."}  # Optional, JSON string
```

## Usage

### Basic Setup

```javascript
import { GmailModule } from '@legion/gmail';

const gmail = new GmailModule();
await gmail.initialize();
```

### Authentication

```javascript
// Get authorization URL
const authUrl = gmail.getAuthUrl(['https://www.googleapis.com/auth/gmail.modify']);
console.log('Visit this URL:', authUrl);

// After user authorizes, set the auth code
const tokens = await gmail.setAuthCode('authorization_code_from_google');
```

### Reading Emails

```javascript
// List recent messages
const messages = await gmail.listMessages('is:unread', 20);

// Get a specific message
const message = await gmail.getMessage(messages[0].id);
```

### Sending Emails

```javascript
// Send a simple email
await gmail.sendMessage(
  'recipient@example.com',
  'Subject Line',
  'Email body content'
);

// Send with options
await gmail.sendMessage(
  'recipient@example.com',
  'Subject Line', 
  'Email body content',
  {
    cc: 'cc@example.com',
    bcc: 'bcc@example.com',
    contentType: 'text/html'
  }
);
```

### Get Profile

```javascript
const profile = await gmail.getProfile();
console.log('Email:', profile.emailAddress);
```

## Testing

```bash
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
```

## License

MIT