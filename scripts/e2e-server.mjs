import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, request as proxyRequest } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { startProdServer } from "vinext/server/prod-server";

const appPort = 4174;
const testPort = 4173;
const clientDirectory = path.resolve("dist/client");
const contentTypes = new Map([
  [".js", "application/javascript; charset=utf-8"], [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"], [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".png", "image/png"], [".woff", "font/woff"], [".woff2", "font/woff2"],
]);
export async function startE2EServer() {
  const { server: appServer } = await startProdServer({ port: appPort, host: "127.0.0.1", purpose: "e2e" });
  const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(request.url?.split("?")[0] || "/");
  const assetPath = path.resolve(clientDirectory, `.${pathname}`);
  if (assetPath.startsWith(`${clientDirectory}${path.sep}`)) {
    try {
      const asset = await stat(assetPath);
      if (asset.isFile()) {
        const isServiceWorker = pathname === "/sw.js";
        response.writeHead(200, {
          "Content-Type": contentTypes.get(path.extname(assetPath)) || "application/octet-stream",
          "Content-Length": asset.size,
          "Cache-Control": isServiceWorker ? "no-cache" : pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600",
          ...(isServiceWorker ? { "Service-Worker-Allowed": "/" } : {}),
        });
        createReadStream(assetPath).pipe(response);
        return;
      }
    } catch { /* Dynamic routes are proxied to the application server. */ }
  }
  const isOfflineShell = pathname === "/offline-shell";
  const upstream = proxyRequest({
    hostname: "127.0.0.1",
    port: appPort,
    path: isOfflineShell ? "/" : request.url,
    method: request.method,
    headers: request.headers,
  }, upstreamResponse => {
    const headers = { ...upstreamResponse.headers };
    if (isOfflineShell) {
      delete headers.vary;
      headers["cache-control"] = "no-cache";
    }
    response.writeHead(upstreamResponse.statusCode || 500, headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", error => { response.writeHead(502); response.end(error.message); });
  request.pipe(upstream);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(testPort, "127.0.0.1", () => {
      server.off("error", reject);
      console.log(`E2E server ready on http://127.0.0.1:${testPort}`);
      resolve();
    });
  });

  return async function stopE2EServer() {
    server.closeAllConnections?.();
    appServer.closeAllConnections?.();
    await Promise.all([
      new Promise(resolve => server.close(() => resolve())),
      new Promise(resolve => appServer.close(() => resolve())),
    ]);
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const shutdown = await startE2EServer();
  process.on("SIGINT", () => shutdown().finally(() => process.exit(0)));
  process.on("SIGTERM", () => shutdown().finally(() => process.exit(0)));
}
