import { Client, TextChannel } from "discord.js";
import * as Twit from "twit";

import Config from "./Config";
import { createLogger } from "./utils/logger";

const log = createLogger("NewsStreamer");

export class NewsStreamer {
  private client: Client;
  private twit: Twit;
  private twitterStream: Twit.Stream;

  private following = [
    "491489202",
    "64402084",
    "870368466359812096",
    "1073108891465060352",
  ];

  constructor(client: Client) {
    if (Config.ENABLE_NEWS_CHANNEL) {
      this.client = client;
      this.twit = new Twit({
        consumer_key: Config.TWITTER_CONSUMER_KEY,
        consumer_secret: Config.TWITTER_CONSUMER_KEY_SECRET,
        access_token: Config.TWITTER_ACCESS_TOKEN,
        access_token_secret: Config.TWITTER_ACCESS_TOKEN_SECRET,
      });
      this.setupStream();
    }
  }

  private setupStream() {
    this.twitterStream = this.twit.stream("statuses/filter", { follow: this.following });

    this.twitterStream.on("disconnect", (disconnectReason) => {
      log(disconnectReason);
      this.twitterStream.stop();
      this.setupStream();
    });

    this.twitterStream.on("connected", (res) => {
      log("Connected");
    });

    this.twitterStream.on("tweet", (tweet) => this.onTweet(tweet as Tweet));
  }

  private onTweet(tweet: Tweet) {
    if (this.shouldPost(tweet)) {
      const channel = this.client.channels.get(Config.NEWS_CHANNEL_ID) as TextChannel;
      channel.send(createLink(tweet)).catch((err) => console.error(err));
    }
  }

  private shouldPost(tweet: Tweet): boolean {
    return filters.map((f) => f(tweet)).some(Boolean);
  }
}

const filters = [
  (t) => {
    if (t.user.id_str === "491489202") {
        if (isReply(t)) {
          return false;
        }
        const enities = getEntities(t);
        if (enities.hashtags.some((h) => h.text.toLowerCase() === "smashbrosultimate")) {
            return true;
        }
    }
    return false;
  },
  (t) => {
      if (t.user.id_str === "64402084") {
          if (isReply(t)) {
            return false;
          }
          return true;
      }
      return false;
  },
  (t) => {
      if (t.user.id_str === "870368466359812096") {
          if (isReply(t)) {
            return false;
          }
          const entities = getEntities(t);
          if (entities.hashtags.some((h) => h.text.toLowerCase() === "smashbrosultimate")) {
              return true;
          }
      }
      return false;
  },
  (t) => {
      if (t.user.id_str === "1073108891465060352") {
          if (isReply(t)) {
            return false;
          }
          /\\[Upcoming Event]/g.test(getText(t));
          return true;
      }
      return false;
  },
];

function getEntities(tweet: any) {
  if (tweet.truncated) {
      return tweet.extended_tweet.entities;
  } else {
      return tweet.entities;
  }
}

function getText(tweet: any) {
  if (tweet.truncated) {
      return tweet.extended_tweet.full_text;
  } else {
      return tweet.text;
  }
}

function createLink(tweet: any) {
  return `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`;
}

function isReply(tweet) {
  return !!tweet.in_reply_to_status_id;
}

type Tweet = Twit.Twitter.Status;
