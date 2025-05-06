# Launch Sidebar Extension Guide for Agents

This document provides a guide to the structure, functionality and architecture of the Launch Sidebar VS Code extension. It serves as a reference for agents working with this codebase.

## Project Overview

Launch Sidebar is a VS Code extension that creates a dedicated sidebar view allowing users to easily browse, launch, and edit:
- Debug configurations from launch.json files
- NPM/Yarn/PNPM scripts from package.json files
- JetBrains IDE run configurations from XML files

The extension provides a unified, hierarchical view organized by workspace folder, with one-click execution capabilities.

Current version: 0.0.12

## Key Features

- **Debug Configurations**: View and launch debug configurations with a single click
- **NPM Scripts**: Run scripts with automatic package manager detection (npm, yarn, pnpm)
- **JetBrains Configurations**: Support for JetBrains IDE run configurations
- **Visual Indicators**: Color-coded icons for different script types
- **Workspace Support**: Full multi-root workspace support with file watching for automatic updates
- **Configuration Management**: Ability to hide rarely used configurations and entire sections

## Architecture Overview

The extension is structured with a clear separation of concerns:

1. **Extension Entry Point** (`extension.ts`) - Activates the extension, sets up views and commands
2. **Model Classes** - Define different types of items in the tree view
3. **Provider Classes** - Supply data to the VS Code tree view
4. **Utility Classes** - Provide helper functions for specific capabilities
5. **Command Handlers** - Implement functionality when users interact with items

## Core Components

### Entry Point (extension.ts)

The main entry point that:
- Activates the extension
- Sets up the sidebar view
- Registers commands
- Sets up file watchers
- Creates an output channel for logging

### Models

Located in the `src/models` directory:

- **config-position.ts**: Tracks the exact position of configurations in files
- **hidden-items-manager.ts**: Manages the list of hidden items and sections
- **launch-items.ts**: Models for debug configuration items and error items
- **tree-items.ts**: Models for section headers and script items
- **jetbrains-items.ts**: Models for JetBrains run configuration items

### Providers

Located in the `src/providers` directory:

- **launch-configuration-provider.ts**: Implements the VS Code TreeDataProvider interface to supply items to the tree view. Handles:
  - Scanning for configurations and scripts
  - Organizing items into hierarchical sections
  - Parsing launch.json, package.json, and XML configuration files
  - Filtering hidden items and sections from the view
  - Adding visual indicators for hidden items

### Utilities

Located in the `src/utils` directory:

- **package-manager.ts**: Detects the appropriate package manager (npm, yarn, pnpm) based on project files
- **script-icons.ts**: Assigns appropriate icons to scripts based on their names and purposes
- **jetbrains-parser.ts**: Parses JetBrains run configuration XML files

## Command Structure

The extension registers several commands:

- `launchConfigurations.refresh`: Refresh the sidebar view
- `launchConfigurations.launch`: Launch a debug configuration
- `launchConfigurations.edit`: Edit a debug configuration
- `launchConfigurations.runScript`: Run an npm script
- `launchConfigurations.editScript`: Edit an npm script
- `launchConfigurations.runJetBrainsConfig`: Run a JetBrains configuration
- `launchConfigurations.editJetBrainsConfig`: Edit a JetBrains configuration
- `launchConfigurations.hideItem`: Hide an individual item
- `launchConfigurations.hideSection`: Hide an entire section
- `launchConfigurations.manageHiddenItems`: Open a dialog to manage hidden items and sections

## Data Flow

1. When the extension activates, it:
   - Creates the `LaunchConfigurationProvider`
   - Registers the TreeView with this provider
   - Sets up file watchers to detect changes to relevant files
   - Creates the `HiddenItemsManager` to manage hidden items and sections

2. When the sidebar is shown:
   - The provider's `getChildren()` method is called to populate the root level
   - This returns a list of sections organized by workspace and configuration type, filtering out hidden sections
   - When a section is expanded, `getChildren()` is called again with that section
   - The provider then returns the appropriate items for that section, filtering out hidden items

3. When a user interacts with an item:
   - VS Code executes the registered command for that action
   - The command handler performs the appropriate action (launch, edit, hide, etc.)

## Extension Capabilities

### Debug Configuration Support

The extension parses launch.json files to:
- Display all available debug configurations
- Keep track of exact positions in the file for easy editing
- Support compound launch configurations
- Handle errors in launch.json gracefully

### NPM Script Support

The extension:
- Detects scripts from package.json files
- Supports nested package.json files (monorepos)
- Automatically determines the correct package manager to use
- Provides color-coded icons based on script types

### JetBrains Run Configuration Support

The extension:
- Parses XML configuration files from .run and .idea/runConfigurations directories
- Supports various configuration types (Go applications, tests, Node.js apps, etc.)
- Maps XML configurations to appropriate CLI commands

### Configuration Management Support

The extension allows users to:
- Hide individual items via right-click context menu
- Hide entire sections via right-click context menu
- View and restore hidden items through a dedicated dialog
- See visual indicators when items are hidden
- Persist hidden item selections between VS Code sessions

## Hidden Items Implementation

The hidden items functionality is implemented with the following components:

1. **HiddenItemsManager** (`src/models/hidden-items-manager.ts`):
   - Maintains lists of hidden items and sections
   - Persists hidden items using VS Code's extension context storage
   - Provides methods to hide, restore, and check items and sections
   - Fires events when the hidden items list changes

2. **Launch Configuration Provider** (`src/providers/launch-configuration-provider.ts`):
   - Filters out hidden items and sections from the tree view
   - Adds visual indicators to sections with hidden items
   - Updates the title bar icon to show the number of hidden items
   - Uses a consistent ID generation scheme to uniquely identify sections

3. **Extension Entry Point** (`src/extension.ts`):
   - Registers commands for hiding items and sections
   - Manages the dialog for restoring hidden items
   - Handles proxy commands for the title bar

Section IDs are generated with a consistent scheme that includes:
- Section type (e.g., scripts, launch configurations)
- Workspace folder name
- Relative path to the configuration file
This ensures that each section is uniquely identified, even when multiple sections of the same type exist.

## File Structure

Key files and directories:

```
src/
  ├── extension.ts             # Main entry point
  ├── test-jetbrains.ts        # Test module for JetBrains config parsing
  ├── models/                  # Tree item classes
  │   ├── config-position.ts   # Position tracking interface
  │   ├── hidden-items-manager.ts # Hidden items manager
  │   ├── jetbrains-items.ts   # JetBrains configuration items
  │   ├── launch-items.ts      # Debug configuration items
  │   └── tree-items.ts        # Section and script items
  ├── providers/               # Data providers
  │   └── launch-configuration-provider.ts  # Main tree data provider
  ├── utils/                   # Helper utilities
  │   ├── jetbrains-parser.ts  # JetBrains XML parser
  │   ├── package-manager.ts   # Package manager detection
  │   └── script-icons.ts      # Icon determination for scripts
  └── test/                    # Tests
      └── extension.test.ts    # Basic test file
```

## Common Development Tasks

### Adding Support for a New Configuration Type

1. Create a new model class in `models/` if needed
2. Update `LaunchConfigurationProvider` to detect and parse the new configuration
3. Update the appropriate command handler in `extension.ts`
4. Add any necessary utilities in `utils/`
5. Update file watchers if needed to detect changes to the new configuration files

### Modifying Tree View Structure

1. Update the `getSections()` method in `LaunchConfigurationProvider`
2. Modify the `getChildren()` method to handle any new section types
3. Update styles and icons as needed

### Adding a New Command

1. Register the command in `package.json` under `contributes.commands`
2. Add any menu associations in `package.json` under `contributes.menus`
3. Implement the command handler in `registerCommands()` in `extension.ts`
4. Add the handler to the context subscriptions

### Modifying Hidden Items Functionality

1. Update the `HiddenItemsManager` class in `models/hidden-items-manager.ts`
2. Modify the provider's filtering logic in `shouldShowItem()` and `shouldShowSection()`
3. Update command handlers in `extension.ts`
4. Update the ID generation logic in `generateSectionId()` if necessary

## Known Issues and Future Improvements

- Complex variable substitutions in launch configurations are not fully resolved
- Some package manager-specific features (like yarn workspaces) are not fully integrated
- The JetBrains configuration parsing is based on regular expressions and may need updates for certain configuration types

## Testing the Extension

1. Run the watch script: `npm run watch`
2. Press F5 to launch the extension in debug mode
3. Test functionality in the Extension Development Host

## Publishing the Extension

The extension uses GitHub Actions for CI/CD:
- `npm run package` creates a `.vsix` file for distribution
- `npm run publish` publishes to the VS Code Marketplace (requires PAT)

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view)
- [VS Code Debug API](https://code.visualstudio.com/api/extension-guides/debugger-extension)
- [GitHub Repository](https://github.com/arthurvaverko/launch-sidebar-extension)
