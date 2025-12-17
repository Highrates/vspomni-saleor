import { useOrderDetailsWithMetadataQuery } from "@dashboard/graphql";
import { useHasManageProductsPermission } from "@dashboard/orders/hooks/useHasManageProductsPermission";

export const useOrderDetails = (id: string) => {
  const hasManageProducts = useHasManageProductsPermission();
  const { data, loading } = useOrderDetailsWithMetadataQuery({
    displayLoader: true,
    variables: { id, hasManageProducts },
    // Prevent automatic polling/refetching to stop infinite loops
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    // Disable automatic refetch on window focus to prevent loops
    notifyOnNetworkStatusChange: false,
  });

  return {
    data,
    loading,
  };
};
