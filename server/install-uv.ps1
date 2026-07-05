Remove-Item -Recurse -Force .venv-mcp -ErrorAction SilentlyContinue
uv venv .venv-mcp --python 3.12
uv pip install -p .venv-mcp\Scripts\python.exe finance-mcp finance-trading-ai-agents-mcp flowllm==0.2.0.8
.venv-mcp\Scripts\python.exe -m ensurepip
.venv-mcp\Scripts\python.exe -m pip install pathspec==0.11.2 --no-deps --force-reinstall
