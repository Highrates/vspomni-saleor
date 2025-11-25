// @ts-strict-ignore
import { FilterElement } from "@dashboard/components/Filter/types";
import { SearchWithFetchMoreProps } from "@dashboard/giftCards/GiftCardsList/GiftCardListSearchAndFilters/types";
import { SearchPageTypesQuery } from "@dashboard/graphql";
import { ArticleListUrlFilters } from "@dashboard/articles/urls";
import { AutocompleteFilterOpts, FilterOpts } from "@dashboard/types";
import { createFilterTabUtils, getMultipleValueQueryParam } from "@dashboard/utils/filters";
import { mapNodeToChoice, mapSingleValueNodeToChoice } from "@dashboard/utils/maps";

export enum ArticleListFilterKeys {
  pageTypes = "pageTypes",
}

const ARTICLES_FILTERS_KEY = "articlesFilters";

export interface ArticleListFilterOpts {
  pageType: FilterOpts<string[]> & AutocompleteFilterOpts;
}

interface ArticleListFilterOptsProps {
  params: ArticleListUrlFilters;
  pageTypes: Array<SearchPageTypesQuery["search"]["edges"][0]["node"]>;
  pageTypesProps: SearchWithFetchMoreProps;
}

export const getFilterOpts = ({
  params,
  pageTypes,
  pageTypesProps,
}: ArticleListFilterOptsProps): ArticleListFilterOpts => ({
  pageType: {
    active: !!params?.pageTypes,
    value: params?.pageTypes,
    choices: mapNodeToChoice(pageTypes),
    displayValues: mapSingleValueNodeToChoice(pageTypes),
    initialSearch: "",
    hasMore: pageTypesProps.hasMore,
    loading: pageTypesProps.loading,
    onFetchMore: pageTypesProps.onFetchMore,
    onSearchChange: pageTypesProps.onSearchChange,
  },
});

export function getFilterQueryParam(filter: FilterElement<ArticleListFilterKeys>): ArticleListUrlFilters {
  const { name } = filter;
  const { pageTypes } = ArticleListFilterKeys;

  switch (name) {
    case pageTypes:
      return getMultipleValueQueryParam(filter, name);
  }
}

export const storageUtils = createFilterTabUtils<string>(ARTICLES_FILTERS_KEY);

