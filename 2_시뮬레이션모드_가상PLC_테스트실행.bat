@echo off
chcp 65001 > nul
title [2단계] 가상 PLC 시뮬레이션 모드 (미니PC 혼자 테스트)
cd /d "%~dp0"
echo =====================================================================
echo   [시뮬레이션 모드] 가상 PLC + 브릿지 + 22채널 3D 모니터링을 켭니다.
echo   ※ 약 5초 뒤 브라우저에서 http://localhost:3000 화면이 자동으로 열립니다.
echo   ※ 종료하려면 이 창을 닫거나 Ctrl+C를 누르세요.
echo =====================================================================
echo.
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"
call npm run dev:all
pause
