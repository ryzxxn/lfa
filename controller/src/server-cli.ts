#!/usr/bin/env node

import { APIServer } from "./server";

const port = parseInt(process.env.PORT || "3000");

const server = new APIServer(port);

server.start().then(() => {
  console.log(`\n✨ Ready for requests!\n`);

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n\n👋 Shutting down...");
    await server.stop();
    process.exit(0);
  });
});
