/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { DIFF_SCHEME } from './extension.js';

export class DiffContentProvider implements vscode.TextDocumentContentProvider {
  private content = new Map<string, string>();
  private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this.onDidChangeEmitter.event;
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.content.get(uri.toString()) ?? '';
  }

  setContent(uri: vscode.Uri, content: string): void {
    this.content.set(uri.toString(), content);
    this.onDidChangeEmitter.fire(uri);
  }

  deleteContent(uri: vscode.Uri): void {
    this.content.delete(uri.toString());
  }

  getContent(uri: vscode.Uri): string | undefined {
    return this.content.get(uri.toString());
  }
}

// Information about a diff view that is currently open.
interface DiffInfo {
  originalFilePath: string;
  newContent: string;
  rightDocUri: vscode.Uri;
}

/**
 * Manages the state and lifecycle of diff views within the IDE.
 */
export class DiffManager {
  private diffDocuments = new Map<string, DiffInfo>();
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor(
    private readonly log: (message: string) => void,
    private readonly diffContentProvider: DiffContentProvider,
  ) {
    this.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        void this.onActiveEditorChange(editor);
      }),
    );
    void this.onActiveEditorChange(vscode.window.activeTextEditor);
  }

  dispose() {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  /**
   * Creates and shows a new diff view.
   */
  async showDiff(filePath: string, newContent: string) {
    const fileUri = vscode.Uri.file(filePath);

    const rightDocUri = vscode.Uri.from({
      scheme: DIFF_SCHEME,
      path: filePath,
      // cache busting
      query: `rand=${Math.random()}`,
    });
    this.diffContentProvider.setContent(rightDocUri, newContent);

    this.addDiffDocument(rightDocUri, {
      originalFilePath: filePath,
      newContent,
      rightDocUri,
    });

    const diffTitle = `${path.basename(filePath)} ↔ Modified`;
    await vscode.commands.executeCommand(
      'setContext',
      'legion.diff.isVisible',
      true,
    );

    let leftDocUri;
    try {
      await vscode.workspace.fs.stat(fileUri);
      leftDocUri = fileUri;
    } catch {
      // We need to provide an empty document to diff against.
      // Using the 'untitled' scheme is one way to do this.
      leftDocUri = vscode.Uri.from({
        scheme: 'untitled',
        path: filePath,
      });
    }

    await vscode.commands.executeCommand(
      'vscode.diff',
      leftDocUri,
      rightDocUri,
      diffTitle,
      {
        preview: false,
        preserveFocus: true,
      },
    );
    await vscode.commands.executeCommand(
      'workbench.action.files.setActiveEditorWriteableInSession',
    );
  }

  /**
   * Closes an open diff view for a specific file.
   */
  async closeDiff(filePath: string, _suppressNotification = false) {
    let uriToClose: vscode.Uri | undefined;
    for (const [uriString, diffInfo] of this.diffDocuments.entries()) {
      if (diffInfo.originalFilePath === filePath) {
        uriToClose = vscode.Uri.parse(uriString);
        break;
      }
    }

    if (uriToClose) {
      const rightDoc = await vscode.workspace.openTextDocument(uriToClose);
      await this.closeDiffEditor(uriToClose);
      this.log(`Diff closed for ${filePath}`);
      return rightDoc.getText();
    }
    return;
  }

  /**
   * User accepts the changes in a diff view. Does not apply changes.
   */
  async acceptDiff(rightDocUri: vscode.Uri) {
    const diffInfo = this.diffDocuments.get(rightDocUri.toString());
    if (!diffInfo) {
      return;
    }

    await this.closeDiffEditor(rightDocUri);
    this.log(`Diff accepted for ${diffInfo.originalFilePath}`);
  }

  /**
   * Called when a user cancels a diff view.
   */
  async cancelDiff(rightDocUri: vscode.Uri) {
    const diffInfo = this.diffDocuments.get(rightDocUri.toString());
    if (!diffInfo) {
      await this.closeDiffEditor(rightDocUri);
      return;
    }

    await this.closeDiffEditor(rightDocUri);
    this.log(`Diff cancelled for ${diffInfo.originalFilePath}`);
  }

  private async onActiveEditorChange(editor: vscode.TextEditor | undefined) {
    let isVisible = false;
    if (editor) {
      isVisible = this.diffDocuments.has(editor.document.uri.toString());
      if (!isVisible) {
        for (const document of this.diffDocuments.values()) {
          if (document.originalFilePath === editor.document.uri.fsPath) {
            isVisible = true;
            break;
          }
        }
      }
    }
    await vscode.commands.executeCommand(
      'setContext',
      'legion.diff.isVisible',
      isVisible,
    );
  }

  private addDiffDocument(uri: vscode.Uri, diffInfo: DiffInfo) {
    this.diffDocuments.set(uri.toString(), diffInfo);
  }

  private async closeDiffEditor(rightDocUri: vscode.Uri) {
    const diffInfo = this.diffDocuments.get(rightDocUri.toString());
    await vscode.commands.executeCommand(
      'setContext',
      'legion.diff.isVisible',
      false,
    );

    if (diffInfo) {
      this.diffDocuments.delete(rightDocUri.toString());
      this.diffContentProvider.deleteContent(rightDocUri);
    }

    // Find and close the tab corresponding to the diff view
    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        const input = tab.input as {
          modified?: vscode.Uri;
          original?: vscode.Uri;
        };
        if (input && input.modified?.toString() === rightDocUri.toString()) {
          await vscode.window.tabGroups.close(tab);
          return;
        }
      }
    }
  }
}
