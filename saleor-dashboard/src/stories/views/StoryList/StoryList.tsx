import ActionDialog from "@dashboard/components/ActionDialog";
import DeleteFilterTabDialog from "@dashboard/components/DeleteFilterTabDialog";
import SaveFilterTabDialog from "@dashboard/components/SaveFilterTabDialog";
import { DEFAULT_INITIAL_SEARCH_DATA } from "@dashboard/config";
import { useQuery } from "@apollo/client";
import { storyList } from "../../queries";
import useListSettings from "@dashboard/hooks/useListSettings";
import useNavigator from "@dashboard/hooks/useNavigator";
import useNotifier from "@dashboard/hooks/useNotifier";
import { usePaginationReset } from "@dashboard/hooks/usePaginationReset";
import usePaginator, {
  createPaginationState,
  PaginatorContext,
} from "@dashboard/hooks/usePaginator";
import { useRowSelection } from "@dashboard/hooks/useRowSelection";
import { ListViews } from "@dashboard/types";
import createDialogActionHandlers from "@dashboard/utils/handlers/dialogActionHandlers";
import createSortHandler from "@dashboard/utils/handlers/sortHandler";
import { mapEdgesToItems } from "@dashboard/utils/maps";
import { getSortParams } from "@dashboard/utils/sort";
import { useCallback, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { storyListUrl, StoryListUrlDialog, StoryListUrlQueryParams } from "../../urls";
import { getSortQueryVariables } from "./sort";

interface StoryListProps {
  params: StoryListUrlQueryParams;
}

const StoryList = ({ params }: StoryListProps) => {
  const navigate = useNavigator();
  const notify = useNotifier();
  const intl = useIntl();
  const { updateListSettings, settings } = useListSettings(ListViews.PAGES_LIST);

  usePaginationReset(storyListUrl, params, settings.rowNumber);

  const {
    clearRowSelection,
    selectedRowIds,
    setClearDatagridRowSelectionCallback,
    setSelectedRowIds,
  } = useRowSelection(params);

  const paginationState = createPaginationState(settings.rowNumber, params);
  const queryVariables = useMemo(
    () => ({
      ...paginationState,
      ...getSortQueryVariables(),
    }),
    [paginationState],
  );

  // Временно отключено - Story отсутствует в GraphQL схеме
  // const { data, loading, refetch } = useQuery(storyList, {
  //   variables: queryVariables,
  // });
  // const stories = mapEdgesToItems(data?.stories);
  
  const data = null;
  const loading = false;
  const refetch = () => Promise.resolve({});
  const stories: any[] = [];

  const [openDialog, closeDialog] = createDialogActionHandlers<
    StoryListUrlDialog,
    StoryListUrlQueryParams
  >(navigate, storyListUrl, params);

  const handleSort = createSortHandler(navigate, storyListUrl, params);

  return (
    <PaginatorContext.Provider value={usePaginator(stories, paginationState, navigate, storyListUrl, params)}>
      <div>
        <FormattedMessage
          id="stories.list.title"
          defaultMessage="Stories"
          description="header"
        />
        {stories?.map((story) => (
          <div key={story.id}>
            {story.title} - {story.isPublished ? "Published" : "Draft"}
          </div>
        ))}
      </div>
    </PaginatorContext.Provider>
  );
};

export default StoryList;

