import fetch from "node-fetch";
const baseURL: string = "https://discord.com/api/v10";

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
  /** "0" for accounts migrated to unique usernames. */
  discriminator: string;
  global_name?: string | null;
  avatar?: string;
  bot?: boolean;
  mfa_enabled?: boolean;
  locale?: string;
  flags: number;
  premium_type?: number;
}
// Authorization
