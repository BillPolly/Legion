# Legion IDE Companion

The Legion IDE Companion extension pairs with the [Legion AI Framework](https://github.com/maxximus-dev/Legion). This extension is compatible with both VS Code and VS Code forks.

## Features

- **Native Diffing**: Seamlessly view, modify, and accept code changes suggested by Legion directly within the editor.

- **Launch Legion CLI**: Quickly start a new Legion CLI session from the Command Palette (Cmd+Shift+P or Ctrl+Shift+P) by running the "Legion: Run CLI" command.

- **Automatic Updates**: The extension checks for updates from the VS Code Marketplace and notifies you when new versions are available.

## Requirements

To use this extension, you'll need:

- VS Code version 1.99.0 or newer
- Legion CLI (installed separately) running within the integrated terminal

## Installation

1. Install the extension from the VS Code Marketplace (coming soon) or build from source
2. The extension will automatically activate when VS Code starts
3. Launch Legion CLI from your integrated terminal or use the "Legion: Run CLI" command

## Configuration

You can enable detailed logging for debugging:

1. Open VS Code Settings (Cmd/Ctrl+,)
2. Search for "legion.debug.logging.enabled"
3. Enable the checkbox to see detailed logs in the Output panel

## Usage

### Viewing Diffs

When Legion suggests code changes, the extension will open a diff view showing the original file on the left and the proposed changes on the right. You can:

- Review the changes in the diff view
- Edit the proposed changes directly in the right pane
- Accept the changes by clicking the checkmark icon or pressing Cmd/Ctrl+S
- Cancel the changes by clicking the X icon

### Launching Legion CLI

1. Open the Command Palette (Cmd+Shift+P or Ctrl+Shift+P)
2. Type "Legion: Run CLI" and press Enter
3. If you have multiple workspace folders, select the folder where you want to run Legion
4. The Legion CLI will start in the integrated terminal

## License

MIT License - See LICENSE file for details
