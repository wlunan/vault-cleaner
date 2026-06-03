import { App, Notice, TFile } from "obsidian";
import * as path from 'path';
import VaultCleanerPlugin from "./main";
import { DeleteStrategy } from "./settings";
import { t, setLanguage } from "./locales";

export interface FileActionInfo {
	file: TFile;
	type: string;
	size: string;
	status: string;
}

export class ActionService {
	private plugin: VaultCleanerPlugin;
	private app: App;

	constructor(plugin: VaultCleanerPlugin) {
		this.plugin = plugin;
		this.app = plugin.app;
	}

	formatFileSize(bytes: number): string {
		if (bytes < 1024) {
			return bytes + " B";
		} else if (bytes < 1024 * 1024) {
			return (bytes / 1024).toFixed(1) + " KB";
		} else {
			return (bytes / (1024 * 1024)).toFixed(1) + " MB";
		}
	}

	getFileType(file: TFile): string {
		setLanguage(this.plugin.settings.language);
		const trans = t();
		const ext = file.extension.toLowerCase();
		const typeMap: Record<string, string> = {
			"md": trans.preview.fileTypes.note,
			"canvas": trans.preview.fileTypes.canvas,
			"png": trans.preview.fileTypes.image,
			"jpg": trans.preview.fileTypes.image,
			"jpeg": trans.preview.fileTypes.image,
			"gif": trans.preview.fileTypes.image,
			"webp": trans.preview.fileTypes.image,
			"svg": trans.preview.fileTypes.image,
			"pdf": "PDF",
			"mp4": trans.preview.fileTypes.video,
			"webm": trans.preview.fileTypes.video,
			"mp3": trans.preview.fileTypes.audio,
			"wav": trans.preview.fileTypes.audio,
			"ogg": trans.preview.fileTypes.audio,
			"txt": trans.preview.fileTypes.text,
			"csv": trans.preview.fileTypes.spreadsheet,
			"xlsx": trans.preview.fileTypes.spreadsheet,
			"docx": trans.preview.fileTypes.document,
		};
		return typeMap[ext] || ext.toUpperCase();
	}

	prepareFileList(files: TFile[]): FileActionInfo[] {
		setLanguage(this.plugin.settings.language);
		const trans = t();
		return files.map(file => ({
			file,
			type: this.getFileType(file),
			size: this.formatFileSize(file.stat.size),
			status: trans.preview.unreferenced
		}));
	}

	async executeDelete(files: TFile[]): Promise<void> {
		setLanguage(this.plugin.settings.language);
		const trans = t();

		if (files.length === 0) {
			new Notice(trans.action.noFilesToDelete);
			return;
		}

		const strategy = this.plugin.settings.deleteStrategy;

		try {
			switch (strategy) {
				case "custom-folder":
					await this.moveToCustomTrash(files);
					break;
				case "permanent":
					await this.permanentDelete(files);
					break;
			}
			new Notice(trans.action.deleteSuccess.replace("{count}", String(files.length)));
		} catch (error) {
			console.error("Error during file deletion:", error);
			new Notice(trans.action.deleteFailed.replace("{error}", error.message));
		}
	}

	private async moveToCustomTrash(files: TFile[]): Promise<void> {
		const trashPath = this.plugin.settings.trashFolderOverride || ".vault-trash";

		if (!await this.app.vault.adapter.exists(trashPath)) {
			await this.app.vault.createFolder(trashPath);
		}

		for (const file of files) {
			const destPath = path.posix.join(trashPath, file.name);
			await this.app.fileManager.renameFile(file, destPath);
		}
	}

	private async permanentDelete(files: TFile[]): Promise<void> {
		for (const file of files) {
			await this.app.vault.delete(file, true);
		}
	}

	async undoDelete(files: TFile[]): Promise<boolean> {
		setLanguage(this.plugin.settings.language);
		const trans = t();
		const strategy = this.plugin.settings.deleteStrategy;

		if (strategy === "permanent") {
			new Notice(trans.action.cannotUndo);
			return false;
		}

		if (strategy === "custom-folder") {
			const trashPath = this.plugin.settings.trashFolderOverride || ".vault-trash";
			try {
				for (const file of files) {
					const trashFilePath = path.posix.join(trashPath, file.name);
					if (await this.app.vault.adapter.exists(trashFilePath)) {
						const trashFile = this.app.vault.getAbstractFileByPath(trashFilePath);
						if (trashFile instanceof TFile) {
							const originalPath = file.path;
							await this.app.fileManager.renameFile(trashFile, originalPath);
						}
					}
				}
				new Notice(trans.action.restoreSuccess.replace("{count}", String(files.length)));
				return true;
			} catch (error) {
				console.error("Error during undo:", error);
				new Notice(trans.action.restoreFailed);
				return false;
			}
		}

		new Notice(trans.action.undoNotSupported);
		return false;
	}
}
