@echo off
echo Menginstall dependensi yang dibutuhkan...
cmd /c "set VIRTUAL_ENV=D:\Journal Trade\server\.venv-mcp&& uv pip install -r requirements.txt"

echo Membundle server.py menjadi Mulai_AI_Trading.exe...
..\.venv-mcp\Scripts\pyinstaller.exe --onefile --name Mulai_AI_Trading server.py

echo Selesai! File exe dapat ditemukan di folder dist\
pause
