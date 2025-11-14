### BUILD STAGE ###
FROM python:3.12 AS build

WORKDIR /app

COPY pyproject.toml uv.lock /app/

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 UV_SYSTEM_PYTHON=1 UV_PROJECT_ENVIRONMENT=/usr/local

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-install-project --no-editable

### FINAL STAGE ###
FROM python:3.12-slim

RUN groupadd -r saleor && useradd -r -g saleor saleor

# Pillow dependencies and tools for docker-entrypoint.sh
RUN apt-get update \
  && apt-get install -y \
  libffi8 \
  libgdk-pixbuf-2.0-0 \
  liblcms2-2 \
  libopenjp2-7 \
  libssl3 \
  libtiff6 \
  libwebp7 \
  libpq5 \
  libmagic1 \
  # Required by celery[sqs] which uses pycurl for AWS SQS support
  libcurl4 \
  # Required to allows to identify file types when handling file uploads
  media-types \
  # PostgreSQL client for pg_isready command in entrypoint
  postgresql-client \
  # Redis client for redis-cli command in entrypoint
  redis-tools \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/media /app/static \
  && chown -R saleor:saleor /app/

WORKDIR /app

# Copy environment (site-packages) from build stage
COPY --from=build /usr/local/lib/python3.12/site-packages/ /usr/local/lib/python3.12/site-packages/
COPY --from=build /usr/local/bin/ /usr/local/bin/

# Copy application
COPY . /app

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# -------------------------------
# IMPORTANT: run migrations first
# -------------------------------
CMD python3 manage.py migrate --noinput && \
    python3 manage.py collectstatic --noinput && \
    uvicorn saleor.asgi:application \
        --host 0.0.0.0 \
        --port $PORT \
        --lifespan=off \
        --workers=2 \
        --ws=none \
        --no-server-header \
        --no-access-log \
        --timeout-keep-alive=35 \
        --timeout-graceful-shutdown=30 \
        --limit-max-requests=10000
