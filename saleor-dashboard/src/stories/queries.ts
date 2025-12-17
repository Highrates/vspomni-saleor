import { gql } from "@apollo/client";

// Временно закомментировано, так как тип Story отсутствует в GraphQL схеме
// Раскомментируйте когда добавите Story в схему Saleor

/*
export const storyFragment = gql`
  fragment Story on Story {
    id
    title
    slug
    image
    order
    isPublished
    publishedAt
    items {
      id
      image
      order
    }
  }
`;

export const storyList = gql`
  ${storyFragment}
  query StoryList(
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    stories(
      before: $before
      after: $after
      first: $first
      last: $last
    ) {
      edges {
        node {
          ...Story
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

export const storyDetails = gql`
  ${storyFragment}
  query StoryDetails($id: ID!) {
    story(id: $id) {
      ...Story
    }
  }
`;
*/

// Временные заглушки для компиляции (Story отсутствует в GraphQL схеме)
// Эти запросы не будут работать функционально, но позволят собрать приложение
// Раскомментируйте оригинальные запросы когда добавите Story в GraphQL схему Saleor

export const storyFragment = gql`
  fragment Story on Shop {
    id
  }
`;

export const storyList = gql`
  query StoryList {
    shop {
      id
    }
  }
`;

export const storyDetails = gql`
  query StoryDetails {
    shop {
      id
    }
  }
`;

