import { Notice, Plugin, TFile, TFolder, CanvasData } from "obsidian";
import { DEFAULT_SETTINGS, VaultCleanerSettings, VaultCleanerSettingsTab } from "./settings";
import { TrashFilesModal } from "./trash_modal";
import { ScanService, ScanResult } from "./scanService";
import { ActionService, FileActionInfo } from "./actionService";
import { PreviewModal } from "./previewModal";
import { DashboardModal } from "./dashboardModal";
import { AutoCleanScheduler } from "./autoCleanScheduler";
import { t, setLanguage } from "./locales";

class CustomFilter {
	private readonly regexes: Set<RegExp>;
	private readonly strings: Set<string>;

	constructor(regexes: string[], strings: string[]) {
		this.regexes = new Set<RegExp>(regexes.map(x => RegExp(x)));
		this.strings = new Set<string>(strings);
	}

	public test(input: string): boolean {
		return Array.from(this.regexes).some(x => x.test(input)) ||
			Array.from(this.strings).some(x => x === input);
	}
}

export default class VaultCleanerPlugin extends Plugin {
	settings: VaultCleanerSettings;
	private scanService: ScanService;
	private actionService: ActionService;
	private autoCleanScheduler: AutoCleanScheduler;

	async onload() {
		await this.loadSettings();
		setLanguage(this.settings.language);

		this.scanService = new ScanService(this);
		this.actionService = new ActionService(this);
		this.autoCleanScheduler = new AutoCleanScheduler(this);

		const trans = t();

		this.addRibbonIcon("brush-cleaning", trans.plugin.name, () => {
			new DashboardModal(this.app, this).open();
		});

		this.addCommand({
			id: "open-dashboard",
			name: trans.plugin.openDashboard,
			callback: () => {
				new DashboardModal(this.app, this).open();
			},
		});

		this.addCommand({
			id: "clean-orphaned-attachments",
			name: trans.plugin.cleanAttachments,
			callback: async () => {
				setLanguage(this.settings.language);
				const trans = t();
				new Notice(trans.plugin.gatheringAttachments);
				const scanResult = await this.scanService.scanVault();
				if (scanResult.orphanAttachments.length > 0) {
					const fileInfos = this.actionService.prepareFileList(scanResult.orphanAttachments);
					new PreviewModal(this.app, fileInfos, async () => {
						await this.actionService.executeDelete(scanResult.orphanAttachments);
					}, this.settings.language).open();
				} else {
					new Notice(trans.plugin.noOrphanAttachments);
				}
			},
		});

		this.addCommand({
			id: "clean-orphaned-notes",
			name: trans.plugin.cleanNotes,
			callback: async () => {
				setLanguage(this.settings.language);
				const trans = t();
				new Notice(trans.plugin.gatheringNotes);
				const scanResult = await this.scanService.scanVault();
				if (scanResult.orphanNotes.length > 0) {
					const fileInfos = this.actionService.prepareFileList(scanResult.orphanNotes);
					new PreviewModal(this.app, fileInfos, async () => {
						await this.actionService.executeDelete(scanResult.orphanNotes);
					}, this.settings.language).open();
				} else {
					new Notice(trans.plugin.noOrphanNotes);
				}
			},
		});

		this.addCommand({
			id: "clean-orphaned-files",
			name: trans.plugin.cleanAll,
			callback: async () => {
				setLanguage(this.settings.language);
				const trans = t();
				new Notice(trans.plugin.gatheringFiles);
				const scanResult = await this.scanService.scanVault();
				if (scanResult.orphans.length > 0) {
					const fileInfos = this.actionService.prepareFileList(scanResult.orphans);
					new PreviewModal(this.app, fileInfos, async () => {
						await this.actionService.executeDelete(scanResult.orphans);
					}, this.settings.language).open();
				} else {
					new Notice(trans.plugin.noOrphans);
				}
			},
		});

		this.addSettingTab(new VaultCleanerSettingsTab(this.app, this));

		await this.autoCleanScheduler.initialize();

		this.registerEvent(
			this.app.workspace.on("workspace:layout-change", async () => {
				await this.autoCleanScheduler.onVaultOpen();
			})
		);
	}

	onunload() {
		this.autoCleanScheduler.destroy();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.autoCleanScheduler.updateSettings();
	}

	getIgnoreFilter(): CustomFilter {
		const strings: string[] = [];

		if (this.settings.trashFolderOverride.length > 0) {
			strings.push(this.settings.trashFolderOverride);
		}

		return new CustomFilter(this.settings.ignorePatterns, strings);
	}

	shouldUseSystemTrash(): boolean {
		switch (this.app.vault.config.trashOption) {
			case "system":
				return true;
			default:
				return false;
		}
	}

	getAttachmentsPaths(): string[] {
		if (this.settings.attachmentsPaths.length === 0) {
			return [this.app.vault.config.attachmentFolderPath];
		}
		return this.settings.attachmentsPaths;
	}

	isAttachment(file: TFile): boolean {
		return this.getAttachmentsPaths().some(element => {
			if (element.startsWith("./")) {
				if (this.settings.alternativeAttachmentAlg) {
					let path: any = file.parent;
					while (path && path.name !== undefined && path.name.length > 0) {
						if (path.name === element.substring(2)) {
							return true;
						}
						path = path.parent;
					}
				} else {
					return file.path.startsWith(element.substring(2)) ||
						file.path.contains(element.substring(1) + "/");
				}
			} else {
				if (file.parent && file.parent.path === element) {
					return true;
				}
				if (file.path.startsWith(element)) {
					return true;
				}
			}
			return false;
		});
	}

	private async getCanvasLinks(): Promise<Set<string>> {
		const links = new Set<string>();

		await Promise.all(
			this.app.vault.getFiles()
				.filter(f => f.extension === 'canvas')
				.map(async (f) => {
					const content = await this.app.vault.read(f);
					try {
						const canvas: CanvasData = JSON.parse(content);
						canvas.nodes
							.filter(node => node.type === 'file')
							.forEach(node => links.add(node.file));
					} catch (e) {
						console.error("Error parsing canvas file " + f.path + "\n", e);
					}
				})
		);

		return links;
	}

	async getOrphans(): Promise<TFile[]> {
		const links = new Set<string>(
			Object.values(this.app.metadataCache.resolvedLinks)
				.flatMap(x => Object.keys(x))
		);
		const canvasLinks = await this.getCanvasLinks();
		const filter = this.getIgnoreFilter();

		return this.app.vault.getFiles().filter(file => {
			return ![
				links.has(file.path),
				canvasLinks.has(file.path),
				filter.test(file.path)
			].some(x => x === true);
		});
	}

	trash(files: TFile[]) {
		setLanguage(this.settings.language);
		const trans = t();
		if (files.length > 0) {
			new TrashFilesModal(this.app, files, this.settings.trashFolderOverride, this.shouldUseSystemTrash()).open();
		} else {
			new Notice(trans.plugin.noOrphans);
		}
	}
}
