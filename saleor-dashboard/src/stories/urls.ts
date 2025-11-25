import { stringifyQs } from "@dashboard/utils/urls";
import urlJoin from "url-join";

import {
  ActiveTab,
  BulkAction,
  Dialog,
  Filters,
  Pagination,
  SingleAction,
  Sort,
} from "../modeling/types";

export const storiesSection = "/stories/";

export const storyListPath = storiesSection;
export type StoryListUrlDialog = "publish" | "unpublish" | "remove";
export enum StoryListUrlSortField {
  title = "title",
  slug = "slug",
  order = "order",
}

export type StoryListUrlFilters = Filters<never>;
type StoryListUrlSort = Sort<StoryListUrlSortField>;
export type StoryListUrlQueryParams = BulkAction &
  StoryListUrlFilters &
  Dialog<StoryListUrlDialog> &
  StoryListUrlSort &
  Pagination &
  ActiveTab;
export const storyListUrl = (params?: StoryListUrlQueryParams) =>
  storyListPath + "?" + stringifyQs(params);

export const storyPath = (id: string) => urlJoin(storiesSection, id);
type StoryUrlDialog = "remove";
export type StoryUrlQueryParams = Dialog<StoryUrlDialog> & SingleAction;
export const storyUrl = (id: string, params?: StoryUrlQueryParams) =>
  storyPath(encodeURIComponent(id)) + "?" + stringifyQs(params);

export const storyCreatePath = urlJoin(storiesSection, "add");
export const storyCreateUrl = (params?: StoryUrlQueryParams) =>
  storyCreatePath + "?" + stringifyQs(params);

