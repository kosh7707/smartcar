FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    file \
    make \
    qemu-user-static \
    gcc \
    g++ \
    gcc-arm-linux-gnueabihf \
    libc6-dev-armhf-cross \
    gcc-aarch64-linux-gnu \
    libc6-dev-arm64-cross \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
CMD ["tail", "-f", "/dev/null"]
