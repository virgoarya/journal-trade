#!/bin/sh
python3 -m venv /app/server/.venv-mcp
/app/server/.venv-mcp/bin/pip install --upgrade pip
/app/server/.venv-mcp/bin/pip install finance-mcp finance-trading-ai-agents-mcp flowllm==0.2.0.8 pathspec==0.11.2
