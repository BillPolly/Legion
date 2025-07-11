/**
 * Mock factories for external dependencies
 */

import { jest } from '@jest/globals';

/**
 * Creates mocks for Node.js built-in modules
 */
export function createNodeMocks() {
  return {
    // File system mocks
    fs: {
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        access: jest.fn(),
        mkdir: jest.fn(),
        stat: jest.fn(),
        readdir: jest.fn()
      }
    },
    
    // Child process mocks
    child_process: {
      exec: jest.fn(),
      spawn: jest.fn()
    },
    
    // HTTP/HTTPS mocks
    https: {
      request: jest.fn(),
      get: jest.fn()
    },
    
    http: {
      request: jest.fn(),
      get: jest.fn()
    }
  };
}

/**
 * Creates mocks for Puppeteer
 */
export function createPuppeteerMocks() {
  const mockPage = {
    goto: jest.fn().mockResolvedValue(true),
    screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-image-data')),
    content: jest.fn().mockResolvedValue('<html><body>Test content</body></html>'),
    evaluate: jest.fn().mockResolvedValue('evaluated-result'),
    close: jest.fn().mockResolvedValue(true),
    setViewport: jest.fn().mockResolvedValue(true),
    waitForSelector: jest.fn().mockResolvedValue(true),
    click: jest.fn().mockResolvedValue(true),
    type: jest.fn().mockResolvedValue(true)
  };
  
  const mockBrowser = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(true),
    pages: jest.fn().mockResolvedValue([mockPage])
  };
  
  return {
    launch: jest.fn().mockResolvedValue(mockBrowser),
    mockBrowser,
    mockPage
  };
}

/**
 * Creates mocks for Axios
 */
export function createAxiosMocks() {
  const mockResponse = {
    data: {},
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {}
  };
  
  return {
    get: jest.fn().mockResolvedValue(mockResponse),
    post: jest.fn().mockResolvedValue(mockResponse),
    put: jest.fn().mockResolvedValue(mockResponse),
    delete: jest.fn().mockResolvedValue(mockResponse),
    request: jest.fn().mockResolvedValue(mockResponse),
    mockResponse
  };
}

/**
 * Creates mocks for Cheerio
 */
export function createCheerioMocks() {
  const mockElement = {
    text: jest.fn().mockReturnValue('mock text'),
    html: jest.fn().mockReturnValue('<p>mock html</p>'),
    attr: jest.fn().mockReturnValue('mock attribute'),
    find: jest.fn().mockReturnThis(),
    each: jest.fn().mockReturnThis(),
    length: 1
  };
  
  return {
    load: jest.fn().mockReturnValue(jest.fn().mockReturnValue(mockElement)),
    mockElement
  };
}

/**
 * Creates mocks for YouTube Transcript
 */
export function createYouTubeTranscriptMocks() {
  return {
    YoutubeTranscript: {
      fetchTranscript: jest.fn().mockResolvedValue([
        { text: 'Hello world', duration: 2000, offset: 0 },
        { text: 'This is a test', duration: 3000, offset: 2000 }
      ])
    }
  };
}

/**
 * Creates mock fetch function
 */
export function createFetchMock() {
  const mockResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map(),
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue(''),
    blob: jest.fn().mockResolvedValue(new Blob())
  };
  
  return {
    fetch: jest.fn().mockResolvedValue(mockResponse),
    mockResponse
  };
}

/**
 * Creates comprehensive mock environment
 */
export function createMockEnvironment() {
  return {
    ...createNodeMocks(),
    puppeteer: createPuppeteerMocks(),
    axios: createAxiosMocks(),
    cheerio: createCheerioMocks(),
    youtubeTranscript: createYouTubeTranscriptMocks(),
    fetch: createFetchMock()
  };
}