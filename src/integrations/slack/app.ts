import { App } from "@slack/bolt";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";
import { registerHandlers } from "./handlers.js";

const app = new App({
  token: config.SLACK_BOT_TOKEN,
  appToken: config.SLACK_APP_TOKEN,
  socketMode: true,
});

registerHandlers(app);

async function main() {
  await app.start();
  logger.info("Deep Research V2 Slack bot is running (Socket Mode)");
}

main().catch((err) => {
  logger.fatal(err, "Failed to start Slack bot");
  process.exit(1);
});
