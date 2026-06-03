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
	// 孤立文件 = 既不在 inboundLinks 中，也不在 outboundLinks 中的文件,即：既没有被别人链接，也没有链接别人 → 孤立文件
	async scanVault(): Promise<ScanResult> {
		// 被其他文件链接的文件 B链接A，A，B都不算孤立
		const inboundLinks = new Set<string>(
			Object.values(this.app.metadataCache.resolvedLinks)
				.flatMap(x => Object.keys(x))
		);

		// 链接了其他文件的文件（你的逻辑：有链接出去就不算孤立）
		// 只有当文件实际链接了其他文件（值不为空对象）才算
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		const outboundLinks = new Set<string>();
		for (const source in resolvedLinks) {
			if (Object.keys(resolvedLinks[source]).length > 0) {
				outboundLinks.add(source);
			}
		}

		const canvasLinks = await this.getCanvasLinks();
		const filter = this.getIgnoreFilter();

		// 调试：打印链接关系
		// console.log("=== Vault Cleaner 调试信息 ===");
		// console.log("被链接的文件 (inboundLinks):", [...inboundLinks]);
		// console.log("链接出去的文件 (outboundLinks):", [...outboundLinks]);
		// console.log("Canvas 引用的文件:", [...canvasLinks]);
		// console.log("resolvedLinks 原始数据:", this.app.metadataCache.resolvedLinks);

		const orphans = this.app.vault.getFiles().filter(file => {
		return ![
			inboundLinks.has(file.path),   // 被其他文件链接
			outboundLinks.has(file.path),  // 链接了其他文件
			canvasLinks.has(file.path),    // 在 canvas 中被引用
			filter.test(file.path),        // 匹配排除路径模式（如 .obsidian/）
			this.isProtected(file)         // 受保护的文件（如配置文件）
		].some(x => x === true);
		});

		// 从孤立文件中筛选出附件，也就是孤立附件
		const orphanAttachments = orphans.filter(file => this.isAttachment(file));
		// 从孤立文件中筛选出笔记，也就是孤立笔记
		const orphanNotes = orphans.filter(file => file.extension === "md");

		return {
			orphans,
			orphanAttachments,
			orphanNotes
		};
	}
}
