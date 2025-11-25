import { gql } from "@apollo/client";

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

