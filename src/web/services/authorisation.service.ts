import fetch from "node-fetch";
import * as jwt from "jsonwebtoken";
import Config from "../../Config";
import * as fs from "fs";

const APIURL = "https://discordapp.com/api/v6";
const TOKENURL = "/oauth2/token";
const baseDir = process.cwd();
let tokenKey: Buffer | undefined;

export const fetchUserToken = async (code: string): Promise<ITokenRespose> => {
  // TODO: State checking in token request.
  const body = {
    client_id: Config.CLIENTID,
    client_secret: Config.CLIENTSECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: Config.RedirectURI,
    scope: "identify",
  };
  return callTokenEndpoint(body);
};

export const refreshUserToken = async (refresh_token: string): Promise<ITokenRespose> => {
  // TODO: State checking in token request.
  const body = {
    client_id: Config.CLIENTID,
    client_secret: Config.CLIENTSECRET,
    grant_type: "refresh_token",
    refresh_token,
    redirect_uri: Config.RedirectURI,
    scope: "identify",
  };
  return callTokenEndpoint(body);
};

export const verifyActionRequest = async (token: string): Promise<IDecodedToken> => {
  if (!tokenKey) {
    tokenKey = await loadPrivateKey();
  }
  return pJWTVerify(token, tokenKey);
};

export const encodeToken = async (data: ITokenRespose) => {
  if (!tokenKey) {
    tokenKey = await loadPrivateKey();
  }
  const { access_token, refresh_token, expires_in } = data;
  const tokenData = { access_token, refresh_token, expires: Date.now() + (expires_in * 1000) };
  // const tokenData = { access_token, refresh_token, expires: Date.now() + (1 * 1000) };

  return pJWTSign(JSON.stringify(tokenData), tokenKey);
};

export const pJWTVerify = (token: string, secret: Buffer): Promise<IDecodedToken> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err: Error | string, data: IDecodedToken) => {
      if (err) {
        reject(err);
      } else {
        console.log("DATA", data);
        resolve(data);
      }
    });
  });
};

const pJWTSign = (payload: string, key: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    jwt.sign(payload, key, (err, token) => {
      if (err) {
        reject(err);
      }
      resolve(token);
    });
  });
};

function loadPrivateKey(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fs.readFile(`${baseDir}/token.key`, (err, data) => {
      if (err) {
        console.log(err);
        throw new Error("Could not read token.key, make sure it exists.");
      }
      resolve(data);
    });
  });
}

const callTokenEndpoint = async (body) => {
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

interface IDecodedToken {
  access_token: string;
  refresh_token: string;
  expires: number;
}

interface ITokenRespose {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}
