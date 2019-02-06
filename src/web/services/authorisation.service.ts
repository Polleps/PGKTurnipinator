import fetch from "node-fetch";
import Config from "../../Config";

const APIURL = "https://discordapp.com/api/v6";
const TOKENURL = "/oauth2/token";
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

interface ITokenRespose {
  access_token: string;
  token_type: string;
  expires_in: Date;
  refresh_token: string;
  scope: string;
}
