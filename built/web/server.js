"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const bodyParser = require("body-parser");
const routers_1 = require("./routers");
class Server {
    constructor(discordClient) {
        this.client = discordClient;
        this.init();
    }
    start(port) {
        return new Promise((resolve, reject) => {
            this.app.listen(port, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    console.log(`Web server running on port: ${port}`);
                    resolve();
                }
            });
        });
    }
    init() {
        this.app = express();
        // support application/json type post data
        this.app.use(bodyParser.json());
        // support application/x-www-form-urlencoded post data
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.setupRoutes();
    }
    setupRoutes() {
        const userRouter = new routers_1.UserRouter();
        this.app.use("/users", userRouter.router);
    }
}
exports.default = Server;
