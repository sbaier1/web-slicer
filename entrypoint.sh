#!/bin/bash
set -e

echo "🚀 Starting OrcaWeb Production Multiplatform Container..."
echo "  Architecture: $(uname -m)"
echo "  Slicer Engine: $(which prusa-slicer || which orcaslicer || echo 'Native Python Engine')"

# Start Python OrcaSlicer API Server with Gunicorn WSGI in production
PYTHONPATH=/app/server /app/venv/bin/gunicorn --bind 0.0.0.0:8080 --workers 2 --timeout 300 --access-logfile - server:app &

# Start Nginx in foreground
nginx -g "daemon off;"
