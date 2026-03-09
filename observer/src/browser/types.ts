import type { Browser, Page } from "puppeteer";

export type { Browser, Page };

declare global {
	interface Window {
		evaluateMain: (fn: string | ((...args: any[]) => any)) => Promise<any>;
		evaluateMainAId?: number;
	}
}
