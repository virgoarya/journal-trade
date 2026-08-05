@echo off
echo Membundle server.py menjadi Hunter Trades AI Trading.exe...
..\.venv-mcp\Scripts\pyinstaller.exe -y --onefile --noconsole --collect-all customtkinter --icon=logo.ico --add-data "logo.ico;." --add-data "logo.png;." --name "Hunter Trades AI Trading" server.py
echo Selesai!

