"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
class UserRouter {
    constructor() {
        this._router = express.Router();
        this.setupRoutes();
    }
    get router() {
        return this._router;
    }
    setupRoutes() {
        this._router.get("/create/:refID", (req, res) => {
            res.send("Hey");
        });
    }
}
exports.UserRouter = UserRouter;
