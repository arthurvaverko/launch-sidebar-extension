# Change Log

All notable changes to the "launch-sidebar" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.10] - 2024-05-01
### Fixed
- Play, edit, and delete icons no longer appear on the 'Recently Used' section header.
- Play and edit actions for recent items now work correctly and invoke the original item's logic.
- Edit button for recent items now works for all item types.

### Changed
- NPM scripts now use the play icon for consistency.

### Improved
- Added detailed persistence and debug logging for recent items.
- More robust handling and diagnostics for recent item restoration across sessions.

## [0.0.7] - 2024-04-14
### Fixed
- Fixed error "No view is registered with id: launchConfigurationsView" by aligning view IDs
- Added terminal reuse functionality to prevent opening new terminals for each command execution
- Fixed command handling for all item types (launch configs, scripts, JetBrains configs)
- Implemented proper terminal management for better user experience
- Added execute methods to all tree item classes for consistent command execution

## [0.0.6] - 2024-04-11
- Complete rewrite of JetBrains configuration parser using proper XML parsing
- Robust support for ShConfigurationType configurations
- Fixed handling of all shell script configuration options (inline scripts, script files, parameters)
- Added support for .run.xml file extension format
- Improved XML parsing with fallback options for different JetBrains configurations formats

## [0.0.5] - 2024-04-11
- Added support for JetBrains ShConfigurationType (shell scripts)
- Enhanced XML parsing for JetBrains configurations
- Added support for inline shell scripts and script files
- Added proper handling of script options and interpreter settings

## [0.0.4] - 2024-04-11
- Fixed compatibility with Cursor (VS Code 1.96.2)

## [0.0.3]
- Initial release

## [0.0.8] - 2024-04-11
### Added
- Play (launch), edit, and delete (remove) icons now appear inline for recent items in the sidebar, matching regular items.
- Context menu actions for recent items use the same commands and icons as regular launch configurations.
- Updated menu contributions in `package.json` to support these features.

### Changed
- Bumped extension version to 0.0.8.

## [0.0.9] - 2024-04-14
### Added
- Makefile tasks provider: scan Makefile, show targets in sidebar, run with `make <target>`
- Makefile tasks get contextual icons based on target name (build, test, clean, etc.)
- Section headers now use custom icons: NPM, JetBrains, Makefile (GNU), and VS Code for debug configs
- Run action for Makefile tasks uses the play icon, matching other run actions

### Fixed
- Section icon assignment now uses `vscode.Uri.file` to avoid type errors