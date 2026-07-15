import { startE2EServer } from "./e2e-server.mjs";

export default async function globalSetup() {
  return await startE2EServer();
}
