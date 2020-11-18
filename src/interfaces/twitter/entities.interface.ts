import { Hashtag } from "./hashtag.interface";
import { Media } from "./media.interface";
import { Poll } from "./poll.interface";
import { TweetURL } from "./tweet-url.interface";
import { UserMention } from "./user-mention.interface";

export interface Entities {
  hashtags: Hashtag[];
  urls: TweetURL[];
  user_mentions: UserMention[];
  symbols: symbol[];
  media: Media[];
  polls: Poll[];
}
