import { App, Modal, Notice, TFile } from "obsidian";
import VaultCleanerPlugin from "./main";
import { ScanService, ScanResult } from "./scanService";
import { ActionService, FileActionInfo } from "./actionService";
import { PreviewModal } from "./previewModal";
import { t, setLanguage } from "./locales";

export class DashboardModal extends Modal {
	private plugin: VaultCleanerPlugin;
	private scanService: ScanService;
	private actionService: ActionService;
	private scanResult: ScanResult | null = null;
	private isScanning: boolean = false;

	constructor(app: App, plugin: VaultCleanerPlugin) {
		super(app);
		this.plugin = plugin;
		this.scanService = new ScanService(plugin);
		this.actionService = new ActionService(plugin);
	}

	onOpen() {
		setLanguage(this.plugin.settings.language);
		const trans = t();

		const { contentEl, titleEl } = this;
		contentEl.empty();

		titleEl.setText(trans.dashboard.title);

		const container = contentEl.createDiv({ cls: "dashboard-container" });

		this.renderScanStatus(container);
		this.renderStats(container);
		this.renderActions(container);
		this.renderAutoCleanStatus(container);
		this.renderSafetyNotice(container);
	}

	private renderScanStatus(container: HTMLElement): void {
		const trans = t();
		const statusSection = container.createDiv({ cls: "dashboard-section" });
		statusSection.createEl("h3", { text: trans.dashboard.scanStatus });

		const statusEl = statusSection.createDiv({ cls: "scan-status" });
		if (this.isScanning) {
			statusEl.createEl("p", { text: trans.dashboard.scanning });
		} else if (this.scanResult) {
			statusEl.createEl("p", { text: trans.dashboard.scanComplete });
		} else {
			statusEl.createEl("p", { text: trans.dashboard.notScanned });
		}
	}

	private renderStats(container: HTMLElement): void {
		const trans = t();
		const statsSection = container.createDiv({ cls: "dashboard-section" });
		statsSection.createEl("h3", { text: trans.dashboard.stats });

		const statsEl = statsSection.createDiv({ cls: "stats-container" });

		if (this.scanResult) {
			statsEl.createEl("div", {
				cls: "stat-item",
				text: `${trans.dashboard.orphanAttachments}: ${this.scanResult.orphanAttachments.length}`
			});
			statsEl.createEl("div", {
				cls: "stat-item",
				text: `${trans.dashboard.orphanNotes}: ${this.scanResult.orphanNotes.length}`
			});
			statsEl.createEl("div", {
				cls: "stat-item",
				text: `${trans.dashboard.totalOrphans}: ${this.scanResult.orphans.length}`
			});
		} else {
			statsEl.createEl("div", {
				cls: "stat-item",
				text: `${trans.dashboard.orphanAttachments}: --`
			});
			statsEl.createEl("div", {
				cls: "stat-item",
				text: `${trans.dashboard.orphanNotes}: --`
			});
			statsEl.createEl("div", {
				cls: "stat-item",
				text: `${trans.dashboard.totalOrphans}: --`
			});
		}
	}

	private renderActions(container: HTMLElement): void {
		const trans = t();
		const actionsSection = container.createDiv({ cls: "dashboard-section" });
		actionsSection.createEl("h3", { text: trans.dashboard.actions });

		const actionsEl = actionsSection.createDiv({ cls: "actions-container" });

		const scanButton = actionsEl.createEl("button", {
			cls: ["mod-cta", "dashboard-button", "scan-button"],
			text: trans.dashboard.scanVault
		});
		scanButton.addEventListener("click", async () => {
			await this.performScan();
		});

		const cleanAttachmentsBtn = actionsEl.createEl("button", {
			cls: ["dashboard-button"],
			text: trans.dashboard.cleanAttachmentsBtn
		});
		cleanAttachmentsBtn.addEventListener("click", () => {
			this.cleanAttachments();
		});

		const cleanNotesBtn = actionsEl.createEl("button", {
			cls: ["dashboard-button"],
			text: trans.dashboard.cleanNotesBtn
		});
		cleanNotesBtn.addEventListener("click", () => {
			this.cleanNotes();
		});

		const cleanAllBtn = actionsEl.createEl("button", {
			cls: ["dashboard-button", "danger-button"],
			text: trans.dashboard.cleanAllBtn
		});
		cleanAllBtn.addEventListener("click", () => {
			this.cleanAll();
		});
	}

	private renderAutoCleanStatus(container: HTMLElement): void {
		const trans = t();
		const autoSection = container.createDiv({ cls: "dashboard-section" });
		autoSection.createEl("h3", { text: trans.dashboard.autoCleanStatus });

		const autoEl = autoSection.createDiv({ cls: "auto-clean-status" });

		if (this.plugin.settings.autoCleanEnabled) {
			autoEl.createEl("p", { text: trans.dashboard.autoCleanEnabled });
			autoEl.createEl("p", {
				text: trans.dashboard.everyDays.replace("{days}", String(this.plugin.settings.autoCleanIntervalDays))
			});
		} else {
			autoEl.createEl("p", { text: trans.dashboard.autoCleanDisabled });
		}

		let strategyText = trans.dashboard.strategyCustom;
		if (this.plugin.settings.deleteStrategy === "permanent") {
			strategyText = trans.dashboard.strategyPermanent;
		}
		autoEl.createEl("p", { text: `${trans.dashboard.deleteStrategy}: ${strategyText}` });
	}

	private renderSafetyNotice(container: HTMLElement): void {
		const trans = t();
		const safetySection = container.createDiv({ cls: "dashboard-section" });
		safetySection.createEl("h3", { text: trans.dashboard.safetyNotice });

		const safetyEl = safetySection.createDiv({ cls: "safety-notice" });
		safetyEl.createEl("p", {
			text: trans.dashboard.safetyProtected.replace("{days}", String(this.plugin.settings.protectedDays))
		});
		safetyEl.createEl("p", { text: trans.dashboard.safetyPreview });
		safetyEl.createEl("p", { text: trans.dashboard.safetyAutoClean });
	}

	private async performScan(): Promise<void> {
		const trans = t();
		this.isScanning = true;
		new Notice(trans.dashboard.scanVault);
		this.onOpen();

		try {
			this.scanResult = await this.scanService.scanVault();
			new Notice(trans.dashboard.scanCompleteNotice.replace("{count}", String(this.scanResult.orphans.length)));
		} catch (error) {
			new Notice(trans.dashboard.scanFailed.replace("{error}", error.message));
			console.error("Scan error:", error);
		}

		this.isScanning = false;
		this.onOpen();
	}

	private cleanAttachments(): void {
		const trans = t();
		if (!this.scanResult) {
			new Notice(trans.dashboard.scanFirst);
			return;
		}

		if (this.scanResult.orphanAttachments.length === 0) {
			new Notice(trans.plugin.noOrphanAttachments);
			return;
		}

		const fileInfos = this.actionService.prepareFileList(this.scanResult.orphanAttachments);

		new PreviewModal(this.app, fileInfos, async () => {
			await this.actionService.executeDelete(this.scanResult!.orphanAttachments);
			this.scanResult = await this.scanService.scanVault();
			this.onOpen();
		}, this.plugin.settings.language).open();
	}

	private cleanNotes(): void {
		const trans = t();
		if (!this.scanResult) {
			new Notice(trans.dashboard.scanFirst);
			return;
		}

		if (this.scanResult.orphanNotes.length === 0) {
			new Notice(trans.plugin.noOrphanNotes);
			return;
		}

		const fileInfos = this.actionService.prepareFileList(this.scanResult.orphanNotes);

		new PreviewModal(this.app, fileInfos, async () => {
			await this.actionService.executeDelete(this.scanResult!.orphanNotes);
			this.scanResult = await this.scanService.scanVault();
			this.onOpen();
		}, this.plugin.settings.language).open();
	}

	private cleanAll(): void {
		const trans = t();
		if (!this.scanResult) {
			new Notice(trans.dashboard.scanFirst);
			return;
		}

		if (this.scanResult.orphans.length === 0) {
			new Notice(trans.plugin.noOrphans);
			return;
		}

		const fileInfos = this.actionService.prepareFileList(this.scanResult.orphans);

		new PreviewModal(this.app, fileInfos, async () => {
			await this.actionService.executeDelete(this.scanResult!.orphans);
			this.scanResult = await this.scanService.scanVault();
			this.onOpen();
		}, this.plugin.settings.language).open();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
