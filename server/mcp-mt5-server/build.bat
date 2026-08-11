@echo off
cd /d "%~dp0"
echo Membundle server.py menjadi Hunter Trades AI Trading.exe...
..\.venv-mcp\Scripts\pyinstaller.exe -y --onefile --noconsole --collect-all customtkinter --icon=logo.ico --add-data "logo.ico;." --add-data "logo.png;." --name "Hunter Trades AI Trading" server.py
if errorlevel 1 goto :error
echo Selesai!
exit /b 0
:error
echo Build gagal dengan error code %errorlevel%.
exit /b %errorlevel%

