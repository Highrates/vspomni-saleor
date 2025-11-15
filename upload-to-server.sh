#!/bin/bash

# Quick script to upload all necessary files to server
# Usage: ./upload-to-server.sh

SERVER="root@91.229.8.83"
REMOTE_PATH="~/Saleor-miraflores"

echo "Uploading files to $SERVER:$REMOTE_PATH"
echo ""

# Upload main files
echo "Uploading docker-compose.yml..."
scp docker-compose.yml $SERVER:$REMOTE_PATH/

echo "Uploading .env..."
scp .env $SERVER:$REMOTE_PATH/

echo "Uploading scripts..."
scp init-letsencrypt.sh $SERVER:$REMOTE_PATH/
scp init-letsencrypt-simple.sh $SERVER:$REMOTE_PATH/

echo "Uploading nginx configs..."
scp nginx/nginx.conf $SERVER:$REMOTE_PATH/nginx/
scp nginx/nginx-ssl.conf $SERVER:$REMOTE_PATH/nginx/

echo "Uploading dashboard env..."
scp saleor-dashboard/.env.production $SERVER:$REMOTE_PATH/saleor-dashboard/

echo ""
echo "✅ All files uploaded!"
echo ""
echo "Next: SSH to server and run:"
echo "  ssh $SERVER"
echo "  cd $REMOTE_PATH"
echo "  ./init-letsencrypt-simple.sh"
