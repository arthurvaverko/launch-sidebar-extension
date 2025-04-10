# Launch Sidebar

Launch Sidebar is a VS Code extension that adds a custom sidebar view to easily manage and run your debug configurations with a single click.

## Features

- Dedicated sidebar in the activity bar with a rocket icon
- Tree view showing all debug configurations from your workspace
- Each configuration displays its name and type
- One-click launch buttons for each configuration
- Refresh button to reload configurations
- Works across all workspace folders
- Automatic refresh when launch.json files change

The extension reads your `.vscode/launch.json` files from all workspace folders and displays the configurations in a tree view.

## Requirements

- Visual Studio Code 1.74.0 or higher
- At least one workspace folder with debug configurations in `.vscode/launch.json`

## How to Use

1. After installation, you'll see a rocket icon in the activity bar.
2. Click on it to open the Launch Sidebar.
3. The sidebar will show all available debug configurations from your workspace folders.
4. Click on the play button next to any configuration to start debugging.
5. Use the refresh button at the top of the sidebar to reload configurations if you make changes to your launch.json files manually.

## Known Issues

- If a launch.json file contains syntax errors, those configurations may not be displayed.
- Complex variable substitutions in launch configurations might not be fully resolved in the display.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
