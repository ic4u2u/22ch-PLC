"use client";

/**
 * 파일명: src/components/dashboard/HardwareGuideModal.tsx
 * 역할: [📡 통신진단 & 하드웨어 가이드] 모달
 *  1) 실시간 PLC 통신 진단 (응답 지연시간 ms, 사내망 IP, SQLite DB 용량)
 *  2) 랜선 연결 (2 LAN: LAN 1 PLC 1:1 직결 / LAN 2 사내 공유기 DHCP) 시각적 결선 안내도
 *  3) 듀얼 모니터 연결 (HDMI + DP: 모니터1 조작 대시보드 / 모니터2 대형 TV 전광판) 시각적 결선도
 *  4) LS ELECTRIC XBL-EMTA 전면 LED (RUN, I/F, ERR, TX, RX, Link, Speed) 상태 진단표
 */

import React, { useState } from "react";
import { DiagnosticsData } from "./types";

interface HardwareGuideModalProps {
  open: boolean;
  onClose: () => void;
  diagnostics: DiagnosticsData;
}

export default function HardwareGuideModal({
  open,
  onClose,
  diagnostics,
}: HardwareGuideModalProps) {
  const [subTab, setSubTab] = useState<"ALL" | "LAN" | "MONITOR" | "LED">("ALL");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        {/* 모달 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-cyan-300">
              📡 PLC 실시간 통신진단 & 큐텍 산업용 PC 하드웨어 결선 가이드
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              초보 현장 작업자도 그림만 보고 바로 연결할 수 있는 듀얼랜(2 LAN) · 듀얼모니터(HDMI+DP) · XBL-EMTA LED 점검 안내서
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700"
          >
            ✕ 닫기
          </button>
        </div>

        {/* 상단 실시간 통신 진단 요약 바 */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs text-slate-400">PLC 연결 상태</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-extrabold">
              <span
                className={`h-3 w-3 rounded-full ${
                  diagnostics.plcConnected ? "bg-emerald-400 animate-ping" : "bg-rose-500"
                }`}
              />
              <span className={diagnostics.plcConnected ? "text-emerald-300" : "text-rose-400"}>
                {diagnostics.plcConnected ? "정상 연결됨 (ONLINE)" : "연결 끊김 (OFFLINE)"}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              프로토콜: {diagnostics.protocol} ({diagnostics.plcIp}:{diagnostics.plcPort})
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs text-slate-400">실시간 PLC 응답 속도</div>
            <div className="mt-1 font-mono text-xl font-black text-cyan-300">
              {diagnostics.latencyMs} <span className="text-xs font-normal">ms</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">0.5초 주기 고속 폴링 중</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs text-slate-400">관제 PC 사내망 IP (LAN 2)</div>
            <div className="mt-1 font-mono text-base font-bold text-amber-300">
              {diagnostics.primaryLanIp}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              감지된 어댑터 {diagnostics.lanInterfaces.length}개
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs text-slate-400">SQLite WAL DB 용량</div>
            <div className="mt-1 font-mono text-base font-bold text-indigo-300">
              {diagnostics.dbSizeKB} KB ({diagnostics.dbSizeMB} MB)
            </div>
            <div className="mt-1 text-[11px] text-slate-500">24시간 주기 무중단 자동 백업</div>
          </div>
        </div>

        {/* 서브 탭 선택 */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: "ALL", label: "📋 전체 한눈에 보기" },
            { id: "LAN", label: "🔌 1. 듀얼 랜선 연결 (2 LAN)" },
            { id: "MONITOR", label: "🖥️ 2. 듀얼 모니터 연결 (HDMI+DP)" },
            { id: "LED", label: "💡 3. XBL-EMTA LED 상태 진단표" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as "ALL" | "LAN" | "MONITOR" | "LED")}
              className={`min-h-[40px] rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                subTab === t.id
                  ? "bg-cyan-500 text-slate-950"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-5">
          {/* 섹션 1: 듀얼 랜선 연결 (2 LAN) 시각적 결선 안내도 */}
          {(subTab === "ALL" || subTab === "LAN") && (
            <section className="rounded-2xl border border-cyan-500/30 bg-slate-950/90 p-4">
              <h3 className="text-sm font-extrabold text-cyan-300">
                🔌 1. 랜선 연결 안내도 (큐텍 미니 PC 후면 2 LAN 포트)
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* LAN 1 카드 */}
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-extrabold text-emerald-300">
                      LAN 1 포트 (PLC 전용망)
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">
                      CAT5E S-FTP 이상 1:1 직결
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-900 p-3 text-xs font-mono">
                    <div>
                      <div className="font-bold text-white">🖥️ 관제 PC (LAN 1)</div>
                      <div className="text-emerald-300">IP: 192.168.0.100</div>
                      <div className="text-slate-400">서브넷: 255.255.255.0</div>
                      <div className="text-amber-300">게이트웨이: 비움 (공란)</div>
                    </div>
                    <div className="text-center text-emerald-400 font-sans font-bold">
                      <div>━━ CAT5E 직결 ━━▶</div>
                      <div className="text-[10px] text-slate-400">(Auto Crossover 지원, 최대 100m)</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">⚡ LS XBL-EMTA</div>
                      <div className="text-cyan-300">IP: 192.168.0.50</div>
                      <div className="text-slate-400">Modbus: 502 / XGT: 2004</div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    💡 <strong>핵심 팁:</strong> 루트 폴더의 <code className="text-amber-300">set-plc-ip.bat</code>를 우클릭하여 [관리자 권한으로 실행]하면 LAN 1 고정 IP가 원클릭으로 설정됩니다. (게이트웨이를 비워야 LAN 2 인터넷이 끊기지 않습니다!)
                  </p>
                </div>

                {/* LAN 2 카드 */}
                <div className="rounded-xl border border-blue-500/40 bg-blue-950/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-blue-500/20 px-2.5 py-1 text-xs font-extrabold text-blue-300">
                      LAN 2 포트 (사내 공유기망)
                    </span>
                    <span className="text-xs font-semibold text-blue-400">
                      자동 IP (DHCP) 할당
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-900 p-3 text-xs font-mono">
                    <div>
                      <div className="font-bold text-white">🖥️ 관제 PC (LAN 2)</div>
                      <div className="text-blue-300">자동 IP (DHCP)</div>
                      <div className="text-slate-400">현재: {diagnostics.primaryLanIp}</div>
                    </div>
                    <div className="text-center text-blue-400 font-sans font-bold">
                      <div>━━ 공유기 연결 ━━▶</div>
                      <div className="text-[10px] text-slate-400">사내 와이파이 & 인터넷</div>
                    </div>
                    <div className="text-right font-sans">
                      <div className="font-bold text-white">📱 태블릿 / 텔레그램</div>
                      <div className="text-cyan-300">원격 웹 접속 (:3000)</div>
                      <div className="text-slate-400">텔레그램 실시간 푸시</div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    💡 <strong>핵심 팁:</strong> 사무실 PC나 태블릿을 같은 공유기 와이파이에 연결한 뒤 <code className="text-cyan-300">http://{diagnostics.primaryLanIp}:3000</code>으로 접속하면 동일한 화면을 원격 관제할 수 있습니다.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* 섹션 2: 듀얼 모니터 연결 (HDMI + DP) & USB 타워램프 안내도 */}
          {(subTab === "ALL" || subTab === "MONITOR") && (
            <section className="rounded-2xl border border-indigo-500/30 bg-slate-950/90 p-4">
              <h3 className="text-sm font-extrabold text-indigo-300">
                🖥️ 2. 듀얼 모니터 (HDMI + DP) & 🚨 USB 3색 타워램프(경광등) 연결 안내도
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-cyan-500/20 px-2.5 py-1 text-xs font-bold text-cyan-300">
                      단자 1: HDMI 포트 (주 모니터)
                    </span>
                    <span className="font-mono text-xs text-slate-400">--window-position=0,0</span>
                  </div>
                  <div className="mt-2 text-sm font-bold text-white">
                    상황실 조작 대시보드 (모니터 1)
                  </div>
                  <div className="mt-1 font-mono text-xs text-cyan-400">
                    접속 주소: http://localhost:3000/?view=control
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    • 22채널 정밀 감시, 원격 밸브 개폐, 11뱅크 Smart AI 설정, 기밀 시험 및 보고서 인쇄용 주 조작 모니터입니다.
                  </p>
                </div>

                <div className="rounded-xl border border-amber-500/40 bg-amber-950/15 p-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300">
                      단자 2: DP 포트 (보조 대형 TV)
                    </span>
                    <span className="font-mono text-xs text-slate-400">--window-position=1920,0</span>
                  </div>
                  <div className="mt-2 text-sm font-bold text-white">
                    현장 대형 TV 전광판 (모니터 2)
                  </div>
                  <div className="mt-1 font-mono text-xs text-amber-300">
                    접속 주소: http://localhost:3000/?view=wallboard
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    • 대형 TV에 DP 단자가 없을 경우 <strong>[DP to HDMI 변환 케이블]</strong>을 끼워 연결하시면 완벽히 호환됩니다.
                  </p>
                </div>

                <div className="rounded-xl border border-rose-500/40 bg-rose-950/15 p-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-rose-500/20 px-2.5 py-1 text-xs font-bold text-rose-300">
                      단자 3: USB 포트 (3색 타워램프)
                    </span>
                    <span className="font-mono text-xs text-slate-400">LAMP_USB_PORT=AUTO</span>
                  </div>
                  <div className="mt-2 text-sm font-bold text-white">
                    상황실 USB 직결 3색 경광등 + 부저
                  </div>
                  <div className="mt-1 font-mono text-xs text-rose-300">
                    정상(녹색) · 주의/센서고장(황색점멸) · 위험(적색점멸+부저)
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    • 미니 PC USB 포트에 꽂기만 하면 자동 탐색(CH340/FTDI/큐라이트)되며, 상단 <strong>[🔕 부저만 끄기]</strong>로 현장 소음을 즉시 제어합니다.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* 섹션 3: XBL-EMTA 전면 LED 상태 진단표 */}
          {(subTab === "ALL" || subTab === "LED") && (
            <section className="rounded-2xl border border-emerald-500/30 bg-slate-950/90 p-4">
              <h3 className="text-sm font-extrabold text-emerald-300">
                💡 3. LS ELECTRIC `XBL-EMTA` FEnet 통신 모듈 전면 LED 상태 진단표
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900 text-slate-300">
                      <th className="p-2.5">LED 명칭</th>
                      <th className="p-2.5">색상</th>
                      <th className="p-2.5">정상 상태</th>
                      <th className="p-2.5">이상 상태 (점검 필요)</th>
                      <th className="p-2.5">의미 및 현장 조치 방법</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-emerald-300">RUN</td>
                      <td className="p-2.5">녹색 (Green)</td>
                      <td className="p-2.5 font-bold text-emerald-400">🟢 점등 (켜짐)</td>
                      <td className="p-2.5 text-rose-400">⚫ 소등 (꺼짐)</td>
                      <td className="p-2.5 text-slate-300">XBL-EMTA 모듈 전원 및 하드웨어 정상 가동 (소등 시 PLC 전원/장착 확인)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-emerald-300">I/F</td>
                      <td className="p-2.5">녹색 (Green)</td>
                      <td className="p-2.5 font-bold text-emerald-400">✨ 녹색 점멸 (깜빡임)</td>
                      <td className="p-2.5 text-rose-400">점등 고정 또는 소등</td>
                      <td className="p-2.5 text-slate-300">XGB 기본 베이스(CPU)와 통신 모듈 간 내부 인터페이스 정상 통신 중</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-rose-300">ERR</td>
                      <td className="p-2.5">적색 (Red)</td>
                      <td className="p-2.5 font-bold text-emerald-400">⚫ 소등 (꺼짐 = 정상)</td>
                      <td className="p-2.5 font-bold text-rose-400">🔴 점멸 또는 점등</td>
                      <td className="p-2.5 text-slate-300">IP 충돌 또는 모듈 이상. 점멸 시 IP(192.168.0.50) 중복 여부 및 XG5000 설정 점검</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-amber-300">TX / RX</td>
                      <td className="p-2.5">녹색/황색</td>
                      <td className="p-2.5 font-bold text-emerald-400">⚡ 빠른 점멸 (0.5초 주기)</td>
                      <td className="p-2.5 text-rose-400">⚫ 계속 소등</td>
                      <td className="p-2.5 text-slate-300">0.5초 실시간 패킷 송수신 중. 소등 시 PC LAN 1 IP(192.168.0.100) 및 방화벽 확인</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-cyan-300">Link / Speed</td>
                      <td className="p-2.5">녹색 (Green)</td>
                      <td className="p-2.5 font-bold text-emerald-400">🟢 점등 (100Mbps 연결)</td>
                      <td className="p-2.5 text-rose-400">⚫ 소등 (랜선 빠짐)</td>
                      <td className="p-2.5 text-slate-300">CAT5E 랜선 물리적 연결 상태. 소등 시 RJ45 커넥터 접촉 불량 또는 단선 점검</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
