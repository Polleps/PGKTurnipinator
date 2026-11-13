// pm2 config for the production bot (see docs/DEPLOY.md).
// Bun runs the TypeScript source directly; there is no build step and no built/.
// pm2 starts non-Node interpreters in fork mode, which is what a single
// gateway bot needs. No `watch`: it restarted the bot halfway through deploys.
module.exports = {
  apps: [{
    name: "bot",
    cwd: __dirname,
    script: "src/bot.ts",
    interpreter: "bun",
    interpreter_args: "--env-file=.env.prod",
    exec_mode: "fork",
    instances: 1,
    watch: false,
    env: {
      NODE_ENV: "production",
    },
  }],
};
