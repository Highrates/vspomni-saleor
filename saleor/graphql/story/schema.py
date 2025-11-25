import graphene

from ..core import ResolveInfo
from ..core.connection import create_connection_slice, filter_connection_queryset
from ..core.fields import BaseField, FilterConnectionField
from .resolvers import resolve_stories, resolve_story
from .types import Story, StoryCountableConnection


class StoryQueries(graphene.ObjectType):
    story = BaseField(
        Story,
        id=graphene.Argument(graphene.ID, description="ID of the story.", required=True),
        description="Look up a story by ID.",
    )
    stories = FilterConnectionField(
        StoryCountableConnection,
        description="List of published stories.",
    )

    @staticmethod
    def resolve_story(_root, info: ResolveInfo, *, id):
        return resolve_story(info, id)

    @staticmethod
    def resolve_stories(_root, info: ResolveInfo, **kwargs):
        qs = resolve_stories(info)
        return create_connection_slice(qs, info, kwargs, StoryCountableConnection)

