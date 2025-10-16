/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { DIFF_SCHEME } from './extension.js';
export class DiffContentProvider {
    content = new Map();
    onDidChangeEmitter = new vscode.EventEmitter();
    get onDidChange() {
        return this.onDidChangeEmitter.event;
    }
    provideTextDocumentContent(uri) {
        return this.content.get(uri.toString()) ?? '';
    }
    setContent(uri, content) {
        this.content.set(uri.toString(), content);
        this.onDidChangeEmitter.fire(uri);
    }
    deleteContent(uri) {
        this.content.delete(uri.toString());
    }
    getContent(uri) {
        return this.content.get(uri.toString());
    }
}
/**
 * Manages the state and lifecycle of diff views within the IDE.
 */
export class DiffManager {
    log;
    diffContentProvider;
    diffDocuments = new Map();
    subscriptions = [];
    constructor(log, diffContentProvider) {
        this.log = log;
        this.diffContentProvider = diffContentProvider;
        this.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
            void this.onActiveEditorChange(editor);
        }));
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
    async showDiff(filePath, newContent) {
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
        await vscode.commands.executeCommand('setContext', 'legion.diff.isVisible', true);
        let leftDocUri;
        try {
            await vscode.workspace.fs.stat(fileUri);
            leftDocUri = fileUri;
        }
        catch {
            // We need to provide an empty document to diff against.
            // Using the 'untitled' scheme is one way to do this.
            leftDocUri = vscode.Uri.from({
                scheme: 'untitled',
                path: filePath,
            });
        }
        await vscode.commands.executeCommand('vscode.diff', leftDocUri, rightDocUri, diffTitle, {
            preview: false,
            preserveFocus: true,
        });
        await vscode.commands.executeCommand('workbench.action.files.setActiveEditorWriteableInSession');
    }
    /**
     * Closes an open diff view for a specific file.
     */
    async closeDiff(filePath, _suppressNotification = false) {
        let uriToClose;
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
    async acceptDiff(rightDocUri) {
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
    async cancelDiff(rightDocUri) {
        const diffInfo = this.diffDocuments.get(rightDocUri.toString());
        if (!diffInfo) {
            await this.closeDiffEditor(rightDocUri);
            return;
        }
        await this.closeDiffEditor(rightDocUri);
        this.log(`Diff cancelled for ${diffInfo.originalFilePath}`);
    }
    async onActiveEditorChange(editor) {
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
        await vscode.commands.executeCommand('setContext', 'legion.diff.isVisible', isVisible);
    }
    addDiffDocument(uri, diffInfo) {
        this.diffDocuments.set(uri.toString(), diffInfo);
    }
    async closeDiffEditor(rightDocUri) {
        const diffInfo = this.diffDocuments.get(rightDocUri.toString());
        await vscode.commands.executeCommand('setContext', 'legion.diff.isVisible', false);
        if (diffInfo) {
            this.diffDocuments.delete(rightDocUri.toString());
            this.diffContentProvider.deleteContent(rightDocUri);
        }
        // Find and close the tab corresponding to the diff view
        for (const tabGroup of vscode.window.tabGroups.all) {
            for (const tab of tabGroup.tabs) {
                const input = tab.input;
                if (input && input.modified?.toString() === rightDocUri.toString()) {
                    await vscode.window.tabGroups.close(tab);
                    return;
                }
            }
        }
    }
}
//# sourceMappingURL=diff-manager.js.map