path = "docker-compose.yml"
with open(path) as f:
    content = f.read()

# Add volumes only after first occurrence (api service)
old_media = "      - media_files:/app/media"
new_media = """      - media_files:/app/media
      - ./plugins/yandex_oauth:/app/saleor/plugins/yandex_oauth
      - ./docker-entrypoint-wrapper.sh:/app/docker-entrypoint-wrapper.sh"""
if "./plugins/yandex_oauth" not in content:
    content = content.replace(old_media, new_media, 1)

# Change api entrypoint to wrapper
content = content.replace(
    'entrypoint: ["/app/docker-entrypoint.sh"]',
    'entrypoint: ["/app/docker-entrypoint-wrapper.sh"]',
    1
)

with open(path, "w") as f:
    f.write(content)
print("Patched docker-compose.yml")
