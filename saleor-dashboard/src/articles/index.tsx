import { ConditionalPageFilterProvider } from "@dashboard/components/ConditionalFilter";
import { Route } from "@dashboard/components/Router";
import { sectionNames } from "@dashboard/intl";
import { asSortParams } from "@dashboard/utils/sort";
import { parse as parseQs } from "qs";
import { useIntl } from "react-intl";
import { RouteComponentProps, Switch } from "react-router-dom";

import { WindowTitle } from "../components/WindowTitle";
import {
  articleCreatePath,
  ArticleCreateUrlQueryParams,
  articleListPath,
  ArticleListUrlQueryParams,
  ArticleListUrlSortField,
  articlePath,
  ArticleUrlQueryParams,
} from "./urls";
import PageCreateComponent from "../modeling/views/PageCreate";
import PageDetailsComponent from "../modeling/views/PageDetails";
import ArticleListComponent from "./views/ArticleList/ArticleList";

const ArticleList = () => {
  const qs = parseQs(location.search.substr(1)) as any;
  const params: ArticleListUrlQueryParams = asSortParams(
    qs,
    ArticleListUrlSortField,
    ArticleListUrlSortField.title,
  );

  return (
    <ConditionalPageFilterProvider locationSearch={location.search}>
      <ArticleListComponent params={params} />
    </ConditionalPageFilterProvider>
  );
};
const ArticleCreate = ({ match }: RouteComponentProps<{ id: string }>) => {
  const qs = parseQs(location.search.substr(1));
  const params: ArticleCreateUrlQueryParams = qs;

  return <PageCreateComponent id={decodeURIComponent(match.params.id)} params={params} />;
};
const ArticleDetails = ({ match }: RouteComponentProps<{ id: string }>) => {
  const qs = parseQs(location.search.substr(1));
  const params: ArticleUrlQueryParams = qs;

  return <PageDetailsComponent id={decodeURIComponent(match.params.id)} params={params} />;
};
const Component = () => {
  const intl = useIntl();

  return (
    <>
      <WindowTitle title={intl.formatMessage(sectionNames.articles)} />
      <Switch>
        <Route exact path={articleListPath} component={ArticleList} />
        <Route exact path={articleCreatePath} component={ArticleCreate} />
        <Route path={articlePath(":id")} component={ArticleDetails} />
      </Switch>
    </>
  );
};

export default Component;

