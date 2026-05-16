import { App, TFile, CanvasData } from "obsidian";
import VaultCleanerPlugin from "./main";

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

export interface ScanResult {
	orphans: TFile[];
	orphanAttachments: TFile[];
	orphanNotes: TFile[];
}

export class ScanService {
	private plugin: VaultCleanerPlugin;
	private app: App;

	constructor(plugin: VaultCleanerPlugin) {
		this.plugin = plugin;
		this.app = plugin.app;
	}

	getIgnoreFilter(): CustomFilter {
		const strings: string[] = [];

		if (this.plugin.settings.trashFolderOverride.length > 0) {
			strings.push(this.plugin.settings.trashFolderOverride);
		}

		this.plugin.settings.whitelistFolders.forEach(folder => {
			if (folder.length > 0) {
				strings.push(folder);
			}
		});

		return new CustomFilter(this.plugin.settings.ignorePatterns, strings);
	}

	getAttachmentsPaths(): string[] {
		if (this.plugin.settings.attachmentsPaths.length === 0) {
			return [this.app.vault.config.attachmentFolderPath];
		}
		return this.plugin.settings.attachmentsPaths;
	}

	isAttachment(file: TFile): boolean {
		return this.getAttachmentsPaths().some(element => {
			if (element.startsWith("./")) {
				if (this.plugin.settings.alternativeAttachmentAlg) {
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

	private isProtected(file: TFile): boolean {
		if (this.plugin.settings.protectedDays <= 0) {
			return false;
		}

		const now = Date.now();
		const protectedMs = this.plugin.settings.protectedDays * 24 * 60 * 60 * 1000;
		const fileModifiedTime = file.stat.mtime;

		return (now - fileModifiedTime) < protectedMs;
	}

	async scanVault(): Promise<ScanResult> {
		const links = new Set<string>(
			Object.values(this.app.metadataCache.resolvedLinks)
				.flatMap(x => Object.keys(x))
		);
		const canvasLinks = await this.getCanvasLinks();
		const filter = this.getIgnoreFilter();

		const orphans = this.app.vault.getFiles().filter(file => {
			return ![
				links.has(file.path),
				canvasLinks.has(file.path),
				filter.test(file.path),
				this.isProtected(file)
			].some(x => x === true);
		});

		const orphanAttachments = orphans.filter(file => this.isAttachment(file));
		const orphanNotes = orphans.filter(file => file.extension === "md");

		return {
			orphans,
			orphanAttachments,
			orphanNotes
		};
	}
}
