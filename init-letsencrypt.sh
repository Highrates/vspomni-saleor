#!/bin/bash

# Init script for Let's Encrypt SSL certificate setup
# Run this script ONCE before first deployment with SSL

set -e

# Configuration
DOMAIN="dashboard.miraflores-shop.com"
EMAIL="admin@miraflores-shop.com"
STAGING=0  # Set to 1 for testing with Let's Encrypt staging server

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Let's Encrypt SSL Setup for Saleor${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Domain: ${YELLOW}${DOMAIN}${NC}"
echo -e "Email: ${YELLOW}${EMAIL}${NC}"
echo ""

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose is not installed${NC}"
    exit 1
fi

# Create directories for certbot
echo -e "${GREEN}[1/6]${NC} Creating directories..."
mkdir -p "./certbot/conf"
mkdir -p "./certbot/www"

# Check if certificate already exists
if [ -d "./certbot/conf/live/$DOMAIN" ]; then
    echo -e "${YELLOW}Warning: Certificate for $DOMAIN already exists!${NC}"
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Skipping certificate creation${NC}"
        exit 0
    fi
    echo -e "${GREEN}Removing existing certificate...${NC}"
    rm -rf "./certbot/conf/live/$DOMAIN"
    rm -rf "./certbot/conf/archive/$DOMAIN"
    rm -rf "./certbot/conf/renewal/$DOMAIN.conf"
fi

# Download recommended TLS parameters if not exists
if [ ! -e "./certbot/conf/options-ssl-nginx.conf" ] || [ ! -e "./certbot/conf/ssl-dhparams.pem" ]; then
    echo -e "${GREEN}[2/6]${NC} Downloading recommended TLS parameters..."
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "./certbot/conf/options-ssl-nginx.conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "./certbot/conf/ssl-dhparams.pem"
    echo -e "${GREEN}TLS parameters downloaded${NC}"
fi

# Create dummy certificate for nginx to start
echo -e "${GREEN}[3/6]${NC} Creating dummy certificate for $DOMAIN..."
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
mkdir -p "./certbot/conf/live/$DOMAIN"
docker-compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout '$CERT_PATH/privkey.pem' \
    -out '$CERT_PATH/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo -e "${GREEN}Dummy certificate created${NC}"

# Start nginx with HTTP configuration
echo -e "${GREEN}[4/6]${NC} Starting nginx..."
docker-compose up -d nginx
echo -e "${GREEN}Nginx started${NC}"

# Wait for nginx to start
echo -e "${YELLOW}Waiting for nginx to be ready...${NC}"
sleep 5

# Delete dummy certificate
echo -e "${GREEN}[5/6]${NC} Removing dummy certificate..."
docker-compose run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/$DOMAIN && \
  rm -rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot
echo -e "${GREEN}Dummy certificate removed${NC}"

# Request Let's Encrypt certificate
echo -e "${GREEN}[6/6]${NC} Requesting Let's Encrypt certificate for $DOMAIN..."

# Select appropriate email arg
case "$EMAIL" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $EMAIL" ;;
esac

# Enable staging mode if set
if [ $STAGING != "0" ]; then
    staging_arg="--staging"
    echo -e "${YELLOW}Using Let's Encrypt STAGING server${NC}"
else
    staging_arg=""
    echo -e "${GREEN}Using Let's Encrypt PRODUCTION server${NC}"
fi

# Request certificate
docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    --domains $DOMAIN \
    --rsa-key-size 4096 \
    --agree-tos \
    --force-renewal \
    --non-interactive" certbot

if [ $? -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Certificate successfully obtained!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "1. Update nginx configuration to use SSL"
    echo -e "2. Restart nginx: ${YELLOW}docker-compose restart nginx${NC}"
    echo -e "3. Enable SSL config by renaming:"
    echo -e "   ${YELLOW}nginx/nginx.conf${NC} → ${YELLOW}nginx/nginx-http.conf.backup${NC}"
    echo -e "   ${YELLOW}nginx/nginx-ssl.conf${NC} → ${YELLOW}nginx/nginx.conf${NC}"
    echo -e "4. Reload services: ${YELLOW}docker-compose up -d${NC}"
    echo ""
    echo -e "${GREEN}Certificate will be automatically renewed every 12 hours${NC}"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}Certificate request FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo -e "1. Check DNS: ${YELLOW}nslookup $DOMAIN${NC}"
    echo -e "2. Check port 80 is accessible from internet"
    echo -e "3. Check nginx logs: ${YELLOW}docker-compose logs nginx${NC}"
    echo -e "4. Check certbot logs: ${YELLOW}docker-compose logs certbot${NC}"
    echo ""
    echo -e "You can retry by running this script again"
    exit 1
fi
