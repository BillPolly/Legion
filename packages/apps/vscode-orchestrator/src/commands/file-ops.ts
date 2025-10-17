import * as vscode from 'vscode';
import * as path from 'path';
import type { OpenArgs, ReplaceAllArgs } from '../types.js';

export async function openFile(args: OpenArgs): Promise<any> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder open');
  }

  const filePath = path.join(workspaceFolder.uri.fsPath, args.file);
  const fileUri = vscode.Uri.file(filePath);

  // Create file if needed
  if (args.create) {
    try {
      await vscode.workspace.fs.stat(fileUri);
    } catch {
      // File doesn't exist, create it
      const dirUri = vscode.Uri.file(path.dirname(filePath));
      try {
        await vscode.workspace.fs.createDirectory(dirUri);
      } catch {
        // Directory might already exist
      }
      await vscode.workspace.fs.writeFile(fileUri, new Uint8Array());
    }
  }

  const viewColumn = args.column ?? 1;
  const doc = await vscode.workspace.openTextDocument(fileUri);

  const editor = await vscode.window.showTextDocument(doc, {
    viewColumn: viewColumn as vscode.ViewColumn,
    preview: false,
    preserveFocus: false
  });

  if (args.language) {
    await vscode.languages.setTextDocumentLanguage(doc, args.language);
  }

  return { file: args.file, uri: fileUri.toString() };
}

export async function saveFile(): Promise<any> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor');
  }

  const saved = await editor.document.save();
  if (!saved) {
    throw new Error('Failed to save document');
  }

  return { saved: true, file: editor.document.fileName };
}

export async function replaceAll(args: ReplaceAllArgs): Promise<any> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor');
  }

  const doc = editor.document;
  const fullRange = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(doc.getText().length)
  );

  await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, args.text);
  });

  // Reveal the start of the document
  const startPos = new vscode.Position(0, 0);
  editor.selection = new vscode.Selection(startPos, startPos);
  editor.revealRange(new vscode.Range(startPos, startPos));

  return { length: args.text.length };
}

export async function closeFile(args: { file: string }): Promise<any> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder open');
  }

  const filePath = path.join(workspaceFolder.uri.fsPath, args.file);
  const fileUri = vscode.Uri.file(filePath);

  // Find the tab with this file
  const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
  const tab = tabs.find(tab => {
    if (tab.input instanceof vscode.TabInputText) {
      return tab.input.uri.toString() === fileUri.toString();
    }
    return false;
  });

  if (!tab) {
    return { closed: false, message: 'File not open', file: args.file };
  }

  await vscode.window.tabGroups.close(tab);
  return { closed: true, file: args.file };
}
