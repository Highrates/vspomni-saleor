import { stringifyQs } from "@dashboard/utils/urls";
import urlJoin from "url-join";

import {
  ActiveTab,
  BulkAction,
  Dialog,
  Filters,
  FiltersWithMultipleValues,
  Pagination,
  SingleAction,
  Sort,
  TabActionDialog,
} from "../types";

export const articlesSection = "/articles/";

export const articleListPath = articlesSection;
export type ArticleListUrlDialog =
  | "publish"
  | "unpublish"
  | "remove"
  | "create-page"
  | TabActionDialog;
export enum ArticleListUrlSortField {
  title = "title",
  slug = "slug",
  contentType = "contentType",
  visible = "visible",
}

enum ArticleListUrlFiltersEnum {
  query = "query",
}

enum ArticleListUrlFiltersWithMultipleValues {
  pageTypes = "pageTypes",
}

export type ArticleListUrlFilters = Filters<ArticleListUrlFiltersEnum> &
  FiltersWithMultipleValues<ArticleListUrlFiltersWithMultipleValues>;
type ArticleListUrlSort = Sort<ArticleListUrlSortField>;
export type ArticleListUrlQueryParams = BulkAction &
  ArticleListUrlFilters &
  Dialog<ArticleListUrlDialog> &
  ArticleListUrlSort &
  Pagination &
  ActiveTab;
export const articleListUrl = (params?: ArticleListUrlQueryParams) =>
  articleListPath + "?" + stringifyQs(params);

export const articlePath = (id: string) => urlJoin(articlesSection, id);
type ArticleUrlDialog = "remove" | "assign-attribute-value";
interface ArticleCreateUrlPageType {
  "page-type-id"?: string;
}
export type ArticleUrlQueryParams = Dialog<ArticleUrlDialog> & SingleAction;
export type ArticleCreateUrlQueryParams = Dialog<ArticleUrlDialog> & SingleAction & ArticleCreateUrlPageType;
export const articleUrl = (id: string, params?: ArticleUrlQueryParams) =>
  articlePath(encodeURIComponent(id)) + "?" + stringifyQs(params);

export const articleCreatePath = urlJoin(articlesSection, "add");
export const articleCreateUrl = (params?: ArticleCreateUrlQueryParams) =>
  articleCreatePath + "?" + stringifyQs(params);

