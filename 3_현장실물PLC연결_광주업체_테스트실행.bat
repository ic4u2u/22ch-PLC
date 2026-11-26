@echo off
chcp 65001 > nul
title [3단계] 광주 업체 실물 PLC 직접 연결 실행 (오프라인 / 무설치 호환)
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
echo   [현장 실물 PLC 연결 모드] 광주 업체 PLC와 우리 모니터링을 연결합니다.
echo   ※ 인터넷 연결 없이 오프라인에서도 바로 실행됩니다.
echo =====================================================================
echo.
echo 1. PLC 통신 방식을 선택하세요:
echo    [1] LS XGT 전용 프로토콜 (TCP 포트 2004 - LS 기본 설정)
echo    [2] Modbus TCP 프로토콜  (TCP 포트 502  - 스마트 서버/표준)
echo.
set /p PROTO_SEL=번호 입력 (기본값 1, 그냥 엔터 치면 XGT): 
if "%PROTO_SEL%"=="2" (
  set PLC_PROTOCOL=MODBUS
  set PLC_MODBUS_PORT=502
  set SHOW_PORT=502
) else (
  set PLC_PROTOCOL=XGT
  set PLC_XGT_PORT=2004
  set SHOW_PORT=2004
)

echo.
set /p INPUT_IP=2. 현장 PLC IP 주소 입력 (기본값 192.168.1.10, 그냥 엔터 가능): 
if "%INPUT_IP%"=="" (
  set PLC_IP=192.168.1.10
) else (
  set PLC_IP=%INPUT_IP%
)

echo.
echo =====================================================================
echo   연결 대상 : %PLC_IP%:%SHOW_PORT% (%PLC_PROTOCOL% 모드)
echo   모니터링  : http://localhost:3000 (약 4초 후 자동 열림)
echo   ※ 방화벽 팝업이 뜨면 반드시 [액세스 허용]을 눌러주세요!
echo =====================================================================
echo.

start "ACSC-LIVE-BRIDGE" /min "%NODE_EXE%" "%~dp0server\plc-ws-bridge.js"
if exist "%~dp0.next\BUILD_ID" (
  start "ACSC-LIVE-WEB" /min "%NODE_EXE%" "%~dp0node_modules\next\dist\bin\next" start -H 0.0.0.0 -p 3000
) else (
  start "ACSC-LIVE-WEB" /min "%NODE_EXE%" "%~dp0node_modules\next\dist\bin\next" dev -H 0.0.0.0 -p 3000
)

timeout /t 4 /nobreak >nul
start "" "http://localhost:3000"

echo [실행 중] 종료하려면 아무 키나 누르세요...
pause
taskkill /FI "WINDOWTITLE eq ACSC-LIVE-*" /T /F >nul 2>nul
