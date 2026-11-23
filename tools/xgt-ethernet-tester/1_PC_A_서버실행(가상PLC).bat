@echo off
chcp 65001 > nul
title [PC A] LS XGT 가상 PLC & 이더넷 서버 (TCP 2004)
cd /d "%~dp0"
echo.
echo [PC A] 가상 PLC (LSIS-XGT TCP 2004) 서버를 시작합니다...
echo.
node server.js
pause
