import { App, Modal, Notice, TFile } from "obsidian";
import { FileActionInfo } from "./actionService";
import { t, setLanguage, Language } from "./locales";

export class PreviewModal extends Modal {
	private files: FileActionInfo[];
	private onConfirm: () => void;
	private confirmed: boolean = false;
	private language: Language;

	constructor(app: App, files: FileActionInfo[], onConfirm: () => void, language: Language) {
		super(app);
		this.files = files;
		this.onConfirm = onConfirm;
		this.language = language;
	}

	onOpen() {
		setLanguage(this.language);
		const trans = t();

		const { contentEl, titleEl } = this;
		contentEl.empty();

		titleEl.setText(trans.preview.title.replace("{count}", String(this.files.length)));

		const container = contentEl.createDiv({ cls: "preview-modal-container" });

		const fileList = container.createDiv({ cls: "preview-file-list" });

		this.files.forEach((info) => {
			const fileItem = fileList.createDiv({ cls: "preview-file-item" });

			const icon = info.file.extension === "md" ? "📝" : "📎";

			fileItem.createEl("div", {
				cls: "preview-file-icon",
				text: icon
			});

			const fileInfo = fileItem.createDiv({ cls: "preview-file-info" });
			fileInfo.createEl("div", {
				cls: "preview-file-name",
				text: info.file.name
			});
			fileInfo.createEl("div", {
				cls: "preview-file-path",
				text: `${trans.preview.filePath}: ${info.file.path}`
			});
			fileInfo.createEl("div", {
				cls: "preview-file-meta",
				text: `${trans.preview.fileSize}: ${info.size} | ${trans.preview.fileType}: ${info.type} | ${trans.preview.fileStatus}: ${info.status}`
			});
		});

		const warningBox = container.createDiv({ cls: "preview-warning" });
		warningBox.createEl("p", {
			text: trans.preview.warning
		});

		const checkboxContainer = container.createDiv({ cls: "preview-checkbox-container" });
		const checkbox = checkboxContainer.createEl("input", {
			type: "checkbox",
			cls: "preview-confirm-checkbox"
		});
		checkboxContainer.createEl("label", {
			cls: "preview-checkbox-label",
			text: trans.preview.confirmCheckbox
		});

		const buttonContainer = container.createDiv({ cls: "preview-button-container" });

		buttonContainer.createEl("button", {
			cls: ["mod-cancel", "preview-button"],
			text: trans.preview.cancel
		}).addEventListener("click", () => this.close());

		const confirmButton = buttonContainer.createEl("button", {
			cls: ["mod-cta", "preview-button"],
			text: trans.preview.execute
		});
		confirmButton.disabled = true;

		checkbox.addEventListener("change", () => {
			confirmButton.disabled = !checkbox.checked;
		});

		confirmButton.addEventListener("click", () => {
			if (checkbox.checked) {
				this.confirmed = true;
				this.onConfirm();
				this.close();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
