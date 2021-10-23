module.exports = {
  "apps" : [{
    "name"        : "bot",
    "script"      : "./built/bot.js",
    "watch"       : true,
    "env_development": {
      "NODE_ENV": "development"
    },
    "env" : {
       "NODE_ENV": "production"
    }
  }]
}
