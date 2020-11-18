import { TweetOption } from "./tweet-option.interface";

export interface Poll {
  options: TweetOption[];
  end_datetime: string;
  duration_minutes: string;
}
