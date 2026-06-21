FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    dnsutils \
    git \
    iproute2 \
    iputils-ping \
    jq \
    less \
    nano \
    procps \
    python3 \
    python3-pip \
    sudo \
    unzip \
    vim-tiny \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash dev \
  && mkdir -p /home/dev/workspace \
  && echo "dev ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/dev \
  && chmod 0440 /etc/sudoers.d/dev \
  && chown -R dev:dev /home/dev

COPY --chown=dev:dev bashrc /home/dev/.bashrc
COPY --chown=dev:dev README-LAB.txt /home/dev/README-LAB.txt

USER dev
WORKDIR /home/dev/workspace

CMD ["sleep", "infinity"]
