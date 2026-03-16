#!/bin/bash
set -e

# Git setup — derive identity from GitHub token
gh auth setup-git
GH_USER_JSON=$(gh api user -q '{name: .name, login: .login, email: .email, id: .id}')
GH_USER_NAME=$(echo "$GH_USER_JSON" | jq -r '.name // .login')
GH_USER_EMAIL=$(echo "$GH_USER_JSON" | jq -r '.email // "\(.id)+\(.login)@users.noreply.github.com"')
git config --global user.name "$GH_USER_NAME"
git config --global user.email "$GH_USER_EMAIL"

cd /home/agent/workspace

# Clone if volume is empty, otherwise reset to clean state
if [ ! -d ".git" ]; then
    git clone --branch "$BRANCH" "https://github.com/$REPO" .
else
    git fetch origin
    git checkout "$BRANCH"
    git reset --hard "origin/$BRANCH"
    git clean -fd
fi

# Checkout feature branch (create or reset)
if git ls-remote --heads origin "$FEATURE_BRANCH" | grep -q .; then
    git checkout -B "$FEATURE_BRANCH" "origin/$FEATURE_BRANCH"
else
    git checkout -b "$FEATURE_BRANCH"
    git push -u origin "$FEATURE_BRANCH"
fi

WORKSPACE_DIR=$(pwd)

# Resolve LLM provider settings
LLM_PROVIDER="${LLM_PROVIDER:-openrouter}"

MODEL_FLAGS="--provider $LLM_PROVIDER"
if [ -n "$LLM_MODEL" ]; then
    MODEL_FLAGS="$MODEL_FLAGS --model $LLM_MODEL"
fi

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
    MODEL_FLAGS="--provider openrouter --model $LLM_MODEL"
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

# Copy custom models.json from repo if present (overrides generated)
if [ -f "/home/agent/workspace/.pi/agent/models.json" ]; then
    cp /home/agent/workspace/.pi/agent/models.json /home/agent/.pi/agent/models.json
fi

# Build system prompt if SYSTEM.md exists
if [ -f "/home/agent/workspace/config/SOUL.md" ]; then
    > /home/agent/.pi/SYSTEM.md
    cat /home/agent/workspace/config/SOUL.md >> /home/agent/.pi/SYSTEM.md
fi

# Setup session log dir
SESSION_DIR="/home/agent/workspace/.pi-sessions"
mkdir -p "$SESSION_DIR"

# Run Pi Coding Agent headlessly
set +e
pi $MODEL_FLAGS \
    -p "$HEADLESS_TASK" \
    --session-dir "$SESSION_DIR"
AGENT_EXIT=$?
set -e

if [ $AGENT_EXIT -eq 0 ]; then
    # Commit + merge back
    git add -A
    git diff --cached --quiet && { echo "NO_CHANGES"; exit 0; }
    git commit -m "feat: headless task" || true
    git fetch origin
    git rebase "origin/$BRANCH" || {
        git rebase --abort
        echo "REBASE_FAILED"
        exit 1
    }
    git push --force-with-lease origin HEAD
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    git merge "$FEATURE_BRANCH"
    git push origin "$BRANCH"
    echo "MERGE_SUCCESS"
else
    echo "AGENT_FAILED"
    exit $AGENT_EXIT
fi
