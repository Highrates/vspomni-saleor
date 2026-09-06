import { gql } from "@apollo/client";

export const welcomePageActivities = gql`
  query WelcomePageActivities($hasPermissionToManageOrders: Boolean!) {
    activities: homepageEvents(last: 10) @include(if: $hasPermissionToManageOrders) {
      edges {
        node {
          ...Activities
        }
      }
    }
  }
`;

export const welcomePageAnalytics = gql`
  query WelcomePageAnalytics($channel: String!, $hasPermissionToManageOrders: Boolean!) {
    salesToday: ordersTotal(period: TODAY, channel: $channel)
      @include(if: $hasPermissionToManageOrders) {
      gross {
        amount
        currency
      }
    }
  }
`;

export const welcomePageNotifications = gql`
  query welcomePageNotifications($channel: String!) {
    productsOutOfStock: products(filter: { stockAvailability: OUT_OF_STOCK }, channel: $channel) {
      totalCount
    }
  }
`;

export const topProductSales = gql`
  query TopProductSales($period: ReportingPeriod!, $channel: String!) {
    reportProductSales(period: $period, first: 5, channel: $channel) {
      edges {
        node {
          id
          name
          sku
          quantityOrdered
          revenue(period: $period) {
            gross {
              amount
              currency
            }
          }
          product {
            id
            name
            thumbnail {
              url
            }
          }
        }
      }
    }
  }
`;

export const complexDashboardStats = gql`
  query ComplexDashboardStats(
    $period: ReportingPeriod!
    $channel: String!
    $ordersCreatedGte: Date!
    $customersJoinedGte: Date!
  ) {
    ordersTotal(period: $period, channel: $channel) {
      gross {
        amount
        currency
      }
    }

    orders(
      first: 0
      channel: $channel
      filter: { created: { gte: $ordersCreatedGte } }
    ) {
      totalCount
    }

    customers(first: 0, filter: { dateJoined: { gte: $customersJoinedGte } }) {
      totalCount
    }
  }
`;
