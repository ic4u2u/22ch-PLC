@echo off
chcp 65001 >nul
cd /d "%~dp0"
title [ACSC 22CH] 원클릭 자동 설치 및 가상 테스트 실행기

echo ============================================================================
echo [ACSC 22채널 특수가스 관제 시스템] 원클릭 자동 설치 ^& 실행
echo ============================================================================

where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [안내] 이 컴퓨터에 Node.js가 설치되어 있지 않습니다.
    echo        열리는 웹페이지에서 LTS 버전을 다운로드해 설치한 뒤 다시 실행해 주세요.
    start "" "https://nodejs.org/ko/download"
    pause
    exit /b 1
)

if not exist ".env.local" (
    echo [1/3] .env.local 환경설정 파일 생성 중...
    copy /y ".env.example" ".env.local" >nul
)

if not exist "node_modules" (
    echo [2/3] 필수 패키지 설치 중 (최초 1회, 약 1분 소요)...
    call npm install
    if %errorLevel% neq 0 (
        echo [오류] 패키지 설치 중 문제가 발생했습니다. 인터넷 연결을 확인해 주세요.
        pause
        exit /b 1
    )
) else (
    echo [2/3] 필수 패키지 이미 설치됨 (건너뜀)
)

echo [3/3] 가상 PLC + 브릿지 + 웹 대시보드 실행 중...
echo       잠시 후 브라우저가 열립니다. (관리자 PIN: 1234)
echo       종료하려면 이 창에서 Ctrl+C 를 누르세요.
echo ============================================================================
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000/?view=control"
call npm run dev:all
pause
