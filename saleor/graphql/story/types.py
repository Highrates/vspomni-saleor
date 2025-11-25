import graphene

from ...story import models
from ..core.types import ModelObjectType, NonNullList


class StoryItem(graphene.ObjectType):
    id = graphene.GlobalID(required=True)
    image = graphene.String(required=True, description="Story item image URL")
    order = graphene.Int(required=True)


class Story(ModelObjectType[models.Story]):
    id = graphene.GlobalID(required=True)
    title = graphene.String(required=True)
    slug = graphene.String(required=True)
    image = graphene.String(description="Preview image URL")
    order = graphene.Int(required=True)
    is_published = graphene.Boolean(required=True)
    published_at = graphene.DateTime()
    items = NonNullList(StoryItem, required=True, description="Story items")

    class Meta:
        model = models.Story
        description = "Represents a story group."

    @staticmethod
    def resolve_items(root: models.Story, _info):
        return root.items.all().order_by("order")


class StoryCountableConnection(graphene.relay.Connection):
    class Meta:
        node = Story

