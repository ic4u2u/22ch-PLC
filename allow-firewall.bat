@echo off
chcp 65001 >nul
title [ACSC 24CH] 사내망 원격 관제 & PLC 통신 방화벽 일괄 허용

echo ============================================================================
echo [ACSC 24채널 특수가스 관제 시스템] Windows 방화벽 TCP 포트 일괄 허용 스크립트
echo   허용 포트: 3000(웹UI), 4000(WebSocket/REST), 502(Modbus), 2004(XGT), 8502(가상PLC)
echo ============================================================================

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [오류] 이 스크립트는 우클릭 후 [관리자 권한으로 실행]해야 합니다!
    pause
    exit /b 1
)

netsh advfirewall firewall delete rule name="ACSC_24CH_SMART_MONITORING_PORTS" >nul 2>&1
netsh advfirewall firewall add rule name="ACSC_24CH_SMART_MONITORING_PORTS" dir=in action=allow protocol=TCP localport=3000,4000,502,2004,8502

echo.
echo ✅ 방화벽 인바운드 TCP 포트 (3000, 4000, 502, 2004, 8502) 허용이 완료되었습니다!
echo ----------------------------------------------------------------------------
echo 📱 현재 관제 PC의 네트워크 IP 주소 목록 (사내 공유기 IP로 태블릿에서 접속하세요):
ipconfig | findstr /i "IPv4"
echo ----------------------------------------------------------------------------
echo   • 상황실/태블릿 조작 뷰 : http://[사내망IP]:3000/?view=control
echo   • 대형 TV 전광판 뷰    : http://[사내망IP]:3000/?view=wallboard
echo ============================================================================
pause
