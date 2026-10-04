# Build the TanStack Start frontend for Nitro's Node.js server.
FROM node:22-bookworm-slim AS frontend-build

WORKDIR /build/frontend
COPY frontend/enchanted-grove-ui/package.json frontend/enchanted-grove-ui/package-lock.json ./
RUN npm ci
COPY frontend/enchanted-grove-ui/ ./
RUN npm run build

# One App Service container runs Flask, TanStack Start, and Nginx. Nginx is
# the only public listener; it sends /api and /auth requests to Flask.
FROM node:22-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    PATH="/opt/venv/bin:$PATH"

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv nginx \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/venv \
    && rm -f /etc/nginx/sites-enabled/default

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt gunicorn
COPY app.py service_classifier.py ./
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/container-entrypoint.sh /app/container-entrypoint.sh
RUN chmod +x /app/container-entrypoint.sh

COPY --from=frontend-build /build/frontend/package.json /app/frontend/package.json
COPY --from=frontend-build /build/frontend/.output /app/frontend/.output

EXPOSE 80
CMD ["/app/container-entrypoint.sh"]
