import { Notice, TFile } from "obsidian";
import VaultCleanerPlugin from "./main";
import { ScanService } from "./scanService";
import { ActionService } from "./actionService";
import { t, setLanguage } from "./locales";

const STORAGE_KEY_LAST_CLEAN = "nuke-cleaner-last-auto-clean";

export class AutoCleanScheduler {
	private plugin: VaultCleanerPlugin;
	private scanService: ScanService;
	private actionService: ActionService;
	private intervalId: number | null = null;

	constructor(plugin: VaultCleanerPlugin) {
		this.plugin = plugin;
		this.scanService = new ScanService(plugin);
		this.actionService = new ActionService(plugin);
	}

	async initialize(): Promise<void> {
		if (!this.plugin.settings.autoCleanEnabled) {
			return;
		}

		if (this.plugin.settings.autoCleanOnPluginLoad) {
			await this.checkAndRun();
		}

		this.setupInterval();
	}

	async onVaultOpen(): Promise<void> {
		if (!this.plugin.settings.autoCleanEnabled) {
			return;
		}

		if (this.plugin.settings.autoCleanOnVaultOpen) {
			await this.checkAndRun();
		}
	}

	private setupInterval(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
		}

		const intervalMs = this.plugin.settings.autoCleanIntervalDays * 24 * 60 * 60 * 1000;

		this.intervalId = window.setInterval(async () => {
			await this.checkAndRun();
		}, intervalMs);
	}

	private async checkAndRun(): Promise<void> {
		const lastClean = await this.getLastCleanTime();
		const now = Date.now();
		const intervalMs = this.plugin.settings.autoCleanIntervalDays * 24 * 60 * 60 * 1000;

		if (lastClean && (now - lastClean) < intervalMs) {
			return;
		}

		await this.runAutoClean();
	}

	private async runAutoClean(): Promise<void> {
		setLanguage(this.plugin.settings.language);
		const trans = t();
		try {
			const scanResult = await this.scanService.scanVault();

			if (scanResult.orphanAttachments.length === 0) {
				return;
			}

			await this.actionService.executeDelete(scanResult.orphanAttachments);

			await this.setLastCleanTime(Date.now());

			new Notice(trans.action.autoCleanNotice.replace("{count}", String(scanResult.orphanAttachments.length)));
		} catch (error) {
			console.error("Auto clean failed:", error);
			new Notice(trans.action.autoCleanFailed.replace("{error}", error.message));
		}
	}

	private async getLastCleanTime(): Promise<number | null> {
		try {
			const data = await this.plugin.loadData();
			if (data && data[STORAGE_KEY_LAST_CLEAN]) {
				return data[STORAGE_KEY_LAST_CLEAN];
			}
		} catch (error) {
			console.error("Failed to load last clean time:", error);
		}
		return null;
	}

	private async setLastCleanTime(timestamp: number): Promise<void> {
		try {
			const data = await this.plugin.loadData() || {};
			data[STORAGE_KEY_LAST_CLEAN] = timestamp;
			await this.plugin.saveData(data);
		} catch (error) {
			console.error("Failed to save last clean time:", error);
		}
	}

	destroy(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	updateSettings(): void {
		this.destroy();
		if (this.plugin.settings.autoCleanEnabled) {
			this.setupInterval();
		}
	}
}
