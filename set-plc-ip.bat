@echo off
chcp 65001 >nul
title [ACSC 24CH] 큐텍 LAN 1 포트 - LS PLC(XBL-EMTA) 1:1 직결 고정 IP 설정기

echo ============================================================================
echo [ACSC 24채널 특수가스 관제 시스템] PLC 1:1 직결용 고정 IP 원클릭 설정
echo   - 대상 어댑터 : 이더넷 (필요 시 아래 ADAPTER_NAME 변수 수정 가능)
echo   - PC 고정 IP  : 192.168.0.100
echo   - 서브넷 마스크: 255.255.255.0
echo   - 기본 게이트웨이: 없음 (LAN 2 사내 공유기 인터넷 끊김 방지)
echo   - PLC 목표 IP : 192.168.0.50 (LS ELECTRIC XBL-EMTA)
echo ============================================================================

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [오류] 이 스크립트는 우클릭 후 [관리자 권한으로 실행]해야 합니다!
    pause
    exit /b 1
)

set "ADAPTER_NAME=이더넷"

echo [진행] "%ADAPTER_NAME%" 어댑터에 고정 IP (192.168.0.100 / 255.255.255.0 / 게이트웨이 없음) 설정 중...
netsh interface ip set address name="%ADAPTER_NAME%" static 192.168.0.100 255.255.255.0 none

if %errorLevel% equ 0 (
    echo.
    echo ✅ [%ADAPTER_NAME%] 어댑터 고정 IP 설정이 완료되었습니다!
    echo    이제 LS PLC(192.168.0.50)와 1:1 통신을 테스트합니다...
    ping -n 3 192.168.0.50
) else (
    echo.
    echo ⚠️ "%ADAPTER_NAME%" 어댑터를 찾지 못했습니다. 현재 PC의 어댑터 이름을 확인해 주세요:
    netsh interface show interface
)

echo ============================================================================
pause
