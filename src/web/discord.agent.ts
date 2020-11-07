import fetch from "node-fetch";
const baseURL: string = "https://discord.com/api/v6";

export const fetchUserInfo = async (accessToken: string): Promise<IUserInfo> => {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };
  const url = `${baseURL}/users/@me`;
  return fetch(url, { headers }).then((res) => res.json());
};

export interface IUserInfo {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  bot?: boolean;
  mfa_enabled?: boolean;
  locale?: boolean;
  flags: number;
  premium_type?: number;
}
// Authorization
