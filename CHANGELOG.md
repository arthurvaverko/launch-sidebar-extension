# Change Log

All notable changes to the "launch-sidebar" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.2.0] - 2026-07-30
### Added
- **Run Without Debugging**: debug configurations now have a second inline button that starts them with the debugger detached ([#1](https://github.com/arthurvaverko/launch-sidebar-extension/issues/1)). The play icon runs without debugging; the debug icon starts a debug session.
- **`launchSidebar.runOnClick`** (default `false`): when enabled, clicking an item's name starts it, instead of having to use the play button ([#1](https://github.com/arthurvaverko/launch-sidebar-extension/issues/1)). Off by default so a stray click cannot launch anything.

### Changed
- Hidden items and hidden sections are now remembered **per workspace** instead of globally ([#2](https://github.com/arthurvaverko/launch-sidebar-extension/issues/2)). Hiding an OS-specific launch configuration in one workspace no longer hides it in every other workspace. Anything you had hidden before this release is carried over the first time each workspace is opened, and from then on that workspace keeps its own list.

## [0.1.0] - 2026-07-28
### Fixed
- Live refresh on `launch.json`, `package.json` and `Makefile` changes: a duplicate command registration threw during activation and prevented the file watchers from ever registering. This also removes the error notification that appeared on every activation.
- Makefile parsing: variable assignments such as `VERSION:=1.0` were listed as runnable tasks, while targets containing dots (`build.all:`) and multiple targets on one line (`a b c:`) were missed.
- Makefile tasks now show their recipe, which was previously always empty. Indented comments and blank lines inside a recipe no longer truncate it.
- JetBrains run configurations: environment variables were injected with POSIX `export` statements, which broke on Windows shells and could break out of quoting. They are now passed to the terminal directly. Script and task names are also quoted when interpolated into shell commands.
- JetBrains shell configurations set to run a script file ignored that setting and ran the script's arguments as a command instead, so a configuration with `SCRIPT_OPTIONS="--force"` ran `--force` on its own. Shell configurations now run their script through the configured interpreter, with the options passed as arguments to it.
- JetBrains Go test configurations ran their test flags as a bare command (`-run TestFoo`) instead of `go test -run TestFoo <package>`.
- Environment variables declared on a JetBrains configuration were only read for Go application configurations; shell and test configurations silently dropped them. They are now read for every configuration type, and values that look numeric (`value="8080"`) stay strings.

### Changed
- Nested `package.json` discovery now uses VS Code's native async file search instead of a synchronous directory walk on every tree refresh, which is noticeably faster in monorepos.
- A failed activation now reports itself as failed instead of being swallowed, so the extension can no longer end up half-initialised while appearing to work.

### Removed
- The extension no longer overrides the global `console` object, which affected other extensions running in the same host process.
- Dead code and three unregistered commands.

### Security
- Updated `fast-xml-parser` to 5.10.1, resolving a critical entity-expansion denial-of-service advisory and several related XML parsing issues.

## [0.0.12] - 2025-05-06
### Added
- Hide configurations: Right-click on any launch configuration, script, or task to hide it from the sidebar
- Hide entire sections: Right-click on section headers to hide all items in a section
- Manage hidden items: New eye icon in the title bar opens a dialog to restore hidden items
- Persistent storage: Hidden items and sections are remembered between VS Code sessions
- Bulk restore: Option to restore all hidden items, sections, or both at once
- Visual indicators: 
  - Badge showing the number of hidden items in the title bar
  - Section descriptions showing when items are hidden
  - Tooltips explaining how to restore hidden items

### Improved
- Cleaner sidebar with ability to hide rarely used configurations and entire sections
- Better title bar organization with dedicated manage button and counter badge

## [0.0.11] - 2025-05-06
- Fixed issue with JetBrains run configurations not being runnable from Recent Items after reopening VS Code

## [0.0.10] - 2025-04-30
### Fixed
- Play, edit, and delete icons no longer appear on the 'Recently Used' section header.
- Play and edit actions for recent items now work correctly and invoke the original item's logic.
- Edit button for recent items now works for all item types.

### Changed
- NPM scripts now use the play icon for consistency.

### Improved
- Added detailed persistence and debug logging for recent items.
- More robust handling and diagnostics for recent item restoration across sessions.

## [0.0.9] - 2025-04-29
### Added
- Makefile tasks provider: scan Makefile, show targets in sidebar, run with `make <target>`
- Makefile tasks get contextual icons based on target name (build, test, clean, etc.)
- Section headers now use custom icons: NPM, JetBrains, Makefile (GNU), and VS Code for debug configs
- Run action for Makefile tasks uses the play icon, matching other run actions

### Fixed
- Section icon assignment now uses `vscode.Uri.file` to avoid type errors

## [0.0.8] - 2025-04-29
### Added
- Play (launch), edit, and delete (remove) icons now appear inline for recent items in the sidebar, matching regular items.
- Context menu actions for recent items use the same commands and icons as regular launch configurations.
- Updated menu contributions in `package.json` to support these features.

### Changed
- Bumped extension version to 0.0.8.

## [0.0.7] - 2025-04-28
### Fixed
- Fixed error "No view is registered with id: launchConfigurationsView" by aligning view IDs
- Added terminal reuse functionality to prevent opening new terminals for each command execution
- Fixed command handling for all item types (launch configs, scripts, JetBrains configs)
- Implemented proper terminal management for better user experience
- Added execute methods to all tree item classes for consistent command execution

## [0.0.6] - 2025-04-28
- Complete rewrite of JetBrains configuration parser using proper XML parsing
- Robust support for ShConfigurationType configurations
- Fixed handling of all shell script configuration options (inline scripts, script files, parameters)
- Added support for .run.xml file extension format
- Improved XML parsing with fallback options for different JetBrains configurations formats

## [0.0.5] - 2025-04-26
- Added support for JetBrains ShConfigurationType (shell scripts)
- Enhanced XML parsing for JetBrains configurations
- Added support for inline shell scripts and script files
- Added proper handling of script options and interpreter settings

## [0.0.4] - 2025-04-26
- Fixed compatibility with Cursor (VS Code 1.96.2)

## [0.0.3] - 2025-04-11
- Initial release
