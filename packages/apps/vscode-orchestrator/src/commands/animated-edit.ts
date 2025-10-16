import * as vscode from 'vscode';
import type { TypeArgs, ChunkedInsertArgs } from '../types.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function typeText(args: TypeArgs): Promise<any> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor');
  }

  const cps = Math.max(5, Math.min(120, args.cps ?? 40));
  const msPerChar = 1000 / cps;
  const text = args.text;

  vscode.window.setStatusBarMessage(`Typing at ${cps} cps...`, text.length * msPerChar);

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const position = editor.selection.active;

    await editor.edit((editBuilder) => {
      editBuilder.insert(position, char);
    }, {
      undoStopBefore: false,
      undoStopAfter: false
    });

    // Move cursor forward - handle newlines specially
    let newPosition;
    if (char === '\n') {
      // Move to next line, column 0
      newPosition = new vscode.Position(position.line + 1, 0);
    } else {
      // Move one character to the right
      newPosition = position.translate(0, 1);
    }
    editor.selection = new vscode.Selection(newPosition, newPosition);

    // Reveal cursor
    editor.revealRange(
      new vscode.Range(newPosition, newPosition),
      vscode.TextEditorRevealType.InCenterIfOutsideViewport
    );

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
