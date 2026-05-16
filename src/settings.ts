import { App, PluginSettingTab, Setting } from "obsidian";
import VaultCleanerPlugin from "./main";
import { t, setLanguage, getLanguage, Language, getAvailableLanguages } from "./locales";

export type DeleteStrategy = "custom-folder" | "permanent";

export interface VaultCleanerSettings {
	attachmentsPaths: string[],
	trashFolderOverride: string,
	ignorePatterns: string[],
	alternativeAttachmentAlg: boolean,
	deleteStrategy: DeleteStrategy,
	protectedDays: number,
	whitelistFolders: string[],
	autoCleanEnabled: boolean,
	autoCleanIntervalDays: number,
	autoCleanOnVaultOpen: boolean,
	autoCleanOnPluginLoad: boolean,
	language: Language,
}

export const DEFAULT_SETTINGS: VaultCleanerSettings = {
	attachmentsPaths: [],
	trashFolderOverride: ".vault-trash",
	ignorePatterns: [],
	alternativeAttachmentAlg: false,
	deleteStrategy: "custom-folder",
	protectedDays: 7,
	whitelistFolders: [],
	autoCleanEnabled: false,
	autoCleanIntervalDays: 3,
	autoCleanOnVaultOpen: true,
	autoCleanOnPluginLoad: true,
	language: "en-US",
}

const CSS_CLASS_CHECK_PASS = "vault-cleaner-pass"
const CSS_CLASS_CHECK_FAIL = "vault-cleaner-fail"

export class VaultCleanerSettingsTab extends PluginSettingTab {
	plugin: VaultCleanerPlugin;

	constructor(app: App, plugin: VaultCleanerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		setLanguage(this.plugin.settings.language);
		const trans = t();

		containerEl.createEl("h3", {
			attr: { "style": "text-align: center;" },
			text: trans.settings.title
		});

		this.renderLanguageSetting(containerEl);
		this.renderCleanupSettings(containerEl);
		this.renderAutoCleanSettings(containerEl);
		this.renderAdvancedSettings(containerEl);
	}

	private renderLanguageSetting(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "🌐 Language / 语言" });

		new Setting(containerEl)
			.setName("Interface Language")
			.setDesc("Choose your preferred language")
			.addDropdown(dropdown => {
				getAvailableLanguages().forEach(lang => {
					dropdown.addOption(lang.code, lang.name);
				});
				dropdown.setValue(this.plugin.settings.language);
				dropdown.onChange(async (value: Language) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
					setLanguage(value);
					this.display();
				});
			});
	}

	private renderCleanupSettings(containerEl: HTMLElement): void {
		const trans = t();
		containerEl.createEl("h3", { text: trans.settings.cleanupSettings });

		new Setting(containerEl)
			.setName(trans.settings.deleteStrategy)
			.setDesc(trans.settings.deleteStrategyDesc)
			.addDropdown(dropdown => {
				dropdown.addOption("custom-folder", trans.settings.strategyCustom);
				dropdown.addOption("permanent", trans.settings.strategyPermanent);
				dropdown.setValue(this.plugin.settings.deleteStrategy);
				dropdown.onChange(async (value: DeleteStrategy) => {
					this.plugin.settings.deleteStrategy = value;
					await this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName(trans.settings.customTrashFolder)
			.setDesc(trans.settings.customTrashFolderDesc)
			.addText(text =>
				text.setPlaceholder(".vault-trash")
					.setValue(this.plugin.settings.trashFolderOverride)
					.onChange(async (value) => {
						this.plugin.settings.trashFolderOverride = value;
						await this.plugin.saveSettings();
					}));

		new Setting(containerEl)
			.setName(trans.settings.protectedDays)
			.setDesc(trans.settings.protectedDaysDesc)
			.addText(text => {
				text.inputEl.type = "number";
				text.setPlaceholder("7")
					.setValue(String(this.plugin.settings.protectedDays))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 0) {
							this.plugin.settings.protectedDays = num;
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(containerEl)
			.setName(trans.settings.whitelistFolders)
			.setDesc(trans.settings.whitelistFoldersDesc)
			.addTextArea(text =>
				text.setPlaceholder("attachments/important\ndocs/archive")
					.setValue(this.plugin.settings.whitelistFolders.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.whitelistFolders = value.split('\n').map(x => x.trim()).filter(x => x.length > 0);
						await this.plugin.saveSettings();
					}));
	}

	private renderAutoCleanSettings(containerEl: HTMLElement): void {
		const trans = t();
		containerEl.createEl("h3", { text: trans.settings.autoCleanSettings });

		new Setting(containerEl)
			.setName(trans.settings.enableAutoClean)
			.setDesc(trans.settings.enableAutoCleanDesc)
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.autoCleanEnabled)
					.onChange(async (value) => {
						this.plugin.settings.autoCleanEnabled = value;
						await this.plugin.saveSettings();
						this.display();
					}));

		if (this.plugin.settings.autoCleanEnabled) {
			new Setting(containerEl)
				.setName(trans.settings.cleanInterval)
				.setDesc(trans.settings.cleanIntervalDesc)
				.addText(text => {
					text.inputEl.type = "number";
					text.setPlaceholder("3")
						.setValue(String(this.plugin.settings.autoCleanIntervalDays))
						.onChange(async (value) => {
							const num = parseInt(value, 10);
							if (!isNaN(num) && num >= 1) {
								this.plugin.settings.autoCleanIntervalDays = num;
								await this.plugin.saveSettings();
							}
						});
				});

			new Setting(containerEl)
				.setName(trans.settings.checkOnVaultOpen)
				.setDesc(trans.settings.checkOnVaultOpenDesc)
				.addToggle(toggle =>
					toggle.setValue(this.plugin.settings.autoCleanOnVaultOpen)
						.onChange(async (value) => {
							this.plugin.settings.autoCleanOnVaultOpen = value;
							await this.plugin.saveSettings();
						}));

			new Setting(containerEl)
				.setName(trans.settings.checkOnPluginLoad)
				.setDesc(trans.settings.checkOnPluginLoadDesc)
				.addToggle(toggle =>
					toggle.setValue(this.plugin.settings.autoCleanOnPluginLoad)
						.onChange(async (value) => {
							this.plugin.settings.autoCleanOnPluginLoad = value;
							await this.plugin.saveSettings();
						}));
		}
	}

	private renderAdvancedSettings(containerEl: HTMLElement): void {
		const trans = t();
		containerEl.createEl("h3", { text: trans.settings.advancedSettings });

		new Setting(containerEl)
			.setName(trans.settings.attachmentFolder)
			.setDesc(trans.settings.attachmentFolderDesc)
			.addTextArea(text =>
				text.setPlaceholder(this.app.vault.config.attachmentFolderPath)
					.setValue(this.plugin.settings.attachmentsPaths.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.attachmentsPaths = value.split('\n').map(x => x.trim()).filter(x => x.length > 0);
						await this.plugin.saveSettings();
					}));

		new Setting(containerEl)
			.setName(trans.settings.ignorePatterns)
			.setDesc(trans.settings.ignorePatternsDesc)
			.addTextArea(text =>
				text.setValue(this.plugin.settings.ignorePatterns.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.ignorePatterns = value.split("\n").map(x => x.trim()).filter(x => x.length > 0);
						await this.plugin.saveSettings();
					}));

		new Setting(containerEl)
			.setName(trans.settings.testSettings)
			.setDesc(trans.settings.testSettingsDesc)
			.addText(text => {
				const resetColor = () => {
					text.inputEl.classList.remove(CSS_CLASS_CHECK_PASS, CSS_CLASS_CHECK_FAIL);
				};

				text.onChange(value => {
					resetColor();
					if (value.length === 0) return;
					if (this.plugin.getIgnoreFilter().test(value))
						text.inputEl.classList.add(CSS_CLASS_CHECK_FAIL);
					else
						text.inputEl.classList.add(CSS_CLASS_CHECK_PASS);
				});

				text.inputEl.addEventListener("focusout", () => resetColor());
				text.inputEl.addEventListener("focusin", () => text.onChanged());
			});

		new Setting(containerEl)
			.setName(trans.settings.alternativeAlg)
			.setDesc(trans.settings.alternativeAlgDesc)
			.addToggle(btn =>
				btn.setValue(this.plugin.settings.alternativeAttachmentAlg)
					.onChange(async value => {
						this.plugin.settings.alternativeAttachmentAlg = value;
						await this.plugin.saveSettings();
					}));
	}
}
