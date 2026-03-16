#!/bin/bash
set -e

# Git setup - derive identity from GitHub token
gh auth setup-git
GH_USER_JSON=$(gh api user -q '{name: .name, login: .login, email: .email, id: .id}')
GH_USER_NAME=$(echo "$GH_USER_JSON" | jq -r '.name // .login')
GH_USER_EMAIL=$(echo "$GH_USER_JSON" | jq -r '.email // "\(.id)+\(.login)@users.noreply.github.com"')
git config --global user.name "$GH_USER_NAME"
git config --global user.email "$GH_USER_EMAIL"

# Clone repo (skip if already cloned — enables docker restart)
if [ -n "$REPO" ] && [ ! -d "/home/agent/workspace/.git" ]; then
    git clone --branch "$BRANCH" "https://github.com/$REPO" /home/agent/workspace
fi

cd /home/agent/workspace

# Create or checkout feature branch
if [ -n "$FEATURE_BRANCH" ]; then
    if git rev-parse --verify "$FEATURE_BRANCH" >/dev/null 2>&1; then
        git checkout "$FEATURE_BRANCH"
    elif git ls-remote --heads origin "$FEATURE_BRANCH" | grep -q .; then
        git checkout -b "$FEATURE_BRANCH" "origin/$FEATURE_BRANCH"
    else
        git checkout -b "$FEATURE_BRANCH"
        git push -u origin "$FEATURE_BRANCH"
    fi
fi

WORKSPACE_DIR=$(pwd)

# Resolve LLM provider settings
LLM_PROVIDER="${LLM_PROVIDER:-openrouter}"

# Generate models.json for OpenRouter or custom provider
if [ "$LLM_PROVIDER" = "openrouter" ] && [ -n "$OPENROUTER_API_KEY" ]; then
    LLM_MODEL="${LLM_MODEL:-minimax/minimax-m2.5}"
    mkdir -p /home/agent/.pi/agent
    cat > /home/agent/.pi/agent/models.json <<MODELS
{
  "providers": {
    "openrouter": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "api": "openai-completions",
      "apiKey": "OPENROUTER_API_KEY",
      "models": [{ "id": "$LLM_MODEL" }]
    }
  }
}
MODELS
elif [ "$LLM_PROVIDER" = "custom" ] && [ -n "$OPENAI_BASE_URL" ]; then
    if [ -z "$CUSTOM_API_KEY" ]; then
        export CUSTOM_API_KEY="not-needed"
    fi
    mkdir -p /home/agent/.pi/agent
    cat > /home/agent/.pi/agent/models.json <<MODELS
{
  "providers": {
    "custom": {
      "baseUrl": "$OPENAI_BASE_URL",
      "api": "openai-completions",
      "apiKey": "CUSTOM_API_KEY",
      "models": [{ "id": "$LLM_MODEL" }]
    }
  }
}
MODELS
fi

# Copy custom models.json from repo if present (overrides generated)
if [ -f "${WORKSPACE_DIR}/.pi/agent/models.json" ]; then
    mkdir -p /home/agent/.pi/agent
    cp "${WORKSPACE_DIR}/.pi/agent/models.json" /home/agent/.pi/agent/models.json
fi

# Write chat context file if provided
if [ -n "$CHAT_CONTEXT" ]; then
    mkdir -p .pi
    cat > .pi/chat-context.txt << 'CTXHEADER'
The following is a previous planning conversation between the user and an AI assistant. The user has now switched to this interactive coding session to continue working on this task. Use this conversation as context.

CTXHEADER
    echo "$CHAT_CONTEXT" >> .pi/chat-context.txt
fi

# Build Pi command flags
PI_FLAGS="--provider $LLM_PROVIDER"
if [ -n "$LLM_MODEL" ]; then
    PI_FLAGS="$PI_FLAGS --model $LLM_MODEL"
fi

# Start Pi in a tmux session
tmux -u new-session -d -s pi "pi $PI_FLAGS"

# Start ttyd in foreground (PID 1) — serves tmux over WebSocket
exec ttyd --writable -p "${PORT:-7681}" tmux attach -t pi
