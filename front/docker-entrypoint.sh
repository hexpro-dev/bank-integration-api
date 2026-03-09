#!/bin/sh
cat <<EOF > /app/build/client/__env.js
window.__ENV__ = {
  VITE_API_URL: "${VITE_API_URL:-http://localhost:4000}"
};
EOF
exec "$@"
