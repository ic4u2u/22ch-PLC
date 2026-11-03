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
  TowerLampState,
  getBankFacilityMeta,
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
  INITIAL_TOWER_LAMP,
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
  const [towerLamp, setTowerLamp] = useState<TowerLampState>(INITIAL_TOWER_LAMP);
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

  // REST API로 SQLite 이력 데이터 조회 (로컬/사내망 HTTP 환경에서만 포트 4000 호출)
  const fetchAllLogs = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (
      window.location.protocol === "https:" ||
      window.location.hostname.endsWith(".vercel.app")
    ) {
      return;
    }
    const baseUrl = `http://${window.location.hostname}:4000`;
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

  // WebSocket 연결 및 실시간 0.5초 패킷 수신 (HTTPS 클라우드 환경에서는 Mixed Content 예외 없이 시뮬레이터로 자동 전환)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      window.location.protocol === "https:" ||
      window.location.hostname.endsWith(".vercel.app")
    ) {
      setWsConnected(false);
      return;
    }

    fetchAllLogs();
    const logRefreshInterval = setInterval(fetchAllLogs, 6000);

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      try {
        const wsHost = window.location.hostname || "localhost";
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
              if (p.towerLamp) setTowerLamp(p.towerLamp);
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
              const { diagnostics: diag, towerLamp: lamp, channels: chs, banks: bks } = msg.payload;
              if (diag) setDiagnostics(diag);
              if (lamp) setTowerLamp(lamp);
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
            } else if (msg.type === "TOWER_LAMP_SYNC") {
              if (msg.payload) setTowerLamp(msg.payload);
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

        ws.onerror = () => {
          setWsConnected(false);
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 2500);
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWs();

    return () => {
      clearInterval(logRefreshInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [fetchAllLogs, showToast]);

  // Vercel 클라우드 배포 시(로컬 브릿지 서버 미연결 시) 실제 현장과 동일한 A ⇄ B 오토체인지(자동절체) 컨트롤러 시뮬레이터 구동
  useEffect(() => {
    if (wsConnected) return;
    let demoTick = 0;
    const simTimer = setInterval(() => {
      demoTick += 1;
      setChannels((prev) => {
        const next = prev.map((c) => ({ ...c }));

        // 11개 뱅크(A/B 2통씩 짝지어) 순회하며 "열린 통(OPEN)만 소모 -> SV 이하 도달 시 반대통으로 자동 토글" 수행
        for (let bIdx = 0; bIdx < 11; bIdx++) {
          const idxA = bIdx * 2;
          const idxB = bIdx * 2 + 1;
          const chA = next[idxA];
          const chB = next[idxB];
          if (!chA || !chB) continue;

          // 만약 두 통 다 열려있거나 두 통 다 닫혀있다면 기본 A=OPEN, B=CLOSE로 정규화
          if (chA.valveState === chB.valveState) {
            chA.valveState = 0;
            chB.valveState = 1;
          }

          const openCh = chA.valveState === 0 ? chA : chB;
          const closeCh = chA.valveState === 0 ? chB : chA;
          const isAcetylene = bIdx === 4; // 5번 캐비넷: C2H2(아세틸렌) 만충 25bar 규격
          const fullRefillBar = isAcetylene ? 24.0 : 148.0;
          const emptyThreshold = openCh.dangerBar * 1.35;

          // 1) 현재 OPEN(주공급) 통만 가스 압력 소모
          const drop =
            bIdx === 0 ? 1.4 : bIdx === 1 ? 0.7 : isAcetylene ? 0.04 : 0.15;
          const nextOpenRaw = Number(Math.max(0, openCh.rawBar - drop).toFixed(1));
          const nextOpenCal = Number(
            Math.max(0, nextOpenRaw + (openCh.calibrationOffset || 0)).toFixed(1)
          );
          openCh.rawBar = nextOpenRaw;
          openCh.pressureBar = nextOpenCal;

          // 2) 현재 CLOSE(예비대기) 통은 압력을 그대로 유지하되, 만약 방금 다 써서 절체된 빈 통이면 N2 퍼지 후 12초 뒤 새 가스통으로 자동 교체 리필
          if (closeCh.rawBar <= emptyThreshold && demoTick % 12 === 0) {
            closeCh.rawBar = fullRefillBar;
            closeCh.pressureBar = Number(
              (fullRefillBar + (closeCh.calibrationOffset || 0)).toFixed(1)
            );
            closeCh.remainingText = `예비 대기 (새통 ${fullRefillBar}b · 기밀정상)`;
          } else {
            closeCh.pressureBar = Number(
              Math.max(0, closeCh.rawBar + (closeCh.calibrationOffset || 0)).toFixed(1)
            );
            closeCh.remainingText =
              closeCh.pressureBar <= emptyThreshold
                ? "🟢 N2퍼지완료 · 안전교체가능"
                : `예비 대기 (${closeCh.pressureBar}b · 기밀정상)`;
          }
          closeCh.status = "SHUTOFF";
          closeCh.faultReason = null;

          // 3) [핵심] OPEN된 통이 설정 기준압력(SV = dangerBar) 이하로 떨어지면 콘트롤러가 자동으로 A ⇄ B 토글(절체)!
          if (
            nextOpenCal <= openCh.dangerBar &&
            closeCh.pressureBar > openCh.dangerBar * 2.0
          ) {
            const fromSide = openCh.side;
            const toSide = closeCh.side;

            // 다 쓴 통은 CLOSE(차단)로 토글 & SEMI S2 퍼지 완료 표시
            openCh.valveState = 1;
            openCh.status = "SHUTOFF";
            openCh.remainingText = `🟢 N2퍼지완료 (${fromSide}통 안전교체가능)`;

            // 대기 중이던 만충 예비통을 OPEN(주공급)으로 즉시 토글!
            closeCh.valveState = 0;
            closeCh.status = "NORMAL";
            closeCh.remainingText = `예상절체 22:30 (±15분 · ${toSide}통 공급중)`;

            setBanks((prevBanks) =>
              prevBanks.map((b, i) =>
                i === bIdx ? { ...b, activeSide: toSide } : b
              )
            );

            showToast(
              `🔄 [오토체인지 자동 토글] ${openCh.gasName}: ${fromSide}통(${nextOpenCal}bar 저압) CLOSE ➔ 예비 ${toSide}통(${closeCh.pressureBar}bar) OPEN 자동 절체 완료!`
            );
          } else {
            // 아직 SV 기준압력 이상이면 정상/주의 상태 판정
            openCh.status =
              nextOpenCal <= openCh.dangerBar
                ? "DANGER"
                : nextOpenCal <= openCh.warnBar
                ? "WARN"
                : "NORMAL";
            openCh.faultReason = null;
            openCh.remainingText =
              openCh.status === "WARN"
                ? `예상절체 17:20 (±5분 · 곧 ${closeCh.side}통 절체)`
                : `예상절체 21:45 (±15분 · ${openCh.side}통 공급중)`;
          }

          // 22번 채널(마지막 채널) 25초 주기 4~20mA 센서 이상(SENSOR_FAULT) 시연
          if (bIdx === 10 && demoTick % 25 >= 20 && demoTick % 25 < 23) {
            chB.status = "SENSOR_FAULT";
            chB.faultReason = "4~20mA 전류 루프 단선 감지 (오차단 방지 작동)";
          }

          // 트렌드 버퍼 적재
          [chA, chB].forEach((c) => {
            const arr = trendMapRef.current[c.id] || [];
            arr.push(c.pressureBar);
            if (arr.length > 120) arr.shift();
            trendMapRef.current[c.id] = arr;
          });
        }

        return next;
      });
    }, 1000);
    return () => clearInterval(simTimer);
  }, [wsConnected, showToast]);

  // 클라우드 데모 모드일 때 22채널 상태에 맞춰 USB 3색 타워램프 상태 자동 동기화
  useEffect(() => {
    if (wsConnected) return;
    setTowerLamp((prev) => {
      if (prev.testing) return prev;
      const hasCritical = channels.some((c) => c.status === "DANGER");
      const hasWarnOrFault = channels.some(
        (c) => c.status === "WARN" || c.status === "SENSOR_FAULT"
      );
      const nextMuted = hasCritical ? prev.buzzerMuted : false;
      if (hasCritical) {
        return {
          ...prev,
          mode: "CRITICAL",
          red: "BLINK",
          yellow: hasWarnOrFault ? "BLINK" : "OFF",
          green: "OFF",
          buzzer: nextMuted ? "OFF" : "ON",
          buzzerMuted: nextMuted,
        };
      }
      if (hasWarnOrFault) {
        return {
          ...prev,
          mode: "WARNING",
          red: "OFF",
          yellow: "BLINK",
          green: "OFF",
          buzzer: "OFF",
          buzzerMuted: false,
        };
      }
      return {
        ...prev,
        mode: "NORMAL",
        red: "OFF",
        yellow: "OFF",
        green: "ON",
        buzzer: "OFF",
        buzzerMuted: false,
      };
    });
  }, [channels, wsConnected]);

  // 위험(DANGER) 및 센서고장(SENSOR_FAULT) 감지 시 Qwen3-TTS 인간형 한국어 아나운서 음성 방송 + 소프트 차임벨
  useEffect(() => {
    if (!ttsEnabled) return;
    const now = Date.now();
    // 과도한 반복 방송 방지를 위해 15초 간격 쿨다운 적용
    if (now - lastSpokenRef.current < 15000) return;

    const dangerCh = channels.find((c) => c.status === "DANGER");
    const faultCh = channels.find((c) => c.status === "SENSOR_FAULT");

    if (dangerCh) {
      lastSpokenRef.current = now;
      const bankNum = Math.ceil(dangerCh.id / 2);
      const meta = getBankFacilityMeta(bankNum);
      playAlarmBeep("DANGER");
      speakKoreanAlarm(
        `상황실 긴급 안내 말씀 드립니다. ${meta.zoneLabel} ${bankNum <= 5 ? bankNum : bankNum - 5}번, ${dangerCh.gasName} ${dangerCh.side}통의 압력이 ${dangerCh.pressureBar} 바 로 위험 기준 이하입니다. 예비 실린더 절체 상태를 확인해 주시기 바랍니다.`
      );
    } else if (faultCh) {
      lastSpokenRef.current = now;
      const bankNum = Math.ceil(faultCh.id / 2);
      const meta = getBankFacilityMeta(bankNum);
      playAlarmBeep("FAULT");
      speakKoreanAlarm(
        `상황실 안내 말씀 드립니다. ${meta.zoneLabel} ${bankNum <= 5 ? bankNum : bankNum - 5}번, ${faultCh.gasName} ${faultCh.side}통 압력 센서 신호 이상이 감지되어 밸브 오차단 방지 모드가 작동 중입니다.`
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

  // A ⇄ B 상호 토글(오토체인지) 밸브 제어 핸들러 (한쪽을 OPEN하면 같은 뱅크의 반대쪽은 자동으로 CLOSE 대기 상태로 전환하며 실제 압력은 보존)
  const handleToggleValve = (channelId: number, nextValveState: number) => {
    const bankIdx = Math.floor((channelId - 1) / 2);
    const pairChAId = bankIdx * 2 + 1;
    const pairChBId = bankIdx * 2 + 2;
    const companionId = channelId === pairChAId ? pairChBId : pairChAId;
    const companionNextState = nextValveState === 0 ? 1 : 0;

    setChannels((prev) =>
      prev.map((c) => {
        if (c.id === channelId) {
          return {
            ...c,
            valveState: nextValveState,
            status: nextValveState === 1 ? "SHUTOFF" : "NORMAL",
            remainingText:
              nextValveState === 1
                ? `예비 대기 (${c.pressureBar}b)`
                : `약 4시간 30분 (${c.side}통 공급중)`,
          };
        }
        if (c.id === companionId) {
          return {
            ...c,
            valveState: companionNextState,
            status: companionNextState === 1 ? "SHUTOFF" : "NORMAL",
            remainingText:
              companionNextState === 1
                ? `예비 대기 (${c.pressureBar}b)`
                : `약 4시간 30분 (${c.side}통 공급중)`,
          };
        }
        return c;
      })
    );

    const newActiveSide: "A" | "B" =
      (channelId === pairChAId && nextValveState === 0) ||
      (channelId === pairChBId && nextValveState === 1)
        ? "A"
        : "B";

    setBanks((prev) =>
      prev.map((b, idx) =>
        idx === bankIdx ? { ...b, activeSide: newActiveSide } : b
      )
    );

    sendWsCommand("SET_VALVE", {
      channelId,
      valveState: nextValveState,
      actor: "ADMIN",
      reason: `A⇄B 토글 절체 제어 (${newActiveSide}통 OPEN / 반대통 CLOSE 대기)`,
    });
    showToast(
      `🔄 BANK-${String(bankIdx + 1).padStart(2, "0")} 토글 완료: ${newActiveSide}통 [OPEN 공급중] ⇄ ${
        newActiveSide === "A" ? "B" : "A"
      }통 [CLOSE 예비대기]`
    );
  };

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
            onChangeUnit={setUnit}
            diagnostics={diagnostics}
            isStandaloneWallboard={true}
            isUnlocked={isUnlocked}
            onSelectChannel={(ch) => setSelectedChannelId(ch.id)}
            onRequestPin={() => setPinModalOpen(true)}
            onToggleValve={handleToggleValve}
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
                playAlarmBeep("FAULT");
                speakKoreanAlarm(
                  "상황실 안내 말씀 드립니다. 큐웬 쓰리 자연스러운 한국어 AI 음성 경보 방송이 활성화되었습니다."
                );
              }
            }}
            onTestVoice={() => {
              playAlarmBeep("DANGER");
              const warnList = channels.filter(
                (c) => c.status === "WARN" || c.status === "DANGER"
              );
              speakKoreanAlarm(
                `상황실 일일 교대 종합 브리핑입니다. 현재 가스캐비넷 다섯 개 라인과 오토체인지 여섯 개 라인 중, 열한 개 예비 대기통의 미세 기밀 상태는 모두 정상이며, 아세틸렌 용해가스 압력도 안전 범위입니다. 현재 압력 주의 채널은 총 ${warnList.length}건 이며, 설정 압력 도달 시 예비 실린더로 무중단 자동 토글됩니다.`
              );
              showToast("🎙️ Qwen3-TTS 교대 근무자용 AI 종합 음성 브리핑 방송 중...");
            }}
            diagnostics={diagnostics}
            towerLamp={towerLamp}
            onMuteTowerBuzzer={() => {
              setTowerLamp((prev) => ({
                ...prev,
                buzzerMuted: true,
                buzzer: "OFF",
              }));
              sendWsCommand("TOWER_LAMP_MUTE_BUZZER", {
                mute: true,
                actor: "ADMIN",
                target: "USB_TOWER_LAMP",
                detail: "경광등 적색 점멸 유지 & 내장 부저만 음소거(OFF) 처리",
              });
              showToast("🔕 USB 타워램프 부저만 음소거(OFF) 처리되었습니다. (적색 점멸 유지)");
            }}
            onTestTowerLamp={() => {
              playAlarmBeep("DANGER");
              setTowerLamp((prev) => ({
                ...prev,
                testing: true,
                mode: "TEST",
                red: "ON",
                yellow: "ON",
                green: "ON",
                buzzer: "ON",
              }));
              sendWsCommand("TOWER_LAMP_TEST", {
                actor: "ADMIN",
                target: "USB_TOWER_LAMP",
                detail: "USB 3색 타워램프(적+황+녹+부저) 3초 전체 점등 테스트 실행",
              });
              showToast("⚡ USB 3색 타워램프(적+황+녹+부저) 3초 전체 점등 테스트 중...");
              setTimeout(() => {
                setTowerLamp((prev) => ({ ...prev, testing: false }));
              }, 3000);
            }}
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
                onToggleValve={handleToggleValve}
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
                onChangeUnit={setUnit}
                diagnostics={diagnostics}
                isStandaloneWallboard={false}
                isUnlocked={isUnlocked}
                onSelectChannel={(ch) => setSelectedChannelId(ch.id)}
                onRequestPin={() => setPinModalOpen(true)}
                onToggleValve={handleToggleValve}
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
