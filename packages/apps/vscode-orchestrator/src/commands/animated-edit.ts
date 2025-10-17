import * as vscode from 'vscode';
import type { TypeArgs, ChunkedInsertArgs, LineByLineInsertArgs } from '../types.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function typeText(args: TypeArgs): Promise<any> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor');
  }

  const cps = args.cps ?? 40;
  const msPerChar = 1000 / cps;
  const text = args.text;

  vscode.window.setStatusBarMessage(`Typing at ${cps} cps...`, text.length * msPerChar);

  // DISABLE ALL EDITOR FEATURES DURING TYPING - just insert text!
  const config = vscode.workspace.getConfiguration('editor');

  // Save all original settings
  const originalSettings = {
    quickSuggestions: config.get('quickSuggestions'),
    parameterHints: config.get('parameterHints.enabled'),
    suggestOnTriggerCharacters: config.get('suggestOnTriggerCharacters'),
    acceptSuggestionOnCommitCharacter: config.get('acceptSuggestionOnCommitCharacter'),
    tabCompletion: config.get('tabCompletion'),
    wordBasedSuggestions: config.get('wordBasedSuggestions'),
    inlineSuggest: config.get('inlineSuggest.enabled'),
    autoClosingBrackets: config.get('autoClosingBrackets'),
    autoClosingQuotes: config.get('autoClosingQuotes'),
    autoClosingDelete: config.get('autoClosingDelete'),
    autoClosingOvertype: config.get('autoClosingOvertype'),
    formatOnType: config.get('formatOnType'),
    formatOnPaste: config.get('formatOnPaste'),
    snippetSuggestions: config.get('snippetSuggestions')
  };

  try {
    // Disable EVERYTHING that could insert/modify text
    await config.update('quickSuggestions', false, vscode.ConfigurationTarget.Global);
    await config.update('parameterHints.enabled', false, vscode.ConfigurationTarget.Global);
    await config.update('suggestOnTriggerCharacters', false, vscode.ConfigurationTarget.Global);
    await config.update('acceptSuggestionOnCommitCharacter', false, vscode.ConfigurationTarget.Global);
    await config.update('tabCompletion', 'off', vscode.ConfigurationTarget.Global);
    await config.update('wordBasedSuggestions', 'off', vscode.ConfigurationTarget.Global);
    await config.update('inlineSuggest.enabled', false, vscode.ConfigurationTarget.Global);
    await config.update('autoClosingBrackets', 'never', vscode.ConfigurationTarget.Global);
    await config.update('autoClosingQuotes', 'never', vscode.ConfigurationTarget.Global);
    await config.update('autoClosingDelete', 'never', vscode.ConfigurationTarget.Global);
    await config.update('autoClosingOvertype', 'never', vscode.ConfigurationTarget.Global);
    await config.update('formatOnType', false, vscode.ConfigurationTarget.Global);
    await config.update('formatOnPaste', false, vscode.ConfigurationTarget.Global);
    await config.update('snippetSuggestions', 'none', vscode.ConfigurationTarget.Global);

    // Track position ourselves instead of relying on cursor
    let currentPosition = editor.selection.active;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      await editor.edit((editBuilder) => {
        editBuilder.insert(currentPosition, char);
      }, {
        undoStopBefore: false,
        undoStopAfter: false
      });

      // Update our tracked position - handle newlines specially
      if (char === '\n') {
        // Move to next line, column 0
        currentPosition = new vscode.Position(currentPosition.line + 1, 0);
      } else {
        // Move one character to the right
        currentPosition = currentPosition.translate(0, 1);
      }

      // Update editor selection to match our tracked position
      editor.selection = new vscode.Selection(currentPosition, currentPosition);

      // Reveal cursor periodically (every 100 chars) to avoid slowdown
      if (i % 100 === 0) {
        editor.revealRange(
          new vscode.Range(currentPosition, currentPosition),
          vscode.TextEditorRevealType.InCenterIfOutsideViewport
        );
      }

      await sleep(msPerChar);
    }

    // NASTY HACK: Delete everything after the cursor position (garbage inserted by autocomplete/extensions)
    const endOfDocument = editor.document.lineAt(editor.document.lineCount - 1).range.end;
    if (currentPosition.isBefore(endOfDocument)) {
      await editor.edit((editBuilder) => {
        editBuilder.delete(new vscode.Range(currentPosition, endOfDocument));
      });
    }

    return { chars: text.length, cps };
  } finally {
    // Restore ALL original settings - re-enable language features
    await config.update('quickSuggestions', originalSettings.quickSuggestions, vscode.ConfigurationTarget.Global);
    await config.update('parameterHints.enabled', originalSettings.parameterHints, vscode.ConfigurationTarget.Global);
    await config.update('suggestOnTriggerCharacters', originalSettings.suggestOnTriggerCharacters, vscode.ConfigurationTarget.Global);
    await config.update('acceptSuggestionOnCommitCharacter', originalSettings.acceptSuggestionOnCommitCharacter, vscode.ConfigurationTarget.Global);
    await config.update('tabCompletion', originalSettings.tabCompletion, vscode.ConfigurationTarget.Global);
    await config.update('wordBasedSuggestions', originalSettings.wordBasedSuggestions, vscode.ConfigurationTarget.Global);
    await config.update('inlineSuggest.enabled', originalSettings.inlineSuggest, vscode.ConfigurationTarget.Global);
    await config.update('autoClosingBrackets', originalSettings.autoClosingBrackets, vscode.ConfigurationTarget.Global);
    await config.update('autoClosingQuotes', originalSettings.autoClosingQuotes, vscode.ConfigurationTarget.Global);
    await config.update('autoClosingDelete', originalSettings.autoClosingDelete, vscode.ConfigurationTarget.Global);
    await config.update('autoClosingOvertype', originalSettings.autoClosingOvertype, vscode.ConfigurationTarget.Global);
    await config.update('formatOnType', originalSettings.formatOnType, vscode.ConfigurationTarget.Global);
    await config.update('formatOnPaste', originalSettings.formatOnPaste, vscode.ConfigurationTarget.Global);
    await config.update('snippetSuggestions', originalSettings.snippetSuggestions, vscode.ConfigurationTarget.Global);
  }
}

export async function chunkedInsert(args: ChunkedInsertArgs): Promise<any> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor');
  }

  const chunkSize = args.chunkSize ?? 160;
  const intervalMs = args.intervalMs ?? 50;
  const text = args.text;

  let insertedChars = 0;
  const chunks = Math.ceil(text.length / chunkSize);

  vscode.window.setStatusBarMessage(
    `Inserting ${text.length} chars in ${chunks} chunks...`,
    chunks * intervalMs
  );

  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.substring(i, Math.min(i + chunkSize, text.length));
    const position = editor.selection.active;

    await editor.edit((editBuilder) => {
      editBuilder.insert(position, chunk);
    }, {
      undoStopBefore: false,
      undoStopAfter: false
    });

    // Move cursor forward - calculate position after inserting chunk
    // Count newlines in the chunk to determine final line and column
    const lines = chunk.split('\n');
    let newPosition;
    if (lines.length === 1) {
      // No newlines, just move right
      newPosition = position.translate(0, chunk.length);
    } else {
      // Has newlines, move to the line after last newline
      const lineOffset = lines.length - 1;
      const lastLineLength = lines[lines.length - 1].length;
      newPosition = new vscode.Position(position.line + lineOffset, lastLineLength);
    }
    editor.selection = new vscode.Selection(newPosition, newPosition);

    // Reveal cursor
    editor.revealRange(
      new vscode.Range(newPosition, newPosition),
      vscode.TextEditorRevealType.InCenterIfOutsideViewport
    );

    insertedChars += chunk.length;
    await sleep(intervalMs);
  }

  return { chars: insertedChars, chunks };
}

export async function lineByLineInsert(args: LineByLineInsertArgs): Promise<any> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor');
  }

  const linesPerSecond = args.linesPerSecond ?? 10;
  const msPerLine = 1000 / linesPerSecond;
  const text = args.text;
  const lines = text.split('\n');

  vscode.window.setStatusBarMessage(
    `Inserting ${lines.length} lines at ${linesPerSecond} lps...`,
    lines.length * msPerLine
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLastLine = i === lines.length - 1;
    const lineWithNewline = isLastLine ? line : line + '\n';
    const position = editor.selection.active;

    await editor.edit((editBuilder) => {
      editBuilder.insert(position, lineWithNewline);
    }, {
      undoStopBefore: false,
      undoStopAfter: false
    });

    // Calculate new cursor position after inserting the line
    let newPosition;
    if (isLastLine) {
      // Last line - move cursor to end of inserted text
      newPosition = position.translate(0, line.length);
    } else {
      // Not last line - move to next line, column 0
      newPosition = new vscode.Position(position.line + 1, 0);
    }
    editor.selection = new vscode.Selection(newPosition, newPosition);

    // Reveal cursor
    editor.revealRange(
      new vscode.Range(newPosition, newPosition),
      vscode.TextEditorRevealType.InCenterIfOutsideViewport
    );

    await sleep(msPerLine);
  }

  return { lines: lines.length, linesPerSecond };
}
