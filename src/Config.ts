export default class Config {
  public static readonly CommandPrefix: string = process.env.COMMAND_PREFIX;
  public static readonly TestToken: string = process.env.TOKEN;
  public static readonly BotAdmins: string[] = JSON.parse(process.env.BOT_ADMINS);
  public static readonly EnableWebServer: boolean = (process.env.EnableWebServer === "true");
  public static readonly ServerPort: number = +process.env.SERVERPORT;
  public static readonly AccountRefExpireTime: number = +process.env.ACCOUNT_REF_EXPIRE_TIME;
  private constructor() {
  }
}
