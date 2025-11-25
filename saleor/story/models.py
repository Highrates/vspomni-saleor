from django.db import models

from ..core.models import ModelWithMetadata, PublishableModel, PublishedQuerySet


class StoryQueryset(PublishedQuerySet):
    pass


StoryManager = models.Manager.from_queryset(StoryQueryset)


class Story(ModelWithMetadata, PublishableModel):
    title = models.CharField(max_length=250)
    slug = models.SlugField(unique=True, max_length=255)
    image = models.URLField(blank=True, null=True, help_text="Preview image URL")
    order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = StoryManager()

    class Meta(ModelWithMetadata.Meta):
        ordering = ("order", "created_at")
        verbose_name = "Story"
        verbose_name_plural = "Stories"

    def __str__(self):
        return self.title


class StoryItem(models.Model):
    story = models.ForeignKey(
        Story, related_name="items", on_delete=models.CASCADE
    )
    image = models.URLField(help_text="Story image URL")
    order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("order", "created_at")
        unique_together = (("story", "order"),)

    def __str__(self):
        return f"{self.story.title} - Item {self.order}"

