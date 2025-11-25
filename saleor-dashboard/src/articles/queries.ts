import { gql } from "@apollo/client";

import { pageDetailsFragment, pageFragment } from "../fragments/pages";

export const articleList = gql`
  ${pageFragment}
  query ArticleList(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $sort: PageSortingInput
    $filter: PageFilterInput
  ) {
    pages(
      before: $before
      after: $after
      first: $first
      last: $last
      sortBy: $sort
      filter: $filter
    ) {
      edges {
        node {
          ...Page
        }
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
`;

export const articleDetails = gql`
  ${pageDetailsFragment}
  query ArticleDetails(
    $id: ID!
    $firstValues: Int
    $afterValues: String
    $lastValues: Int
    $beforeValues: String
  ) {
    page(id: $id) {
      ...PageDetails
    }
  }
`;

