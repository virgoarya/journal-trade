Remove-Item -Recurse -Force .venv-mcp -ErrorAction SilentlyContinue
uv venv .venv-mcp --python 3.12
.venv-mcp\Scripts\python.exe -m ensurepip
.venv-mcp\Scripts\python.exe -m pip install flowllm==0.2.0.8 finance-mcp finance-trading-ai-agents-mcp
.venv-mcp\Scripts\python.exe -m pip install pathspec==0.11.2 --no-deps
