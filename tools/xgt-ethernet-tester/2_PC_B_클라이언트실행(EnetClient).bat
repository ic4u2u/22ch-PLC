@echo off
chcp 65001 > nul
title [PC B] 웹 LS Enet Client (이더넷 통신 테스터)
cd /d "%~dp0"
echo.
echo [PC B] 웹 Enet Client 서버를 시작하고 브라우저를 엽니다...
echo.
start "" "http://localhost:3100"
node client-web.js
pause
