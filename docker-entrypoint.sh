#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Saleor initialization...${NC}"

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}Waiting for PostgreSQL...${NC}"
while ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done
echo -e "${GREEN}PostgreSQL is ready!${NC}"

# Wait for Redis to be ready
echo -e "${YELLOW}Waiting for Redis...${NC}"
while ! redis-cli -h $REDIS_HOST -p $REDIS_PORT ping > /dev/null 2>&1; do
  echo "Redis is unavailable - sleeping"
  sleep 1
done
echo -e "${GREEN}Redis is ready!${NC}"

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
python manage.py migrate --noinput

# Collect static files
echo -e "${YELLOW}Collecting static files...${NC}"
python manage.py collectstatic --noinput --clear

# Create default channel if it doesn't exist
echo -e "${YELLOW}Setting up default channel...${NC}"
python manage.py create_channel || echo "Channel already exists or skipped"

# Populate database with sample data (only in development)
if [ "$DEBUG" = "True" ]; then
  echo -e "${YELLOW}Populating database with sample data...${NC}"
  python manage.py populatedb --createsuperuser || echo "Database already populated"
fi

echo -e "${GREEN}Initialization complete!${NC}"
echo -e "${GREEN}Starting Saleor API server...${NC}"

# Execute the main command
exec "$@"
