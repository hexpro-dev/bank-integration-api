import fs from "fs";
import type { Browser, Page } from "./types.js";
import { installMainContextHandler, linkContexts, iEvaluate } from "./context-bridge.js";
import { ObserverConfig } from "../config.js";

const puppeteer = require("puppeteer");
const { addExtra } = require("puppeteer-extra");
const puppeteerExtra = addExtra(puppeteer);

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const stealth = StealthPlugin();
stealth.enabledEvasions.delete("user-agent-override");
stealth.enabledEvasions.delete("navigator.languages");
stealth.enabledEvasions.delete("iframe.contentWindow");
stealth.enabledEvasions.delete("media.codecs");
puppeteerExtra.use(stealth);

const UserAgentOverride = require("puppeteer-extra-plugin-stealth/evasions/user-agent-override");
puppeteerExtra.use(
	UserAgentOverride({
		locale: "en-AU",
		userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.env.CHROME_VERSION || "131"}.0.0.0 Safari/537.36`,
		maskLinux: true,
	}),
);

const NavigatorLanguages = require("puppeteer-extra-plugin-stealth/evasions/navigator.languages");
puppeteerExtra.use(
	NavigatorLanguages({
		opts: { languages: ["en-US", "en"] },
	}),
);

class GhostBrowser {
	private config: ObserverConfig;
	private browser: Browser | null = null;
	private linkContextsTimeout: NodeJS.Timeout | null = null;

	constructor(config: ObserverConfig) {
		this.config = config;
	}

	async launch(seatId: string): Promise<Browser> {
		const userDataDir = `${this.config.browserProfilesDir}/${seatId}`;
		fs.mkdirSync(userDataDir, { recursive: true });

		const args = [
			"--window-size=1280,720",
			"--lang=en-AU",
			"--disable-webrtc",
			"--enforce-webrtc-ip-permission-check",
			"--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
			"--webrtc-ip-handling-policy=disable_non_proxied_udp",
			"--disable-features=WebRtcHideLocalIpsWithMdns,WebRTC,PeerConnection",
			"--disable-blink-features=AutomationControlled",
			`--user-data-dir=${userDataDir}`,
			"--no-sandbox",
		];

		this.browser = await puppeteerExtra.launch({
			headless: this.config.headless ? "new" : false,
			args,
			defaultViewport: {
				width: 1280,
				height: 720,
				deviceScaleFactor: 1,
				hasTouch: false,
				isLandscape: true,
				isMobile: false,
			},
		});

		return this.browser!;
	}

	async setupPage(page: Page): Promise<void> {
		await installMainContextHandler(page);

		await page.evaluateOnNewDocument(() => {
			Object.defineProperty(window, "screen", {
				value: {
					availWidth: 1280,
					availHeight: 720,
					width: 1280,
					height: 720,
					colorDepth: 24,
					pixelDepth: 24,
					availLeft: 0,
					availTop: 0,
					orientation: { type: "landscape-primary", angle: 0 },
				},
				configurable: true,
			});

			Object.defineProperty(window, "Screen", {
				value: function () {},
				configurable: true,
			});

			Object.defineProperty(window, "innerWidth", {
				value: 1280,
				configurable: true,
			});
			Object.defineProperty(window, "innerHeight", {
				value: 720,
				configurable: true,
			});
			Object.defineProperty(window, "outerWidth", {
				value: 1280,
				configurable: true,
			});
			Object.defineProperty(window, "outerHeight", {
				value: 720,
				configurable: true,
			});
		});

		const chromeVersion = this.config.chromeVersion;
		await page.evaluateOnNewDocument((version: string) => {
			const originalGetOwnPropertyNames = Object.getOwnPropertyNames;
			Object.getOwnPropertyNames = function (obj) {
				const props = originalGetOwnPropertyNames(obj);
				if (obj === navigator) {
					return props.filter((prop) => prop !== "userAgentData");
				}
				return props;
			};

			if ((navigator as any).userAgentData) {
				class NavigatorUAData {
					brands;
					mobile;
					platform;

					constructor() {
						this.brands = [
							{ brand: "Google Chrome", version },
							{ brand: "Chromium", version },
							{ brand: "Not_A Brand", version: "24" },
						];
						this.mobile = false;
						this.platform = "macOS";
					}

					async getHighEntropyValues(hints: string[]) {
						const values: Record<string, any> = {};
						for (const hint of hints) {
							switch (hint) {
								case "architecture":
									values.architecture = "x86";
									break;
								case "bitness":
									values.bitness = "64";
									break;
								case "model":
									values.model = "";
									break;
								case "platformVersion":
									values.platformVersion = "10_15_7";
									break;
								case "fullVersionList":
									values.fullVersionList = [
										{ brand: "Google Chrome", version },
										{ brand: "Chromium", version },
										{ brand: "Not_A Brand", version: "24" },
									];
									break;
								case "wow64":
									values.wow64 = false;
									break;
							}
						}
						return values;
					}

					toJSON() {
						return {
							brands: this.brands,
							mobile: this.mobile,
							platform: this.platform,
						};
					}
				}

				const uaData = new NavigatorUAData();
				Object.defineProperty(navigator, "userAgentData", uaData);
			}
		}, chromeVersion);

		page.on("load", async () => {
			await this.debouncedLinkContexts(page);
		});

		page.on("domcontentloaded", async () => {
			await this.debouncedLinkContexts(page);
		});

		page.on("framenavigated", async (frame) => {
			if (frame === page.mainFrame()) {
				await this.debouncedLinkContexts(page);
			}
		});

		await this.debouncedLinkContexts(page);
	}

	async createPage(): Promise<Page> {
		if (!this.browser) {
			throw new Error("Browser not launched – call launch() first");
		}
		const page = await this.browser.newPage();
		await this.setupPage(page);
		return page;
	}

	async close(): Promise<void> {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}
	}

	private async debouncedLinkContexts(page: Page): Promise<void> {
		if (this.linkContextsTimeout) {
			clearTimeout(this.linkContextsTimeout);
		}

		return new Promise((resolve) => {
			this.linkContextsTimeout = setTimeout(async () => {
				try {
					await linkContexts(page);
					resolve();
				} catch (error) {
					const msg = error instanceof Error ? error.message : String(error);
					console.log("Debounced linkContexts failed, continuing:", msg);
					resolve();
				}
			}, 100);
		});
	}

	iEvaluate = iEvaluate;
}

export default GhostBrowser;
