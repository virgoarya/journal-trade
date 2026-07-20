@echo off
echo Menginstall dependensi yang dibutuhkan...
cmd /c "set VIRTUAL_ENV=D:\Journal Trade\server\.venv-mcp&& uv pip install -r requirements.txt"

echo Membundle server.py menjadi Hunter Trades AI Trading.exe...
..\.venv-mcp\Scripts\pyinstaller.exe -y --onefile --noconsole --collect-all customtkinter --icon=logo.ico --add-data "logo.ico;." --add-data "logo.png;." --name "Hunter Trades AI Trading" server.py

echo Selesai! File exe dapat ditemukan di folder dist\
pause
