"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const typegoose_1 = require("typegoose");
const Config_1 = require("../Config");
class AccountRef extends typegoose_1.Typegoose {
    get expired() {
        return (Date.now() - this.createdAt.getTime()) > Config_1.default.AccountRefExpireTime;
    }
}
__decorate([
    typegoose_1.prop({ required: true, unique: true }),
    __metadata("design:type", String)
], AccountRef.prototype, "refLink", void 0);
__decorate([
    typegoose_1.prop({ required: true }),
    __metadata("design:type", String)
], AccountRef.prototype, "discordID", void 0);
__decorate([
    typegoose_1.prop({ required: true, default: Date.now() }),
    __metadata("design:type", Date)
], AccountRef.prototype, "createdAt", void 0);
__decorate([
    typegoose_1.prop(),
    __metadata("design:type", Boolean),
    __metadata("design:paramtypes", [])
], AccountRef.prototype, "expired", null);
exports.AccountRef = AccountRef;
