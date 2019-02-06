export default class Config {
  public static readonly CommandPrefix: string = process.env.COMMAND_PREFIX;
  public static readonly TestToken: string = process.env.TOKEN;
  public static readonly BotAdmins: string[] = JSON.parse(process.env.BOT_ADMINS);
  public static readonly EnableWebServer: boolean = (process.env.ENABLE_WEBSERVER === "true");
  public static readonly ServerPort: number = +process.env.SERVERPORT;
  public static readonly AccountRefExpireTime: number = +process.env.ACCOUNT_REF_EXPIRE_TIME;
  public static readonly OAUTH2URI: string = process.env.OAUTH2_URI;
  public static readonly RedirectURI: string = process.env.REDIRECT_URI;
  public static readonly CLIENTID: string = process.env.CLIENT_ID;
  public static readonly CLIENTSECRET: string = process.env.CLIENT_SECRET;
  private constructor() {
  }
}
