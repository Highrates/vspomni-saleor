import { useOrderDetailsWithMetadataQuery } from "@dashboard/graphql";
import { useHasManageProductsPermission } from "@dashboard/orders/hooks/useHasManageProductsPermission";
import { useRef, useCallback } from "react";

export const useOrderDetails = (id: string) => {
  const hasManageProducts = useHasManageProductsPermission();
  const lastFetchTime = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 2000; // Minimum 2 seconds between fetches
  
  const { data, loading, refetch: originalRefetch } = useOrderDetailsWithMetadataQuery({
    displayLoader: true,
    variables: { id, hasManageProducts },
    // Use cache-first to prevent unnecessary network requests
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
    // Disable automatic refetch on window focus to prevent loops
    notifyOnNetworkStatusChange: false,
    // Disable automatic refetch on reconnect
    refetchOnReconnect: false,
    // Disable automatic refetch on mount if we have cached data
    refetchOnMount: false,
  });

  // Prevent rapid successive refetches
  const safeRefetch = useCallback(() => {
    const now = Date.now();
    if (now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
      // Return cached data instead of making a new request
      return Promise.resolve({ data });
    }
    lastFetchTime.current = now;
    return originalRefetch();
  }, [originalRefetch, data]);

  return {
    data,
    loading,
    refetch: safeRefetch,
  };
};
