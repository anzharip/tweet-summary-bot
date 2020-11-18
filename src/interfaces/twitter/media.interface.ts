import { MediaSize } from "./media-size.interface";

export interface Media {
  display_url: string;
  expanded_url: string;
  id: number;
  id_str: string;
  indices: number[];
  media_url: string;
  media_url_https: string;
  sizes: MediaSize;
  source_status_id: number;
  source_status_id_str: string;
  type: string;
  url: string;
}
