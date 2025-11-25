from ...story import models
from ..core.context import get_database_connection_name
from ..core.utils import from_global_id_or_error
from .types import Story


def resolve_stories(info):
    return models.Story.objects.using(
        get_database_connection_name(info.context)
    ).published()


def resolve_story(info, id):
    _, story_pk = from_global_id_or_error(id, Story)
    return models.Story.objects.using(
        get_database_connection_name(info.context)
    ).published().filter(pk=story_pk).first()

