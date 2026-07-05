Remove-Item -Recurse -Force .venv-mcp -ErrorAction SilentlyContinue
python -m venv .venv-mcp
.venv-mcp\Scripts\python.exe -m pip install --upgrade pip
.venv-mcp\Scripts\python.exe -m pip install finance-mcp finance-trading-ai-agents-mcp flowllm==0.2.0.8
.venv-mcp\Scripts\python.exe -m pip install pathspec==0.11.2 --no-deps --force-reinstall
