/**
 * Reads an env var typed as always-present, matching how Config has always been used.
 * Not validated here (a missing var is still `undefined` at runtime); proper
 * validation belongs with the config rework in a later phase.
 */
const env = (name: string): string => process.env[name] as string;

export default class Config {
  public static readonly DiscordApplicationToken: string = env("TOKEN");
  public static readonly EnableWebServer: boolean = (env("ENABLE_WEBSERVER") === "true");
  public static readonly ServerPort: number = +env("SERVERPORT");
  public static readonly AccountRefExpireTime: number = +env("ACCOUNT_REF_EXPIRE_TIME");
  public static readonly OAUTH2URI: string = env("OAUTH2_URI");
  public static readonly RedirectURI: string = env("REDIRECT_URI");
  public static readonly CLIENTID: string = env("CLIENT_ID");
  public static readonly CLIENTSECRET: string = env("CLIENT_SECRET");
  public static readonly SMASHGG_API_KEY: string = env("SMASHGG_API_KEY");
  public static readonly GUILD_ID: string = env("GUILD_ID");
  public static readonly POST_TOURNAMENT_ROLE_NAME: string = env("POST_TOURNAMENT_ROLE_NAME");
  public static readonly TOURNAMENT_AGENDA_ID: string = env("TOURNAMENT_AGENDA_ID");
  public static readonly ONLINE_TOURNAMENT_AGENDA_ID: string = env("ONLINE_TOURNAMENT_AGENDA_ID");
  public static readonly SERVERURL: string = env("SERVERURL");
  public static readonly PUBLIC_INVITE_LINK: string = env("PUBLIC_INVITE_LINK");
  public static readonly TOURNAMENT_COLLECTION_NAME: string = env("TOURNAMENT_COLLECTION_NAME");
  public static readonly NEE_ROLE_IDS: string[] = JSON.parse(env("NEE_ROLE_IDS"));
  private constructor() {}
}
