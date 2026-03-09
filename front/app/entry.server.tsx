import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { type HandleDocumentRequestFunction } from "react-router";
import { ServerRouter } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { PassThrough } from "node:stream";

const ABORT_DELAY = 5_000;

const handleRequest: HandleDocumentRequestFunction = (
	request,
	responseStatusCode,
	responseHeaders,
	routerContext,
) => {
	return new Promise((resolve, reject) => {
		let shellRendered = false;
		const userAgent = request.headers.get("user-agent");

		const { pipe, abort } = renderToPipeableStream(
			<ServerRouter context={routerContext} url={request.url} />,
			{
				[isbot(userAgent ?? "") ? "onAllReady" : "onShellReady"]() {
					shellRendered = true;
					const body = new PassThrough();
					const stream = createReadableStreamFromReadable(body);

					responseHeaders.set("Content-Type", "text/html");

					resolve(
						new Response(stream, {
							headers: responseHeaders,
							status: responseStatusCode,
						}),
					);

					pipe(body);
				},
				onShellError(error: unknown) {
					reject(error);
				},
				onError(error: unknown) {
					responseStatusCode = 500;
					if (shellRendered) {
						console.error(error);
					}
				},
			},
		);

		setTimeout(abort, ABORT_DELAY);
	});
};

export default handleRequest;
