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
  public static readonly SMASHGG_API_KEY: string = process.env.SMASHGG_API_KEY;
  public static readonly GUILD_ID: string = process.env.GUILD_ID;
  public static readonly POST_TOURNAMENT_ROLE_NAME: string = process.env.POST_TOURNAMENT_ROLE_NAME;
  public static readonly TOURNAMEN_AGENDA_ID: string = process.env.TOURNAMEN_AGENDA_ID;
  public static readonly SERVERURL: string = process.env.SERVERURL;
  public static readonly PUBLIC_INVITE_LINK: string = process.env.PUBLIC_INVITE_LINK;
  public static readonly BOT_CHANNEL_ID: string = process.env.BOT_CHANNEL_ID;
  public static readonly ENABLE_NEWS_CHANNEL: boolean = (process.env.ENABLE_NEWS_CHANNEL === "true");
  public static readonly TWITTER_CONSUMER_KEY: string = process.env.TWITTER_CONSUMER_KEY;
  public static readonly TWITTER_CONSUMER_KEY_SECRET: string = process.env.TWITTER_CONSUMER_KEY_SECRET;
  public static readonly TWITTER_ACCESS_TOKEN: string = process.env.TWITTER_ACCESS_TOKEN;
  public static readonly TWITTER_ACCESS_TOKEN_SECRET: string = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  public static readonly NEWS_CHANNEL_ID: string = process.env.NEWS_CHANNEL_ID;
  public static readonly COLOR_ROLE_ID: string = process.env.COLOR_ROLE_ID;
  private constructor() {
  }
}
