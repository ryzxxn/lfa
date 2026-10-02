import { defineHandler } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  const name = payload.name || "World";
  return {
    message: `Hello, ${name}!`,
    timestamp: new Date().toISOString(),
  };
});
