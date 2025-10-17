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

  return { chars: text.length, cps };
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
