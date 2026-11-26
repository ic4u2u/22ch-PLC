@echo off
chcp 65001 > nul
title [2단계] 가상 PLC 시뮬레이션 모드 (오프라인 / 무설치 호환)
cd /d "%~dp0"

set "NODE_EXE="
if exist "%~dp0portable-node\node.exe" (
  set "NODE_EXE=%~dp0portable-node\node.exe"
  set "PATH=%~dp0portable-node;%PATH%"
) else (
  where node >nul 2>nul
  if not errorlevel 1 set "NODE_EXE=node"
)

if "%NODE_EXE%"=="" (
  echo [오류] Node.js가 없고 portable-node\node.exe 도 없습니다.
  pause
  exit /b 1
)

echo =====================================================================
echo   [시뮬레이션 모드] 가상 PLC + 브릿지 + 22채널 3D 모니터링을 켭니다.
echo   ※ 인터넷 연결 없이 오프라인에서도 실행됩니다.
echo   ※ 약 4초 뒤 브라우저에서 http://localhost:3000 화면이 자동으로 열립니다.
echo   ※ 종료하려면 이 창에서 아무 키나 누르세요.
echo =====================================================================
echo.

start "ACSC-SIM-MOCK" /min "%NODE_EXE%" "%~dp0server\mock-plc.js"
start "ACSC-SIM-BRIDGE" /min "%NODE_EXE%" "%~dp0server\plc-ws-bridge.js"

if exist "%~dp0.next\BUILD_ID" (
  start "ACSC-SIM-WEB" /min "%NODE_EXE%" "%~dp0node_modules\next\dist\bin\next" start -H 0.0.0.0 -p 3000
) else (
  start "ACSC-SIM-WEB" /min "%NODE_EXE%" "%~dp0node_modules\next\dist\bin\next" dev -H 0.0.0.0 -p 3000
)

timeout /t 4 /nobreak >nul
start "" "http://localhost:3000"

echo [실행 중] 종료하려면 아무 키나 누르세요...
pause
taskkill /FI "WINDOWTITLE eq ACSC-SIM-*" /T /F >nul 2>nul
