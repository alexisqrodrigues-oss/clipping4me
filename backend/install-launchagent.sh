#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_PATH="$HOME/Library/LaunchAgents/me.clipping4.backend.plist"
LOG_DIR="$HOME/Library/Logs"
ROOT_DIR="${CLIPPING4ME_ROOT:-$HOME/Clipping4me}"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR" "$ROOT_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>me.clipping4.backend</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${REPO_DIR}/backend/run.sh</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${REPO_DIR}/backend</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>CLIPPING4ME_ROOT</key>
    <string>${ROOT_DIR}</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/clipping4me.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/clipping4me.err.log</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load -w "$PLIST_PATH"

printf 'LaunchAgent instalado em %s\n' "$PLIST_PATH"
printf 'Logs: %s/clipping4me.log\n' "$LOG_DIR"