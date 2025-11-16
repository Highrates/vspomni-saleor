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

WORKDIR /app

RUN apt-get update \
    && apt-get install -y libmagic1 libpq5 libcurl4 libjpeg62-turbo \
    libopenjp2-7 libtiff6 libwebp7 liblcms2-2 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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
