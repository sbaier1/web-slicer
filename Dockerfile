# Multi-stage Multiplatform Production Dockerfile for OrcaWeb (arm64 & amd64)

# ==========================================
# STAGE 1: Build React Frontend SPA (Node 22)
# ==========================================
FROM --platform=$BUILDPLATFORM node:22-slim AS frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

# ==========================================
# STAGE 2: Runtime Engine & Web Server (Debian Bookworm)
# ==========================================
FROM debian:bookworm-slim AS runner

ENV DEBIAN_FRONTEND=noninteractive

# 1. Install Base Packages, Slicer Dependencies & 7z via deb.debian.org (Fastly CDN)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    prusa-slicer \
    nginx \
    libgtk-3-0 \
    libwebkit2gtk-4.1-0 \
    libglu1-mesa \
    libsecret-1-0 \
    squashfs-tools \
    p7zip-full \
    xvfb \
    file \
    && rm -rf /var/lib/apt/lists/*

# 2. Install Official OrcaSlicer Native Binary via 7z extraction (QEMU & Cross-Architecture Safe)
ARG TARGETARCH
RUN set -ex; \
    ARCH="${TARGETARCH:-$(uname -m)}"; \
    ORCA_URL=$(python3 -c 'import json, urllib.request, sys; arch = "'"$ARCH"'".lower(); req = urllib.request.Request("https://api.github.com/repos/OrcaSlicer/OrcaSlicer/releases/latest", headers={"User-Agent": "DockerBuild"}); data = json.loads(urllib.request.urlopen(req).read()); found = [a["browser_download_url"] for a in data.get("assets", []) if a["browser_download_url"].endswith(".AppImage") and (("arm64" in arch or "aarch64" in arch) == ("aarch64" in a["browser_download_url"] or "arm64" in a["browser_download_url"]))]; print(found[0] if found else "")'); \
    echo "Resolved OrcaSlicer Download URL for $ARCH: $ORCA_URL"; \
    if [ -z "$ORCA_URL" ]; then echo "Failed to resolve OrcaSlicer AppImage URL"; exit 1; fi; \
    curl -fsSL --retry 5 --retry-connrefused --retry-delay 2 "$ORCA_URL" -o /tmp/OrcaSlicer.AppImage; \
    mkdir -p /opt/orcaslicer; \
    7z x -o/opt/orcaslicer /tmp/OrcaSlicer.AppImage; \
    rm -f /tmp/OrcaSlicer.AppImage; \
    chmod +x /opt/orcaslicer/AppRun /opt/orcaslicer/bin/orca-slicer 2>/dev/null || true; \
    ln -s /opt/orcaslicer/AppRun /usr/local/bin/orcaslicer; \
    ln -s /opt/orcaslicer/AppRun /usr/local/bin/orca-slicer; \
    echo "OrcaSlicer successfully installed!"

WORKDIR /app

# 3. Install Python Backend Dependencies
COPY server/requirements.txt /app/server/requirements.txt
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r /app/server/requirements.txt

COPY server/ /app/server/
COPY default_settings.json /app/default_settings.json
COPY entrypoint.sh /app/entrypoint.sh
COPY nginx.conf /etc/nginx/sites-available/default

# 4. Copy Sliced Frontend Distribution from Stage 1
COPY --from=frontend-builder /app/dist /var/www/html

RUN chmod +x /app/entrypoint.sh

EXPOSE 80 8080

ENTRYPOINT ["/app/entrypoint.sh"]
