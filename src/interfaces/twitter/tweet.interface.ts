/* 
Tweet interface definition retrieved from https://developer.twitter.com/en/docs/twitter-api/v1/data-dictionary/overview/tweet-object at 2020-11-18. 
*/

import { Entities } from "./entities.interface";
import { User } from "./user.interface";

export interface Tweet {
  created_at: string;
  id: number;
  id_str: string;
  text: string;
  display_text_range: number[];
  source: string;
  truncated: boolean;
  in_reply_to_status_id: number;
  in_reply_to_status_id_str: string;
  in_reply_to_user_id: number;
  in_reply_to_user_id_str: string;
  in_reply_to_screen_name: string;
  user: User;
  geo: null;
  coordinates: null;
  place: null;
  contributors: null;
  is_quote_status: boolean;
  quote_count: number;
  reply_count: number;
  retweet_count: number;
  favorite_count: number;
  entities: Entities;
  favorited: boolean;
  retweeted: boolean;
  filter_level: string;
  lang: string;
  timestamp_ms: string;
}
