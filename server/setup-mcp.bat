@echo off
if not exist ".venv-mcp" (
    echo Creating virtual environment for MCP servers...
    uv venv .venv-mcp --python 3.12
)
echo Installing dependencies...
call .venv-mcp\Scripts\activate.bat
pip install finance-mcp flowllm==0.2.0.8 pathspec==0.11.2 finance-trading-ai-agents-mcp
echo Done!
