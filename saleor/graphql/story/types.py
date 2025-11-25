import graphene

from ...story import models
from ..core.scalars import DateTime
from ..core.types import ModelObjectType, NonNullList
from ..core.utils import from_global_id_or_error


class StoryImage(graphene.ObjectType):
    id = graphene.GlobalID(required=True)
    image = graphene.String(required=True, description="Story image URL")
    order = graphene.Int(required=True)

    @staticmethod
    def resolve_id(root: models.StoryItem, _info):
        return graphene.Node.to_global_id("StoryImage", root.pk)


class Story(ModelObjectType[models.Story]):
    id = graphene.GlobalID(required=True)
    title = graphene.String(required=True)
    slug = graphene.String(required=True)
    image = graphene.String(description="Preview image URL")
    order = graphene.Int(required=True)
    is_published = graphene.Boolean(required=True)
    published_at = DateTime(description="The story publication date.")
    items = NonNullList(StoryImage, required=True, description="Story images")

    class Meta:
        model = models.Story
        description = "Represents a story group."

    @staticmethod
    def resolve_items(root: models.Story, _info):
        return root.items.all().order_by("order")


class StoryCountableConnection(graphene.relay.Connection):
    class Meta:
        node = Story

