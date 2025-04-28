# Change Log

All notable changes to the "launch-sidebar" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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