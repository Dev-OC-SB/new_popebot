#!/bin/bash
set -e

# Git setup — derive identity from GitHub token (useful if tasks need git)
if [ -n "$GH_TOKEN" ]; then
    gh auth setup-git
    GH_USER_JSON=$(gh api user -q '{name: .name, login: .login, email: .email, id: .id}')
    GH_USER_NAME=$(echo "$GH_USER_JSON" | jq -r '.name // .login')
    GH_USER_EMAIL=$(echo "$GH_USER_JSON" | jq -r '.email // "\(.id)+\(.login)@users.noreply.github.com"')
    git config --global user.name "$GH_USER_NAME"
    git config --global user.email "$GH_USER_EMAIL"
fi

cd /home/agent/workspace

# Resolve LLM provider settings
LLM_PROVIDER="${LLM_PROVIDER:-openrouter}"

# Generate models.json for OpenRouter or custom provider
if [ "$LLM_PROVIDER" = "openrouter" ] && [ -n "$OPENROUTER_API_KEY" ]; then
    LLM_MODEL="${LLM_MODEL:-minimax/minimax-m2.5}"
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

# Build Pi command flags
PI_FLAGS="--provider $LLM_PROVIDER"
if [ -n "$LLM_MODEL" ]; then
    PI_FLAGS="$PI_FLAGS --model $LLM_MODEL"
fi

# Build system prompt file if SYSTEM_PROMPT env var is set
if [ -n "$SYSTEM_PROMPT" ]; then
    mkdir -p /home/agent/.pi
    echo "$SYSTEM_PROMPT" > /home/agent/.pi/SYSTEM.md
fi

# Switch to best-effort mode for logging + pi execution
set +e

# Use log dir created by event handler (passed as env var)
LOG_READY=false
if [ -n "$LOG_DIR" ] && mkdir -p "$LOG_DIR" 2>/dev/null; then
    LOG_READY=true
fi

# Setup session dir for Pi
SESSION_DIR="/home/agent/workspace/.pi-sessions"
mkdir -p "$SESSION_DIR"

# Run Pi Coding Agent — tee to log files if ready, otherwise run normally
if [ "$LOG_READY" = true ]; then
    pi $PI_FLAGS \
        -p "$PROMPT" \
        --session-dir "$SESSION_DIR" \
        > >(tee "$LOG_DIR/stdout.jsonl") \
        2> >(tee "$LOG_DIR/stderr.txt" >&2)
    EXIT_CODE=$?
else
    pi $PI_FLAGS \
        -p "$PROMPT" \
        --session-dir "$SESSION_DIR"
    EXIT_CODE=$?
fi

# Finalize meta with end time (best-effort)
if [ "$LOG_READY" = true ]; then
    jq --arg end "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '. + {endedAt: $end}' \
        "$LOG_DIR/meta.json" > "$LOG_DIR/meta.tmp" 2>/dev/null \
        && mv "$LOG_DIR/meta.tmp" "$LOG_DIR/meta.json"
fi

exit $EXIT_CODE
