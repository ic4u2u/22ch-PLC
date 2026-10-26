"use client";

/**
 * [파일 4] src/components/Dashboard24.tsx
 * 역할: ACSC 24채널 특수가스 스마트 관제 시스템 올인원 엔터프라이즈 메인 컨테이너
 *  - URL 쿼리 (?view=wallboard) 감지 시 상단 탭을 숨긴 전체화면 대형 전광판 TV 뷰로 즉시 시작
 *  - 일반 접속 (?view=control) 시 상단 제어 바 + 6대 메인 탭 + 하단 3대 이력 테이블 렌더링
 *  - WebSocket(Port 4000) 실시간 0.5초 연동 및 REST API 이력/진단 조회
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertItem,
  AuditLogItem,
  BankConfig,
  ChannelData,
  DiagnosticsData,
  HistoryLogItem,
  LeakTestLogItem,
  MonthlySummaryItem,
  PressureUnit,
  ReplacementLogItem,
  playAlarmBeep,
  speakKoreanAlarm,
} from "./dashboard/types";
import {
  INITIAL_ALERTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_BANKS,
  INITIAL_CHANNELS,
  INITIAL_DIAGNOSTICS,
  INITIAL_HISTORY_LOGS,
  INITIAL_LEAK_LOGS,
  INITIAL_MONTHLY_SUMMARY,
  INITIAL_REPLACEMENTS,
} from "./dashboard/mockPreset";
import HeaderBar from "./dashboard/HeaderBar";
import HardwareGuideModal from "./dashboard/HardwareGuideModal";
import {
  ChannelDetailModal,
  MobileAndFaModal,
  PinAuthModal,
} from "./dashboard/SystemModals";
import ChannelGridTab from "./dashboard/ChannelGridTab";
import BankManifoldTab from "./dashboard/BankManifoldTab";
import LeakTestTab from "./dashboard/LeakTestTab";
import WallboardView from "./dashboard/WallboardView";
import FloorplanTab from "./dashboard/FloorplanTab";
import HistoryReportTab from "./dashboard/HistoryReportTab";
import BottomLogsSection from "./dashboard/BottomLogsSection";

type MainTab =
  | "GRID"
  | "MANIFOLD"
  | "LEAK_TEST"
  | "WALLBOARD"
  | "FLOORPLAN"
  | "HISTORY_REPORT";

export default function Dashboard24() {
  const [activeTab, setActiveTab] = useState<MainTab>("GRID");
  const [isStandaloneWallboard, setIsStandaloneWallboard] = useState(false);

  // 10번 스펙: FND 4단위 원클릭 변환기 (기본 1: Bar)
  const [unit, setUnit] = useState<PressureUnit>(1);

  // PIN 잠금 상태 (기본 "1234", 해제 시 300초 카운트다운)
  const [adminPin, setAdminPin] = useState("1234");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockRemainSec, setUnlockRemainSec] = useState(0);
  const [pinModalOpen, setPinModalOpen] = useState(false);

  // 한국어 TTS 음성안내 토글 상태
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const lastSpokenRef = useRef<number>(0);

  // 모달 상태
  const [hardwareModalOpen, setHardwareModalOpen] = useState(false);
  const [mobileOrFaModal, setMobileOrFaModal] = useState<"MOBILE" | "FA" | null>(
    null
  );
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(
    null
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 실시간 데이터 및 설정 상태
  const [channels, setChannels] = useState<ChannelData[]>(INITIAL_CHANNELS);
  const [banks, setBanks] = useState<BankConfig[]>(INITIAL_BANKS);
  const [diagnostics, setDiagnostics] =
    useState<DiagnosticsData>(INITIAL_DIAGNOSTICS);
  const [floorplanBg, setFloorplanBg] = useState<string>("");
  const [faSavedAt, setFaSavedAt] = useState<string | null>(null);

  // 채널별 최근 1분(120포인트, 0.5초 주기) 트렌드 버퍼
  const trendMapRef = useRef<Record<number, number[]>>({});

  // 하단 3대 로그 & 성적서 & 타임머신 이력 (초기 시연 프리셋 탑재)
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(INITIAL_AUDIT_LOGS);
  const [replacements, setReplacements] =
    useState<ReplacementLogItem[]>(INITIAL_REPLACEMENTS);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryItem[]>(
    INITIAL_MONTHLY_SUMMARY
  );
  const [leakLogs, setLeakLogs] = useState<LeakTestLogItem[]>(INITIAL_LEAK_LOGS);
  const [historyLogs, setHistoryLogs] =
    useState<HistoryLogItem[]>(INITIAL_HISTORY_LOGS);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  }, []);

  // URL 쿼리 (?view=wallboard) 감지하여 2번 모니터 대형 전광판 뷰 자동 전환
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "wallboard") {
        setIsStandaloneWallboard(true);
        setActiveTab("WALLBOARD");
      }
    }
  }, []);

  // PIN 잠금 해제 후 5분(300초) 카운트다운 타이머
  useEffect(() => {
    if (!isUnlocked) return;
    const timer = setInterval(() => {
      setUnlockRemainSec((prev) => {
        if (prev <= 1) {
          setIsUnlocked(false);
          showToast("🔒 5분 경과로 관리자 잠금이 자동 활성화되었습니다.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isUnlocked, showToast]);

  // REST API로 SQLite 이력 데이터 조회
  const fetchAllLogs = useCallback(async () => {
    const baseUrl =
      typeof window !== "undefined"
        ? `http://${window.location.hostname}:4000`
        : "http://localhost:4000";
    try {
      const [audRes, repRes, leakRes, histRes] = await Promise.all([
        fetch(`${baseUrl}/api/audit`),
        fetch(`${baseUrl}/api/replacements`),
        fetch(`${baseUrl}/api/leak-tests`),
        fetch(`${baseUrl}/api/history?limit=180`),
      ]);
      if (audRes.ok) setAuditLogs((await audRes.json()).logs || []);
      if (repRes.ok) {
        const repData = await repRes.json();
        setReplacements(repData.logs || []);
        setMonthlySummary(repData.monthlySummary || []);
      }
      if (leakRes.ok) setLeakLogs((await leakRes.json()).logs || []);
      if (histRes.ok) setHistoryLogs((await histRes.json()).logs || []);
    } catch {
      // 브릿지 서버 미기동 상태에서도 프론트엔드가 멈추지 않도록 안전 처리
    }
  }, []);

  // WebSocket 연결 및 실시간 0.5초 패킷 수신
  useEffect(() => {
    fetchAllLogs();
    const logRefreshInterval = setInterval(fetchAllLogs, 6000);

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      const wsHost =
        typeof window !== "undefined" ? window.location.hostname : "localhost";
      ws = new WebSocket(`ws://${wsHost}:4000`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "INIT_STATE") {
            const p = msg.payload;
            if (p.diagnostics) setDiagnostics(p.diagnostics);
            if (p.channels?.length) setChannels(p.channels);
            if (p.banks?.length) setBanks(p.banks);
            if (p.recentAlerts) setAlerts(p.recentAlerts);
            if (p.settings?.floorplan_bg?.dataUrl !== undefined) {
              setFloorplanBg(p.settings.floorplan_bg.dataUrl);
            }
            if (p.settings?.fa_preset?.savedAt) {
              setFaSavedAt(p.settings.fa_preset.savedAt.slice(0, 19).replace("T", " "));
            }
            if (p.settings?.admin_pin) setAdminPin(p.settings.admin_pin);
          } else if (msg.type === "REALTIME_TICK") {
            const { diagnostics: diag, channels: chs, banks: bks } = msg.payload;
            if (diag) setDiagnostics(diag);
            if (bks?.length) setBanks(bks);
            if (chs?.length) {
              setChannels(chs);
              // 1분 트렌드 버퍼 업데이트 (최대 120개 포인트 = 60초)
              chs.forEach((c: ChannelData) => {
                const arr = trendMapRef.current[c.id] || [];
                arr.push(c.pressureBar);
                if (arr.length > 120) arr.shift();
                trendMapRef.current[c.id] = arr;
              });
            }
          } else if (msg.type === "ALERT") {
            const alertItem: AlertItem = msg.payload;
            setAlerts((prev) => [alertItem, ...prev].slice(0, 100));
            showToast(alertItem.message);
          } else if (msg.type === "SETTINGS_SYNC") {
            if (msg.payload.floorplan_bg?.dataUrl !== undefined) {
              setFloorplanBg(msg.payload.floorplan_bg.dataUrl);
            }
            if (msg.payload.fa_preset?.savedAt) {
              setFaSavedAt(
                msg.payload.fa_preset.savedAt.slice(0, 19).replace("T", " ")
              );
            }
            fetchAllLogs();
          } else if (msg.type === "LEAK_TEST_SAVED") {
            fetchAllLogs();
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 2500);
      };
    };

    connectWs();

    return () => {
      clearInterval(logRefreshInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [fetchAllLogs, showToast]);

  // Vercel 클라우드 배포 시(로컬 브릿지 서버 미연결 시) 의뢰자 시연용 실시간 가상 PLC 시뮬레이터 자동 구동
  useEffect(() => {
    if (wsConnected) return;
    let demoTick = 0;
    const simTimer = setInterval(() => {
      demoTick += 1;
      setChannels((prev) =>
        prev.map((ch, idx) => {
          // 22번 채널(마지막 채널) 20초 주기 SENSOR_FAULT 시뮬레이션
          if (idx === prev.length - 1 && ch.valveState === 0) {
            const cycle = demoTick % 20;
            if (cycle >= 0 && cycle < 3) {
              const isSpike = cycle % 2 === 1;
              return {
                ...ch,
                rawBar: isSpike ? 195.0 : 0.0,
                pressureBar: isSpike ? 195.0 : 0.0,
                status: "SENSOR_FAULT",
                faultReason: isSpike
                  ? "측정 한계 115% 초과 스파이크 (195.0 bar)"
                  : "4~20mA 전류 루프 단선 (0.0 bar 급락)",
                remainingText: "센서 점검 필요",
              };
            }
          }

          if (ch.valveState === 1) {
            return { ...ch, pressureBar: 0, status: "SHUTOFF", remainingText: "밸브 차단됨" };
          }

          const isOdd = ch.id % 2 === 1;
          let nextRaw = ch.rawBar;
          if (isOdd) {
            const drop = ch.id === 1 ? 1.8 : ch.id === 3 ? 1.1 : 0.3;
            nextRaw = Number((ch.rawBar - drop).toFixed(1));
            if (nextRaw <= 7.0) nextRaw = 150.0; // 실린더 자동 리필 시뮬레이션
          } else if (idx === prev.length - 1 && nextRaw !== 120.0) {
            nextRaw = 120.0;
          }

          const calBar = Number(Math.max(0, nextRaw + (ch.calibrationOffset || 0)).toFixed(1));
          let status: ChannelData["status"] = "NORMAL";
          if (calBar <= ch.dangerBar) status = "DANGER";
          else if (calBar <= ch.warnBar) status = "WARN";

          // 트렌드 버퍼 적재
          const arr = trendMapRef.current[ch.id] || [];
          arr.push(calBar);
          if (arr.length > 120) arr.shift();
          trendMapRef.current[ch.id] = arr;

          return {
            ...ch,
            rawBar: nextRaw,
            pressureBar: calBar,
            status,
            faultReason: null,
          };
        })
      );
    }, 1000);
    return () => clearInterval(simTimer);
  }, [wsConnected]);

  // 위험(DANGER) 및 센서고장(SENSOR_FAULT) 감지 시 한국어 TTS 음성 방송 + Web Audio 비프음
  useEffect(() => {
    if (!ttsEnabled) return;
    const now = Date.now();
    // 과도한 반복 방송 방지를 위해 12초 간격 쿨다운 적용
    if (now - lastSpokenRef.current < 12000) return;

    const dangerCh = channels.find((c) => c.status === "DANGER");
    const faultCh = channels.find((c) => c.status === "SENSOR_FAULT");

    if (dangerCh) {
      lastSpokenRef.current = now;
      playAlarmBeep("DANGER");
      speakKoreanAlarm(
        `경고! ${dangerCh.id}번 채널 ${dangerCh.gasName} 압력이 위험 기준 이하입니다.`
      );
    } else if (faultCh) {
      lastSpokenRef.current = now;
      playAlarmBeep("FAULT");
      speakKoreanAlarm(
        `점검 요망! ${faultCh.id}번 채널 압력 센서 신호 이상이 감지되었습니다.`
      );
    }
  }, [channels, ttsEnabled]);

  const sendWsCommand = (type: string, payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
      return;
    }
    // Vercel 클라우드 시연 모드일 때 로컬 이력(감사로그/성적서/FA복원)에 즉시 반영
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    if (type === "SAVE_LEAK_TEST") {
      setLeakLogs((prev) => [
        {
          id: Date.now(),
          timestamp: ts,
          channel_id: Number(payload.channelId || 1),
          gas_name: String(payload.gasName || "특수가스"),
          duration_sec: Number(payload.durationSec || 30),
          start_pressure: Number(payload.startPressure || 120),
          end_pressure: Number(payload.endPressure || 120),
          delta_pressure: Number(payload.deltaPressure || 0),
          threshold_bar: Number(payload.thresholdBar || 0.2),
          result: (payload.result as "PASS" | "FAIL") || "PASS",
          inspector: String(payload.inspector || "ADMIN"),
        },
        ...prev,
      ]);
    } else if (type === "RESTORE_FA_PRESET") {
      // 17번: 영점 보정값(calibrationOffset)은 보존하고 운전 설정만 FA 표준값으로 복원
      setChannels((prev) =>
        INITIAL_CHANNELS.map((faCh, idx) => ({
          ...faCh,
          calibrationOffset: prev[idx]?.calibrationOffset ?? 0.0,
        }))
      );
      setBanks(INITIAL_BANKS);
    } else if (type === "SAVE_FA_PRESET") {
      setFaSavedAt(ts);
    }
    setAuditLogs((prev) => [
      {
        id: Date.now(),
        timestamp: ts,
        actor: String(payload.actor || "ADMIN"),
        action_type: type,
        target: String(payload.target || payload.id || `CH-${payload.channelId || "ALL"}`),
        detail: String(payload.detail || payload.reason || `${type} 실행 완료`),
      },
      ...prev,
    ]);
  };

  const dangerCount = channels.filter((c) => c.status === "DANGER").length;
  const faultCount = channels.filter((c) => c.status === "SENSOR_FAULT").length;
  const selectedChannel =
    channels.find((c) => c.id === selectedChannelId) || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      {/* 토스트 알림 팝업 */}
      {toastMsg && (
        <div className="no-print fixed bottom-5 right-5 z-50 max-w-md rounded-2xl border border-cyan-400/60 bg-slate-900/95 px-4 py-3 text-xs font-extrabold text-cyan-200 shadow-2xl">
          {toastMsg}
        </div>
      )}

      {/* ?view=wallboard 전용 전체화면 모드일 때는 상단 헤더와 탭을 숨기고 전광판 뷰만 렌더링 */}
      {isStandaloneWallboard ? (
        <main className="mx-auto max-w-[1920px] p-4">
          <WallboardView
            channels={channels}
            unit={unit}
            diagnostics={diagnostics}
            isStandaloneWallboard={true}
            onExitWallboard={() => setIsStandaloneWallboard(false)}
          />
        </main>
      ) : (
        <>
          {/* 1. 상단 헤더 제어 바 */}
          <HeaderBar
            unit={unit}
            onChangeUnit={setUnit}
            isUnlocked={isUnlocked}
            unlockRemainSec={unlockRemainSec}
            onClickPinToggle={() => {
              if (isUnlocked) {
                setIsUnlocked(false);
                setUnlockRemainSec(0);
                showToast("🔒 관리자 잠금이 활성화되었습니다.");
              } else {
                setPinModalOpen(true);
              }
            }}
            ttsEnabled={ttsEnabled}
            onToggleTts={() => {
              const next = !ttsEnabled;
              setTtsEnabled(next);
              if (next) {
                speakKoreanAlarm("한국어 음성 경보 안내가 활성화되었습니다.");
              }
            }}
            diagnostics={diagnostics}
            onOpenHardwareModal={() => setHardwareModalOpen(true)}
            onOpenMobileModal={() => setMobileOrFaModal("MOBILE")}
            onOpenFaModal={() => setMobileOrFaModal("FA")}
            dangerCount={dangerCount}
            faultCount={faultCount}
          />

          <main className="mx-auto max-w-[1920px] px-4 pt-4">
            {/* 2. 6대 메인 탭 네비게이션 */}
            <nav className="no-print mb-4 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-2">
              {[
                { id: "GRID", label: "🟢 22채널 그리드" },
                { id: "MANIFOLD", label: "🔀 11뱅크 A/B 매니폴드 뷰" },
                { id: "LEAK_TEST", label: "🧪 기밀/누출 시험" },
                { id: "WALLBOARD", label: "📺 대형 전광판 TV 뷰" },
                { id: "FLOORPLAN", label: "🗺️ 공장 도면 뷰" },
                { id: "HISTORY_REPORT", label: "⏪ 과거 이력 & 📄 PDF 보고서" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as MainTab)}
                  className={`min-h-[44px] flex-1 min-w-[150px] rounded-xl px-4 py-2 text-xs sm:text-sm font-extrabold transition-all ${
                    activeTab === t.id
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {/* 3. 선택된 메인 탭 렌더링 */}
            {activeTab === "GRID" && (
              <ChannelGridTab
                channels={channels}
                unit={unit}
                isUnlocked={isUnlocked}
                onSelectChannel={(ch) => setSelectedChannelId(ch.id)}
                onRequestPin={() => setPinModalOpen(true)}
                onToggleValve={(channelId, nextValveState) => {
                  setChannels((prev) =>
                    prev.map((c) =>
                      c.id === channelId
                        ? {
                            ...c,
                            valveState: nextValveState,
                            pressureBar: nextValveState === 1 ? 0 : c.rawBar,
                            status: nextValveState === 1 ? "SHUTOFF" : "NORMAL",
                          }
                        : c
                    )
                  );
                  sendWsCommand("SET_VALVE", {
                    channelId,
                    valveState: nextValveState,
                    actor: "ADMIN",
                    reason: "대시보드 원격 밸브 제어",
                  });
                  showToast(
                    `🛠️ CH-${String(channelId).padStart(2, "0")} 밸브 ${
                      nextValveState === 0 ? "개방(OPEN)" : "차단(SHUTOFF)"
                    } 명령 전송 완료`
                  );
                }}
              />
            )}

            {activeTab === "MANIFOLD" && (
              <BankManifoldTab
                banks={banks}
                channels={channels}
                unit={unit}
                isUnlocked={isUnlocked}
                onRequestPin={() => setPinModalOpen(true)}
                onUpdateBank={(bankId, updates, detail) => {
                  setBanks((prev) =>
                    prev.map((b) => (b.id === bankId ? { ...b, ...updates } : b))
                  );
                  sendWsCommand("UPDATE_BANK_CONFIG", {
                    id: bankId,
                    updates,
                    detail,
                    actor: "ADMIN",
                  });
                  showToast(`✅ ${detail}`);
                }}
              />
            )}

            {activeTab === "LEAK_TEST" && (
              <LeakTestTab
                channels={channels}
                leakLogs={leakLogs}
                onSaveLeakTest={(record) => {
                  sendWsCommand("SAVE_LEAK_TEST", record);
                  showToast(
                    `📜 CH-${String(record.channelId).padStart(
                      2,
                      "0"
                    )} 기밀 시험 성적서(${record.result}) 영구 저장 완료`
                  );
                  setTimeout(fetchAllLogs, 500);
                }}
              />
            )}

            {activeTab === "WALLBOARD" && (
              <WallboardView
                channels={channels}
                unit={unit}
                diagnostics={diagnostics}
                isStandaloneWallboard={false}
              />
            )}

            {activeTab === "FLOORPLAN" && (
              <FloorplanTab
                channels={channels}
                unit={unit}
                floorplanBg={floorplanBg}
                isUnlocked={isUnlocked}
                onSelectChannel={(ch) => setSelectedChannelId(ch.id)}
                onRequestPin={() => setPinModalOpen(true)}
                onSyncFloorplan={(payload) => {
                  if (payload.floorplan_bg !== undefined) {
                    setFloorplanBg(payload.floorplan_bg);
                  }
                  if (payload.channel_configs) {
                    setChannels(payload.channel_configs);
                  }
                  sendWsCommand("UPDATE_FLOORPLAN", payload);
                }}
              />
            )}

            {activeTab === "HISTORY_REPORT" && (
              <HistoryReportTab
                channels={channels}
                historyLogs={historyLogs}
                monthlySummary={monthlySummary}
                leakLogs={leakLogs}
                onRefreshHistory={fetchAllLogs}
              />
            )}

            {/* 4. 하단 3대 이력 테이블 & 엑셀(CSV, UTF-8 BOM) 원클릭 다운로드 */}
            <BottomLogsSection
              alerts={alerts}
              replacements={replacements}
              monthlySummary={monthlySummary}
              auditLogs={auditLogs}
              onRefreshAllLogs={fetchAllLogs}
            />
          </main>
        </>
      )}

      {/* 모달 1: [📡 통신진단 & 하드웨어 가이드] (2 LAN, HDMI+DP, XBL-EMTA LED 진단표) */}
      <HardwareGuideModal
        open={hardwareModalOpen}
        onClose={() => setHardwareModalOpen(false)}
        diagnostics={diagnostics}
      />

      {/* 모달 2: 유지보수자 4자리 PIN 인증 */}
      <PinAuthModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        adminPin={adminPin}
        onSuccessUnlock={() => {
          setIsUnlocked(true);
          setUnlockRemainSec(300); // 5분(300초) 카운트다운
          sendWsCommand("AUDIT_EVENT", {
            actor: "ADMIN",
            actionType: "PIN_UNLOCK",
            target: "DASHBOARD",
            detail: "유지보수자 4자리 PIN 잠금 해제 성공 (5분간 유효)",
          });
          showToast("🔓 관리자 PIN 인증 완료! 5분(300초) 동안 조작이 활성화됩니다.");
        }}
      />

      {/* 모달 3: 모바일 접속 주소 & FA 표준값 저장(16번)/복원(17번) */}
      <MobileAndFaModal
        mode={mobileOrFaModal}
        onClose={() => setMobileOrFaModal(null)}
        diagnostics={diagnostics}
        isUnlocked={isUnlocked}
        faSavedAt={faSavedAt}
        onSaveFaPreset={() => {
          sendWsCommand("SAVE_FA_PRESET", {});
          showToast("💾 16) 현재 운전 및 채널 설정을 FA 표준값으로 저장했습니다.");
        }}
        onRestoreFaPreset={() => {
          sendWsCommand("RESTORE_FA_PRESET", {});
          showToast(
            "♻️ 17) 영점 보정값(calibrationOffset)은 보존하고 운전 설정만 FA 표준값으로 복원했습니다."
          );
        }}
      />

      {/* 모달 4: 채널 SVG 1분 트렌드 차트 & ±0.1bar / 2차 확인 0점 설정 */}
      <ChannelDetailModal
        channel={selectedChannel}
        trendHistory={
          selectedChannel ? trendMapRef.current[selectedChannel.id] || [] : []
        }
        unit={unit}
        isUnlocked={isUnlocked}
        onClose={() => setSelectedChannelId(null)}
        onUpdateChannel={(id, updates, detail, actionType) => {
          setChannels((prev) =>
            prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
          );
          sendWsCommand("UPDATE_CHANNEL_CONFIG", {
            id,
            updates,
            detail,
            actionType,
            actor: "ADMIN",
          });
          showToast(`🎯 CH-${String(id).padStart(2, "0")} ${detail}`);
        }}
      />
    </div>
  );
}
