@echo off
chcp 65001 > nul
title [0단계] 오프라인 / USB 무설치 포터블 패키지 준비 (인터넷 연결 PC에서 1회 실행)
cd /d "%~dp0"
echo =====================================================================
echo   [0단계] 현장 오프라인 / USB 무설치 실행용 패키지를 준비합니다.
echo   ※ 인터넷이 되는 PC에서 딱 1번 실행한 뒤, 폴더째 USB에 복사하세요.
echo   ※ 현장 PC에는 Node.js 설치도, 인터넷 연결도, SW 남김도 필요 없습니다.
echo =====================================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] 이 준비 PC에는 Node.js가 설치되어 있지 않습니다.
  echo 먼저 https://nodejs.org/ko 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요.
  pause
  exit /b 1
)

echo [1/3] 필수 패키지(node_modules) 설치 중...
call npm install
if errorlevel 1 (
  echo [오류] npm install 실패. 인터넷 연결 상태를 확인해 주세요.
  pause
  exit /b 1
)

echo.
echo [2/3] 오프라인 즉시 실행용 프로덕션 빌드(.next) 생성 중...
call npm run build
if errorlevel 1 (
  echo [오류] npm run build 실패.
  pause
  exit /b 1
)

echo.
echo [3/3] 무설치 포터블 Node.js(portable-node\node.exe) 준비 중...
if exist "portable-node\node.exe" (
  echo   - 이미 portable-node\node.exe 가 존재합니다. (건너뜀)
) else (
  mkdir "portable-node" 2>nul
  for /f "delims=" %%v in ('node -p "process.version"') do set "NODE_VER=%%v"
  echo   - Node.js %NODE_VER% (win-x64) 포터블 바이너리를 내려받습니다...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://nodejs.org/dist/%NODE_VER%/win-x64/node.exe' -OutFile 'portable-node\node.exe' -UseBasicParsing; exit 0 } catch { exit 1 }"
  if errorlevel 1 (
    echo   [안내] 자동 다운로드에 실패했습니다.
    echo          현재 PC의 node.exe를 portable-node\node.exe 로 복사합니다...
    for /f "delims=" %%p in ('where node') do (
      copy /y "%%p" "portable-node\node.exe" >nul
      goto :node_copied
    )
  )
)
:node_copied

echo.
echo =====================================================================
echo   [준비 완료!] 이제 이 폴더 전체를 USB 메모리에 복사하세요.
echo   현장 설치 PC에서는 USB를 꽂고 아래 파일을 바로 실행하면 됩니다:
echo     ▶ 4_무설치_오프라인_USB_현장실행.bat
echo   (또는 3_현장실물PLC연결_광주업체_테스트실행.bat)
echo   ※ 인터넷 OFF 상태 / Node.js 미설치 PC에서도 100%% 동작하며,
echo      종료 후 USB만 빼면 설치 PC에 SW 흔적이 남지 않습니다.
echo =====================================================================
pause
