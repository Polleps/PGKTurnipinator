export interface IEncryptedUserAccessToken {
  encryptedUserInfo: string;
  userKey: string;
  expires: number;
}

export interface IDecryptedUserAccessToken {
  access_token: string;
  refresh_token: string;
  userKey: string;
  expires: number;
}
