/**
 * Mock VSCode API for testing
 */

export class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }

  translate(lineDelta, charDelta) {
    return new Position(this.line + lineDelta, this.character + charDelta);
  }
}

export class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}

export class Selection {
  constructor(anchor, active) {
    this.anchor = anchor;
    this.active = active;
  }
}

export class Uri {
  constructor(fsPath) {
    this.fsPath = fsPath;
    this.scheme = 'file';
  }

  static file(path) {
    return new Uri(path);
  }

  toString() {
    return `file://${this.fsPath}`;
  }
}

class MockTextDocument {
  constructor(uri, text = '', languageId = 'plaintext') {
    this.uri = uri;
    this._text = text;
    this.languageId = languageId;
    this.fileName = uri.fsPath;
    this.isDirty = false;
    this.isClosed = false;
  }

  getText() {
    return this._text;
  }

  positionAt(offset) {
    const lines = this._text.substring(0, offset).split('\n');
    return new Position(lines.length - 1, lines[lines.length - 1].length);
  }

  async save() {
    this.isDirty = false;
    return true;
  }
}

class MockTextEditor {
  constructor(document) {
    this.document = document;
    this.selection = new Selection(new Position(0, 0), new Position(0, 0));
    this.selections = [this.selection];
    this.visibleRanges = [];
    this._decorations = new Map();
  }

  async edit(callback, options = {}) {
    const editBuilder = {
      insert: (position, text) => {
        const offset = this._getOffset(position);
        this.document._text =
          this.document._text.substring(0, offset) +
          text +
          this.document._text.substring(offset);
        this.document.isDirty = true;
      },
      replace: (range, text) => {
        const startOffset = this._getOffset(range.start);
        const endOffset = this._getOffset(range.end);
        this.document._text =
          this.document._text.substring(0, startOffset) +
          text +
          this.document._text.substring(endOffset);
        this.document.isDirty = true;
      },
      delete: (range) => {
        const startOffset = this._getOffset(range.start);
        const endOffset = this._getOffset(range.end);
        this.document._text =
          this.document._text.substring(0, startOffset) +
          this.document._text.substring(endOffset);
        this.document.isDirty = true;
      }
    };

    callback(editBuilder);
    return true;
  }

  _getOffset(position) {
    const lines = this.document._text.split('\n');
    let offset = 0;
    for (let i = 0; i < position.line && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }
    offset += position.character;
    return offset;
  }

  revealRange(range, revealType) {
    // Mock implementation
  }

  setDecorations(decorationType, ranges) {
    this._decorations.set(decorationType, ranges);
  }
}

export const TextEditorRevealType = {
  Default: 0,
  InCenter: 1,
  InCenterIfOutsideViewport: 2,
  AtTop: 3
};

export const ViewColumn = {
  Active: -1,
  Beside: -2,
  One: 1,
  Two: 2,
  Three: 3
};

// Mock workspace
let mockWorkspaceFolders = [];
let mockDocuments = new Map();
let mockFs = new Map();

export const workspace = {
  get workspaceFolders() {
    return mockWorkspaceFolders;
  },

  async openTextDocument(uri) {
    const key = uri.toString();
    if (mockDocuments.has(key)) {
      return mockDocuments.get(key);
    }

    const doc = new MockTextDocument(uri);
    mockDocuments.set(key, doc);
    return doc;
  },

  fs: {
    async stat(uri) {
      const key = uri.toString();
      if (!mockFs.has(key)) {
        throw new Error('File not found');
      }
      return { type: 1 }; // FileType.File
    },

    async createDirectory(uri) {
      const key = uri.toString();
      mockFs.set(key, { type: 'directory' });
    },

    async writeFile(uri, content) {
      const key = uri.toString();
      mockFs.set(key, { type: 'file', content });
    },

    async readFile(uri) {
      const key = uri.toString();
      if (!mockFs.has(key)) {
        throw new Error('File not found');
      }
      return mockFs.get(key).content || new Uint8Array();
    }
  },

  getConfiguration: (section) => ({
    get: (key, defaultValue) => defaultValue
  })
};

// Mock window
let mockActiveTextEditor = null;
let mockStatusBarMessages = [];

export const window = {
  get activeTextEditor() {
    return mockActiveTextEditor;
  },

  async showTextDocument(doc, options = {}) {
    const editor = new MockTextEditor(doc);
    mockActiveTextEditor = editor;
    return editor;
  },

  createOutputChannel: (name) => ({
    appendLine: (message) => {},
    dispose: () => {}
  }),

  showInformationMessage: async (message, ...items) => {
    return items[0];
  },

  showErrorMessage: async (message, ...items) => {
    return items[0];
  },

  setStatusBarMessage: (message, timeout) => {
    mockStatusBarMessages.push({ message, timeout });
    if (typeof timeout === 'number') {
      return { dispose: () => {} };
    }
  },

  createTextEditorDecorationType: (options) => {
    return { key: Math.random().toString() };
  },

  createWebviewPanel: (viewType, title, showOptions, options) => {
    return {
      webview: {
        html: '',
        options: options || {},
        asWebviewUri: (uri) => uri,
        postMessage: async (message) => true
      },
      title: title,
      viewType: viewType,
      visible: true,
      active: true,
      viewColumn: typeof showOptions === 'number' ? showOptions : showOptions.viewColumn,
      onDidDispose: (listener) => ({ dispose: () => {} }),
      onDidChangeViewState: (listener) => ({ dispose: () => {} }),
      dispose: () => {},
      reveal: () => {}
    };
  }
};

// Mock languages
export const languages = {
  async setTextDocumentLanguage(doc, languageId) {
    doc.languageId = languageId;
    return doc;
  }
};

// Mock commands
let mockCommands = new Map();

export const commands = {
  registerCommand: (command, callback) => {
    mockCommands.set(command, callback);
    return { dispose: () => mockCommands.delete(command) };
  },

  executeCommand: async (command, ...args) => {
    if (mockCommands.has(command)) {
      return mockCommands.get(command)(...args);
    }
    // Mock built-in commands
    if (command === 'simpleBrowser.show') {
      return true;
    }
    throw new Error(`Command not found: ${command}`);
  }
};

// Test utilities
export function resetMocks() {
  mockWorkspaceFolders = [];
  mockDocuments.clear();
  mockFs.clear();
  mockActiveTextEditor = null;
  mockStatusBarMessages = [];
  mockCommands.clear();
}

export function setWorkspaceFolder(path) {
  mockWorkspaceFolders = [{
    uri: Uri.file(path),
    name: 'test-workspace',
    index: 0
  }];
}

export function setActiveEditor(document) {
  const editor = new MockTextEditor(document);
  mockActiveTextEditor = editor;
  return editor;
}

export function getStatusBarMessages() {
  return mockStatusBarMessages;
}

export function createMockDocument(uri, text = '', languageId = 'plaintext') {
  const doc = new MockTextDocument(uri, text, languageId);
  mockDocuments.set(uri.toString(), doc);
  return doc;
}

export default {
  Position,
  Range,
  Selection,
  Uri,
  TextEditorRevealType,
  ViewColumn,
  workspace,
  window,
  languages,
  commands,
  // Test helpers
  resetMocks,
  setWorkspaceFolder,
  setActiveEditor,
  getStatusBarMessages,
  createMockDocument
};
