FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# System packages
RUN apt-get update && apt-get install -y \
    tmux \
    git \
    curl \
    jq \
    build-essential \
    locales \
    fonts-noto-color-emoji \
    fonts-symbola \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Locale
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV LC_CTYPE=en_US.UTF-8

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# ttyd (web terminal)
RUN curl -fsSL -o /usr/local/bin/ttyd https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 \
    && chmod +x /usr/local/bin/ttyd

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Pi Coding Agent
RUN npm install -g @mariozechner/pi-coding-agent

# Non-root user
RUN useradd -m -s /bin/bash agent \
    && mkdir -p /home/agent/workspace \
    && chown agent:agent /home/agent/workspace

# Create Pi config directory
RUN mkdir -p /home/agent/.pi/agent \
    && chown -R agent:agent /home/agent/.pi

COPY .tmux.conf /home/agent/.tmux.conf
RUN chown agent:agent /home/agent/.tmux.conf

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER agent
WORKDIR /home/agent/workspace

ENV REPO=""
ENV BRANCH=main
ENV PORT=7681

ENTRYPOINT ["/entrypoint.sh"]
