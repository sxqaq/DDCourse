import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, request as proxyRequest } from "node:http";
import path from "node:path";
import { startProdServer } from "../node_modules/vinext/dist/server/prod-server.js";

const appPort = 4174;
const testPort = 4173;
const clientDirectory = path.resolve("dist/client");
const contentTypes = new Map([
  [".js", "application/javascript; charset=utf-8"], [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"], [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".png", "image/png"], [".woff", "font/woff"], [".woff2", "font/woff2"],
]);
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
  const upstream = proxyRequest({
    hostname: "127.0.0.1",
    port: appPort,
    path: request.url,
    method: request.method,
    headers: request.headers,
  }, upstreamResponse => {
    response.writeHead(upstreamResponse.statusCode || 500, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", error => { response.writeHead(502); response.end(error.message); });
  request.pipe(upstream);
});

server.listen(testPort, "127.0.0.1", () => console.log(`E2E server ready on http://127.0.0.1:${testPort}`));

function shutdown() {
  server.closeAllConnections?.();
  appServer.closeAllConnections?.();
  server.close();
  appServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
