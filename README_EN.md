# Vault Cleaner

[English](README_EN.md) | [中文](README.md)

An Obsidian plugin for intelligently cleaning up orphaned files and attachments in your vault.

## Features

- **Visual Dashboard**: One-click access via ribbon icon with real-time scan status and statistics
- **Smart Detection**: Accurately identifies orphaned notes, attachments, and other files, including Canvas file links
- **Selective Deletion**: Preview and confirm files before deletion to prevent accidental loss
- **Custom Recycle Bin**: Deleted files are moved to a custom trash folder (default: `.vault-trash`) for easy recovery
- **Scheduled Auto-Cleanup**: Automatically scan and clean orphaned attachments at customizable intervals (in days)
- **File Protection**: Recently modified files are automatically protected (default: 7 days) to prevent accidental deletion
- **Flexible Configuration**: Supports whitelist folders, regex ignore patterns, custom attachment paths, and more
- **Bilingual Interface**: Full internationalization support with English and Chinese

## Usage

### Quick Start

1. Click the **Vault Cleaner** icon in the sidebar to open the cleaning dashboard
2. Click **Scan Vault** to find orphaned files
3. Review statistics to see the number of orphaned files
4. Choose to clean attachments, notes, or all orphaned files as needed
5. Confirm the file list in the preview modal and execute cleanup

### Command Palette

Quick access via Obsidian's command palette (`Ctrl/Cmd + P`):

- **Open Dashboard** - Open the visual cleaning dashboard
- **Clean Orphaned Attachments** - Scan and clean orphaned attachments only
- **Clean Orphaned Notes** - Scan and clean orphaned notes only
- **Clean All Orphaned Files** - Scan and clean all types of orphaned files

## Installation

### From Community Plugins (Recommended)

1. Open Obsidian Settings → Community Plugins → Browse
2. Search for "Vault Cleaner"
3. Click Install and Enable

### Manual Installation

1. Download the latest release from [Releases](https://github.com/wlunan/vault-cleaner/releases)
2. Extract the plugin folder into your vault's `.obsidian/plugins/` directory
3. Open Obsidian Settings → Community Plugins → Enable "Vault Cleaner"

## Configuration

### Cleanup Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Delete Strategy** | Move to custom trash or permanent delete (dangerous) | Custom trash |
| **Custom Trash Path** | Folder location for deleted files | `.vault-trash` |
| **Recently Modified Protection** | Files modified within this many days are protected | 7 days |
| **Whitelist Folders** | Folders excluded from scanning (one per line) | None |

### Auto-Cleanup Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Auto-Cleanup** | Automatically clean orphaned attachments on schedule | Disabled |
| **Cleanup Interval** | Frequency of auto-cleanup execution (days) | 3 days |
| **Check on Vault Open** | Run auto-cleanup check when vault is opened | Enabled |
| **Check on Plugin Load** | Run auto-cleanup check when plugin is loaded | Enabled |

> **Note**: Auto-cleanup only affects attachments and will not delete note files, ensuring your important content is safe.

### Advanced Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Override Attachment Folders** | Custom attachment storage locations (one per line) | Follows vault settings |
| **Ignore Patterns** | Regex patterns; matching files will be excluded | None |
| **Test Settings** | Test if a path is ignored (red = ignored, green = kept) | - |
| **Alternative Attachment Algorithm** | Enable if attachments in subfolders are not detected | Disabled |

## Development

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── main.ts              # Plugin entry point, registers commands and ribbon icon
├── dashboardModal.ts    # Visual cleaning dashboard
├── scanService.ts       # Orphan file scanning service
├── actionService.ts     # File operation service (delete/restore)
├── previewModal.ts      # Delete preview confirmation modal
├── trash_modal.ts       # Recycle bin management modal
├── autoCleanScheduler.ts # Scheduled auto-cleanup scheduler
├── settings.ts          # Settings interface
└── locales/             # Internationalization language packs
    ├── zh-CN.ts         # Chinese
    └── en-US.ts         # English
```

## License

MIT

## Acknowledgments

- This plugin is a fork of [nuke-orphans-plugin](https://github.com/ozntel/nuke-orphans-plugin), enhanced with a visual dashboard, scheduled auto-cleanup, file protection mechanisms, and more. Thanks to the original author for their excellent work.
- Thanks to all developers contributing to the Obsidian community.
