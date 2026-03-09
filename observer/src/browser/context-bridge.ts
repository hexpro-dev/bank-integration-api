import type { Page } from "./types.js";

/**
 * Installs a message handler in the MAIN page context (via evaluateOnNewDocument)
 * that listens for postMessage calls from the isolated CDP context, executes
 * the serialised function, and posts the result back.
 */
export async function installMainContextHandler(page: Page): Promise<void> {
	await page.evaluateOnNewDocument(() => {
		const originalPostMessage = window.postMessage;

		const messageHandler = (event: MessageEvent) => {
			if (!event.data.aId || event.data.fromMain) {
				return;
			}

			const response: Record<string, any> = {
				aId: event.data.aId,
				fromMain: true,
			};

			try {
				const fn = new Function("return " + event.data.aText)();
				response.result = fn();
			} catch (err) {
				response.error = (err as Error).message;
			}

			originalPostMessage.call(
				window,
				JSON.parse(JSON.stringify(response)),
				{ targetOrigin: "*" },
			);
		};

		window.addEventListener("message", messageHandler);
	});
}

/**
 * Bridges the isolated CDP context to the main page context by setting up
 * a CustomEvent relay and exposing `window.evaluateMain()` inside the
 * isolated world so that subsequent `page.evaluate()` calls can dispatch
 * work to the main context.
 */
export async function linkContexts(page: Page): Promise<void> {
	try {
		await page.evaluate(() => {
			window.addEventListener("message", (event) => {
				if (!(event.data.aId && event.data.fromMain)) {
					return;
				}
				window.dispatchEvent(
					new CustomEvent(`aId-${event.data.aId}`, {
						detail: event.data,
					}),
				);
			});

			window.evaluateMain = (scriptFn) => {
				window.evaluateMainAId = (window.evaluateMainAId || 0) + 1;
				const aId = window.evaluateMainAId;

				return new Promise((resolve) => {
					window.addEventListener(
						`aId-${aId}`,
						(event) => {
							resolve((event as CustomEvent).detail);
						},
						{ once: true },
					);

					let aText = scriptFn;
					if (typeof aText !== "string") {
						aText = `(${(aText as Function).toString()})()`;
					}

					window.postMessage({ aId, aText });
				});
			};
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		if (
			msg.includes("Execution context was destroyed") ||
			msg.includes("Target closed") ||
			msg.includes("Session closed")
		) {
			return;
		}
		throw error;
	}
}

/**
 * Evaluates a callback in the MAIN page context via the context bridge,
 * fully evading CDP detection. The callback and its arguments are serialised,
 * sent through `window.evaluateMain` in the isolated context, which posts
 * them to the main context for real execution.
 */
export async function iEvaluate(
	page: Page,
	callback: (...args: any[]) => any,
	...args: any[]
): Promise<any> {
	const callbackStr = callback.toString();

	try {
		return await page.evaluate(
			(fnStr: string, fnArgs: any[]) => {
				const mainContextFunction = `(function() {
					const userFn = (${fnStr});
					return userFn(...${JSON.stringify(fnArgs)});
				})`.trim();
				return window.evaluateMain(mainContextFunction);
			},
			callbackStr,
			args,
		);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		if (
			msg.includes("Execution context was destroyed") ||
			msg.includes("Target closed") ||
			msg.includes("Session closed")
		) {
			await new Promise((r) => setTimeout(r, 500));
			try {
				return await page.evaluate(
					(fnStr: string, fnArgs: any[]) => {
						const mainContextFunction = `(function() {
							const userFn = (${fnStr});
							return userFn(...${JSON.stringify(fnArgs)});
						})`.trim();
						return window.evaluateMain(mainContextFunction);
					},
					callbackStr,
					args,
				);
			} catch (retryError) {
				const retryMsg =
					retryError instanceof Error
						? retryError.message
						: String(retryError);
				return { result: null, error: retryMsg };
			}
		}
		throw error;
	}
}
