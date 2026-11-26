@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
title [4단계] 무설치 오프라인 USB 현장 실행 (설치 PC 흔적 없음)
cd /d "%~dp0"

:: 1. 포터블 Node.js 우선 탐색 (설치 PC에 Node.js 없어도 동작)
set "NODE_EXE="
if exist "%~dp0portable-node\node.exe" (
  set "NODE_EXE=%~dp0portable-node\node.exe"
  set "PATH=%~dp0portable-node;%PATH%"
) else (
  where node >nul 2>nul
  if not errorlevel 1 (
    set "NODE_EXE=node"
  )
)

if "%NODE_EXE%"=="" (
  echo [오류] 실행 가능한 Node.js를 찾을 수 없습니다!
  echo 인터넷이 되는 PC에서 [0_오프라인_USB포터블_패키지_만들기.bat]를 먼저 1회 실행해 주세요.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules\next\dist\bin\next" (
  echo [오류] node_modules 패키지가 없습니다!
  echo 인터넷이 되는 PC에서 [0_오프라인_USB포터블_패키지_만들기.bat]를 먼저 1회 실행해 주세요.
  pause
  exit /b 1
)

echo =====================================================================
echo   [무설치 오프라인 USB 현장 실행 모드]
echo   - 인터넷(네트워크) 미연결 상태에서도 100%% 동작합니다.
echo   - 모든 임시 DB/로그는 종료 시 자동 삭제되어 설치 PC에 남지 않습니다.
echo =====================================================================
echo.
echo 실행 모드를 선택하세요:
echo   [1] 현장 실물 PLC 직접 연결 (XGT 2004 / Modbus 502)
echo   [2] 가상 PLC 시뮬레이션 (PLC 없이 혼자 테스트)
echo.
set /p RUN_MODE=번호 입력 (기본값 1, 엔터 시 현장 실물 PLC 연결): 

if "%RUN_MODE%"=="2" (
  set "PLC_PROTOCOL=MODBUS"
  set "PLC_IP=127.0.0.1"
  set "PLC_MODBUS_PORT=5020"
  set "SHOW_PORT=5020"
  set "USE_MOCK=1"
) else (
  set "USE_MOCK=0"
  echo.
  echo PLC 통신 방식을 선택하세요:
  echo   [1] LS XGT 전용 프로토콜 (TCP 포트 2004 - LS 기본)
  echo   [2] Modbus TCP 프로토콜  (TCP 포트 502)
  set /p PROTO_SEL=번호 입력 (기본값 1): 
  if "!PROTO_SEL!"=="2" (
    set "PLC_PROTOCOL=MODBUS"
    set "PLC_MODBUS_PORT=502"
    set "SHOW_PORT=502"
  ) else (
    set "PLC_PROTOCOL=XGT"
    set "PLC_XGT_PORT=2004"
    set "SHOW_PORT=2004"
  )
  echo.
  set /p INPUT_IP=현장 PLC IP 입력 (기본값 192.168.1.10, 그냥 엔터 가능): 
  if "!INPUT_IP!"=="" (
    set "PLC_IP=192.168.1.10"
  ) else (
    set "PLC_IP=!INPUT_IP!"
  )
)

:: 2. 설치 PC에 흔적을 남기지 않기 위해 임시 세션 폴더 사용 (종료 시 삭제)
set "ACSC_SESSION_DIR=%TEMP%\acsc_usb_session_%RANDOM%"
set "ACSC_LOGS_DIR=%ACSC_SESSION_DIR%\logs"
mkdir "%ACSC_LOGS_DIR%" 2>nul

echo.
echo =====================================================================
echo   실행 방식 : USB 무설치 오프라인 모드 (네트워크 불필요)
echo   대상 PLC  : %PLC_IP%:%SHOW_PORT% (%PLC_PROTOCOL%)
echo   웹 화면   : http://localhost:3000 (약 3~5초 후 자동 열림)
echo   ※ 종료하려면 아무 키나 누르거나 이 창에서 Ctrl+C를 누르세요.
echo   ※ 종료 시 임시 파일 및 프로세스가 자동으로 정리됩니다.
echo =====================================================================
echo.

if "%USE_MOCK%"=="1" (
  start "ACSC-USB-MOCK-PLC" /min "%NODE_EXE%" "%~dp0server\mock-plc.js"
)
start "ACSC-USB-BRIDGE" /min "%NODE_EXE%" "%~dp0server\plc-ws-bridge.js"

:: 프로덕션 빌드(.next\BUILD_ID)가 있으면 즉시 실행(start), 없으면 dev 실행
if exist "%~dp0.next\BUILD_ID" (
  start "ACSC-USB-WEB" /min "%NODE_EXE%" "%~dp0node_modules\next\dist\bin\next" start -H 0.0.0.0 -p 3000
) else (
  start "ACSC-USB-WEB" /min "%NODE_EXE%" "%~dp0node_modules\next\dist\bin\next" dev -H 0.0.0.0 -p 3000
)

timeout /t 4 /nobreak >nul
start "" "http://localhost:3000"

echo [실행 중] 테스트가 끝나면 아래 안내에 따라 아무 키나 눌러 종료하세요.
echo (종료 시 설치 PC에 남은 프로세스와 임시 파일을 모두 정리합니다)
pause

echo.
echo [정리 중] 실행된 프로세스와 임시 세션 파일을 정리합니다...
taskkill /FI "WINDOWTITLE eq ACSC-USB-*" /T /F >nul 2>nul
rmdir /s /q "%ACSC_SESSION_DIR%" 2>nul
rmdir /s /q "%TEMP%\acsc_kiosk_mon1" 2>nul
rmdir /s /q "%TEMP%\acsc_kiosk_mon2" 2>nul
echo [완료] 설치 PC 흔적 정리 완료! USB를 안전하게 제거하셔도 됩니다.
timeout /t 2 /nobreak >nul
