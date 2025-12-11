#!/bin/sh
# Substitute the BACKEND_URL variable into the template file
envsubst '$$BACKEND_URL' < /etc/nginx/nginx.template.conf > /etc/nginx/conf.d/default.conf

# Execute the main nginx command
exec "$@"