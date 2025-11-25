// @ts-strict-ignore
import { PageSortField } from "@dashboard/graphql";
import { ArticleListUrlSortField } from "@dashboard/articles/urls";
import { createGetSortQueryVariables } from "@dashboard/utils/sort";

function getSortQueryField(sort: ArticleListUrlSortField): PageSortField {
  switch (sort) {
    case ArticleListUrlSortField.title:
      return PageSortField.TITLE;
    case ArticleListUrlSortField.visible:
      return PageSortField.VISIBILITY;
    case ArticleListUrlSortField.slug:
      return PageSortField.SLUG;
    case ArticleListUrlSortField.contentType:
      // Content type sorting is not supported by the GraphQL API
      return undefined;
    default:
      return undefined;
  }
}

export const getSortQueryVariables = createGetSortQueryVariables(getSortQueryField);

