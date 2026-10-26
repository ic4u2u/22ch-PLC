@echo off
chcp 65001 >nul
title [ACSC 24CH] 듀얼 모니터(HDMI+DP) Kiosk 자동 실행기

echo ============================================================================
echo [ACSC 24채널 특수가스 스마트 관제 시스템] 큐텍 듀얼모니터 Kiosk 기동 중...
echo   - 모니터 1 (HDMI, 0,0)    : 상황실 조작 대시보드 (/?view=control)
echo   - 모니터 2 (DP, 1920,0)   : 현장 대형 TV 전광판 (/?view=wallboard)
echo ============================================================================

cd /d "%~dp0"

:: 1. PM2 백그라운드 서비스 기동 (브릿지 서버 Port 4000 + 웹 서버 Port 3000)
call pm2 start ecosystem.config.js
timeout /t 4 /nobreak >nul

:: 2. 크롬 또는 엣지 브라우저 경로 탐색
set "BROWSER_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)

if "%BROWSER_EXE%"=="" (
    echo [경고] Chrome 또는 Edge 브라우저를 찾을 수 없어 기본 브라우저로 실행합니다.
    start "" "http://localhost:3000/?view=control"
    start "" "http://localhost:3000/?view=wallboard"
    exit /b 0
)

:: 3. 모니터 1 (HDMI 주 모니터: 좌표 0,0) - 상황실 조작 대시보드 전체화면 Kiosk 실행
start "" "%BROWSER_EXE%" --new-window --kiosk "http://localhost:3000/?view=control" --window-position=0,0 --user-data-dir="%TEMP%\acsc_kiosk_mon1" --autoplay-policy=no-user-gesture-required

timeout /t 2 /nobreak >nul

:: 4. 모니터 2 (DP 보조 대형 TV: 좌표 1920,0) - 대형 전광판 뷰 전체화면 Kiosk 실행
start "" "%BROWSER_EXE%" --new-window --kiosk "http://localhost:3000/?view=wallboard" --window-position=1920,0 --user-data-dir="%TEMP%\acsc_kiosk_mon2" --autoplay-policy=no-user-gesture-required

echo [완료] 듀얼 모니터 Kiosk 창이 각각 모니터 1(0,0)과 모니터 2(1920,0)에 배치되었습니다.
exit /b 0
