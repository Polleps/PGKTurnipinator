import fetch from "node-fetch";
import * as jwt from "jsonwebtoken";
import Config from "../../Config";
import * as fs from "fs";

const APIURL = "https://discordapp.com/api/v6";
const TOKENURL = "/oauth2/token";
let tokenKey: Buffer | undefined;

export const fetchUserToken = async (code: string): Promise<ITokenRespose> => {
  const body = {
    client_id: Config.CLIENTID,
    client_secret: Config.CLIENTSECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: Config.RedirectURI,
    scope: "identify",
  };
  const urlencoded = new URLSearchParams();
  Object.keys(body).forEach((key) => urlencoded.append(key, body[key]));
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  return fetch(APIURL + TOKENURL, {
    method: "POST",
    headers,
    body: urlencoded,
  }).then((res) => res.json());
};

export const verifyActionRequest = async (token: string): Promise<IDecodedToken> => {
  if (!tokenKey) {
    tokenKey = await loadPrivateKey();
  }
  return pJWTVerify(token, tokenKey);
};

function loadPrivateKey(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fs.readFile("../../../token.key", (err, data) => {
      if (err) {
        throw new Error("Could not read token.key, make sure it exists.");
      }
      resolve(data);
    });
  });
}

export const pJWTVerify = (token: string, secret: Buffer): Promise<IDecodedToken> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err: Error | string, data: IDecodedToken) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

interface IDecodedToken {
  accesstoken: string;
  refreshtoken: string;
  accesstokenExpireDate: Date;

}
interface ITokenRespose {
  access_token: string;
  token_type: string;
  expires_in: Date;
  refresh_token: string;
  scope: string;
}
