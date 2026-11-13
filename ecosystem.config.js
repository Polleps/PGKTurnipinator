// pm2 config for the production bot.
// Bun runs the TypeScript source directly; there is no build step and no built/.
// pm2 starts non-Node interpreters in fork mode, which is what a single
// gateway bot needs. No `watch`: it restarted the bot halfway through deploys.
const os = require("os");
const path = require("path");

// Absolute path to bun, resolved when pm2 reads this file: the PATH that
// `pm2 startup`'s systemd unit froze at creation time may not contain ~/.bun/bin
// after a reboot. Override with BUN_PATH if bun lives elsewhere.
const bun = process.env.BUN_PATH || path.join(os.homedir(), ".bun", "bin", "bun");

module.exports = {
  apps: [{
    name: "bot",
    cwd: __dirname,
    script: "src/bot.ts",
    interpreter: bun,
    // src/env.ts loads .env.prod (NODE_ENV=production) with dotenv semantics.
    interpreter_args: "--no-env-file",
    exec_mode: "fork",
    instances: 1,
    watch: false,
    env: {
      NODE_ENV: "production",
    },
  }],
};
