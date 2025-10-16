import * as vscode from 'vscode';
import type { SetCursorArgs, RevealArgs, HighlightArgs } from '../types.js';

export async function setCursor(args: SetCursorArgs): Promise<any> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor');
  }

  const position = new vscode.Position(args.line, args.ch);
  editor.selection = new vscode.Selection(position, position);

  return { line: args.line, ch: args.ch };
}

export async function reveal(args: RevealArgs): Promise<any> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor');
  }

  const position = new vscode.Position(args.line, args.ch);
  const range = new vscode.Range(position, position);

  const revealType = args.strategy === 'center'
    ? vscode.TextEditorRevealType.InCenter
    : args.strategy === 'top'
    ? vscode.TextEditorRevealType.AtTop
    : vscode.TextEditorRevealType.Default;

  editor.revealRange(range, revealType);

  return { line: args.line, ch: args.ch, strategy: args.strategy };
}

const highlightDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 255, 0, 0.3)',
  border: '1px solid rgba(255, 255, 0, 0.8)'
});

export async function highlight(args: HighlightArgs): Promise<any> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor');
  }

  const startPos = new vscode.Position(args.start.line, args.start.ch);
  const endPos = new vscode.Position(args.end.line, args.end.ch);
  const range = new vscode.Range(startPos, endPos);

  editor.setDecorations(highlightDecoration, [range]);

  // Auto-clear after timeout
  const ms = args.ms ?? 500;
  setTimeout(() => {
    editor.setDecorations(highlightDecoration, []);
  }, ms);

  return { start: args.start, end: args.end, ms };
}
