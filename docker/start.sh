#!/bin/sh

set -euo pipefail

echo "Starting Documenso application..."

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy --schema ../../packages/prisma/schema.prisma

# Log data retention configuration
if [ "${NEXT_PRIVATE_DATA_RETENTION_ENABLED:-false}" = "true" ]; then
  echo "Data retention is enabled (${NEXT_PRIVATE_DATA_RETENTION_DAYS:-90} days retention)"
  echo "Data retention scheduler will start automatically with the application"
else
  echo "Data retention is disabled"
fi

# Start the application - data retention scheduler starts automatically via server integration
echo "Starting the application..."
exec env HOSTNAME=0.0.0.0 node build/server/main.js
