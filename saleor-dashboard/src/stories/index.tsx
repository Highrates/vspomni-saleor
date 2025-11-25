import { Route } from "@dashboard/components/Router";
import { sectionNames } from "@dashboard/intl";
import { asSortParams } from "@dashboard/utils/sort";
import { parse as parseQs } from "qs";
import { useIntl } from "react-intl";
import { RouteComponentProps, Switch } from "react-router-dom";

import { WindowTitle } from "../components/WindowTitle";
import {
  storyCreatePath,
  storyListPath,
  StoryListUrlQueryParams,
  StoryListUrlSortField,
  storyPath,
  StoryUrlQueryParams,
} from "./urls";
import StoryListComponent from "./views/StoryList/StoryList";

const StoryList = () => {
  const qs = parseQs(location.search.substr(1)) as any;
  const params: StoryListUrlQueryParams = asSortParams(
    qs,
    StoryListUrlSortField,
    StoryListUrlSortField.title,
  );

  return <StoryListComponent params={params} />;
};

const StoryDetails = ({ match }: RouteComponentProps<{ id: string }>) => {
  const qs = parseQs(location.search.substr(1));
  const params: StoryUrlQueryParams = qs;

  return <div>Story Details: {decodeURIComponent(match.params.id)}</div>;
};

const Component = () => {
  const intl = useIntl();

  return (
    <>
      <WindowTitle title={intl.formatMessage(sectionNames.stories)} />
      <Switch>
        <Route exact path={storyListPath} component={StoryList} />
        <Route exact path={storyCreatePath} component={() => <div>Create Story</div>} />
        <Route path={storyPath(":id")} component={StoryDetails} />
      </Switch>
    </>
  );
};

export default Component;

