import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, VaultCleanerSettings, VaultCleanerSettingsTab } from "./settings";
import { ScanService } from "./scanService";
import { ActionService } from "./actionService";
import { PreviewModal } from "./previewModal";
import { DashboardModal } from "./dashboardModal";
import { AutoCleanScheduler } from "./autoCleanScheduler";
import { t, setLanguage } from "./locales";

export default class VaultCleanerPlugin extends Plugin {
	settings: VaultCleanerSettings;
	scanService: ScanService;
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
}
