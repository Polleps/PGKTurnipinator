import * as jwt from "jsonwebtoken";
import Config from "./Config";
import * as fs from "fs";

const baseDir = process.cwd();

export class TokenHandler {
  private privateKey: Buffer;

  public async init() {
    await this.loadPrivateKey();
    return;
  }

  public sign(obj): Promise<string> {
    return new Promise((resolve, reject) => {
      jwt.sign(JSON.stringify(obj), this.privateKey, (err, token) => {
        if (err) {
          reject(err);
        }
        resolve(token);
      });
    });
  }

  public verify<T>(token: string): Promise<T> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.privateKey, ())
    });
  }

  private loadPrivateKey(): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.readFile(`${baseDir}/token.key`, (err, data) => {
        if (err) {
          console.log(err);
          reject("Could not read token.key, make sure it exists.");
        }
        this.privateKey = data;
        resolve();
      });
    });
  }
}
