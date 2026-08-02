# Launch Sidebar

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=arthurvaverko.launch-sidebar)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Install-brightgreen)](https://marketplace.visualstudio.com/items?itemName=arthurvaverko.launch-sidebar)

Launch Sidebar is a VS Code extension that provides a convenient way to manage and run debug configurations, npm scripts, and JetBrains run configurations from a dedicated sidebar. It offers one-click execution of tasks with intelligent package manager detection (npm, yarn, pnpm) and support for JetBrains IDE run configuration files.

![Launch Sidebar Screenshot](resources/screenshot.png)

## Key Features

### Debug Configurations
- 🚀 View and launch debug configurations from all workspace folders
- 🔄 Live updates when launch.json files change
- ⚙️ One-click edit button for easy configuration modification
- 🔍 Clearly organized by workspace folder with prominent section headers

### NPM Scripts
- 📦 Intelligent package manager detection (npm, yarn, pnpm)
- 🎨 Color-coded icons for different script types
- ▶️ One-click script execution with the correct package manager
- 🛠️ Support for monorepos with nested package.json files

### JetBrains Run Configurations
- 🧠 Support for JetBrains IDE run configurations (.run/*.xml files)
- 🔍 Automatic detection of configurations from GoLand, IntelliJ, WebStorm, etc.
- ▶️ Run Go applications, tests, Node.js apps, and more directly from VS Code
- 🛠️ Edit the XML configuration files with a single click

### Makefile Tasks
- 🛠️ Detects Makefile in each workspace folder
- 📋 Lists all Makefile targets as runnable tasks in the sidebar
- ▶️ One-click run with `make <target>` in the correct directory
- 🎨 Contextual icons for each Makefile task (build, test, clean, etc.)
- 📝 Edit Makefile at the target definition with a single click

### Configuration Management
- 👁️ Hide rarely used configurations with right-click context menu
- 📁 Hide entire sections to reduce clutter in complex projects
- 🔍 Manage hidden items through the dedicated button in the title bar
- 🔢 Counter badge showing how many items are hidden
- 🔄 Easily restore hidden items individually or all at once
- 💾 Persistent storage of hidden items between VS Code sessions

### User Experience
- 🌟 Clean, organized sidebar with hierarchical sections
- 🖼️ Section headers use custom icons: NPM, JetBrains, Makefile (GNU), and VS Code for debug configs
- 🔠 Alphabetical sorting for easy navigation
- 🔄 Refresh button to manually update configurations and scripts
- 🖱️ Separation of selection and execution actions

## Getting Started

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=arthurvaverko.launch-sidebar)
2. Click on the rocket icon in the activity bar to open the Launch Sidebar
3. Browse your debug configurations and npm scripts organized by workspace folder
4. Click the play button (▶️) next to any item to run it
5. Click the gear icon (⚙️) to edit the configuration or script

## Smart Package Manager Detection

The extension automatically determines the appropriate package manager for your npm scripts:

1. Checks package.json for explicit package manager definitions
2. Looks for lock files (package-lock.json, yarn.lock, pnpm-lock.yaml)
3. Uses the same package manager for all scripts within a workspace for consistency
4. Falls back to npm when no specific manager is detected

## Hiding and Managing Configurations

To keep your sidebar clean and organized:

1. **Hide an item**: Right-click on any configuration and select "Hide Item"
2. **Hide an entire section**: Right-click on a section header and select "Hide Section"
3. **Manage hidden items**: Click the eye icon in the title bar (shows count of hidden items)
4. **Restore items**: Select an item from the quickpick menu or choose "Restore All"

Hidden items and sections are stored persistently and will remain hidden even after restarting VS Code.
Tooltips indicate when sections have hidden items, making it easy to remember what's hidden.

## Customization

The extension provides visual distinctions for different script and Makefile task types:

- 🧪 **Test scripts** (test, e2e, spec): Purple beaker icon
- 📦 **Build scripts** (build, compile): Orange package icon
- ▶️ **Dev scripts** (dev, start): Green play icon
- ✨ **Generate scripts** (gen, generate): Blue sparkle icon
- ✓ **Lint scripts** (lint, eslint): Yellow checklist icon
- 🗑️ **Clean scripts** (clean, clear): Red trash icon
- 📤 **Export scripts** (export, publish): Cyan export icon
- 👁️ **Preview scripts** (preview, view): Light blue preview icon
- 🐞 **Debug scripts** (debug): Orange-red debug icon
- 🚀 **Deploy scripts** (deploy, upload): Pink rocket icon

## Requirements

- Visual Studio Code 1.74.0 or higher
- For debug configurations: At least one workspace folder with `.vscode/launch.json`
- For npm scripts: At least one `package.json` file with scripts defined
- For JetBrains configurations: A `.run` folder with XML configuration files

## Known Issues

- If a launch.json file contains syntax errors, those configurations may not be displayed properly, but the extension will show an error message.
- Complex variable substitutions in launch configurations might not be fully resolved in the display.
- Some package manager-specific features (like yarn workspaces) might not be fully integrated.

## Privacy

This extension does not collect any data or send any telemetry information.

## Contributing

Contributions are welcome! Feel free to submit a Pull Request on [GitHub](https://github.com/arthurvaverko/launch-sidebar-extension).

## License

This extension is licensed under the [MIT License](LICENSE).

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
# launch-sidebar-extension
