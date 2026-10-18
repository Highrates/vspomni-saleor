export type DashboardPeriodKind = 'today' | 'month' | 'custom';

export type DashboardOverview = {
  period: {
    kind: DashboardPeriodKind;
    from: string;
    to: string;
    fromDate: string;
    toDate: string;
  };
  ordersCount: number;
  revenue: number;
  averageCheck: number;
  newClientsCount: number;
  topProducts: {
    variantId: string | null;
    productId: string | null;
    productName: string;
    productSlug: string | null;
    variantName: string | null;
    sku: string | null;
    imageUrl: string | null;
    qty: number;
    revenue: number;
  }[];
};
