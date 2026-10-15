@echo off
REM Launch Vespera in your browser (no install needed). Double-click this file.
pushd "%~dp0"
where python >nul 2>nul && set PY=python || set PY=py
%PY% -m http.server 8471 --bind 127.0.0.1 >server.log 2>&1
start "" "http://localhost:8471"
timeout /t 1 >nul
popd
