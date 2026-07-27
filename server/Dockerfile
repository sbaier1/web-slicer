FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    python3 \
    python3-pip \
    python3-venv \
    prusa-slicer \
    libgtk-3-0 \
    libwebkit2gtk-4.1-0 \
    libglu1-mesa \
    libsecret-1-0 \
    libgstreamer1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    squashfs-tools \
    file \
    && rm -rf /var/lib/apt/lists/*

ARG TARGETARCH
RUN set -ex; \
    ARCH="${TARGETARCH:-$(uname -m)}"; \
    if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then \
        ORCA_URL="https://github.com/OrcaSlicer/OrcaSlicer/releases/download/v2.4.2/OrcaSlicer_Linux_AppImage_Ubuntu2404_aarch64_V2.4.2.AppImage"; \
    else \
        ORCA_URL="https://github.com/OrcaSlicer/OrcaSlicer/releases/download/v2.4.2/OrcaSlicer_Linux_AppImage_Ubuntu2404_V2.4.2.AppImage"; \
    fi; \
    echo "Downloading OrcaSlicer for $ARCH from $ORCA_URL..."; \
    curl -sSL "$ORCA_URL" -o /tmp/OrcaSlicer.AppImage; \
    unsquashfs -d /opt/orcaslicer /tmp/OrcaSlicer.AppImage || true; \
    if [ ! -f /opt/orcaslicer/AppRun ]; then \
        chmod +x /tmp/OrcaSlicer.AppImage; \
        cd /tmp && /tmp/OrcaSlicer.AppImage --appimage-extract; \
        mv /tmp/squashfs-root /opt/orcaslicer; \
    fi; \
    rm -f /tmp/OrcaSlicer.AppImage; \
    ln -s /opt/orcaslicer/AppRun /usr/local/bin/orcaslicer; \
    ln -s /opt/orcaslicer/AppRun /usr/local/bin/orca-slicer; \
    echo "OrcaSlicer 2.4.2 successfully installed!"

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r /app/requirements.txt

COPY slicer_engine.py /app/slicer_engine.py
COPY server.py /app/server.py

EXPOSE 8080

CMD ["/app/venv/bin/python3", "server.py"]
