import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] ?? "3001";
const requestedPort = Number(rawPort);

if (Number.isNaN(requestedPort) || requestedPort <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function listen(port: number): void {
  const server = app.listen(port);

  server.once("listening", () => {
    logger.info({ port }, "Server listening");
  });

  server.once("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      logger.warn({ port }, "Port in use, trying next port");
      listen(port + 1);
      return;
    }

    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}

listen(requestedPort);
