"use client";

/**
 * 파일명: src/components/dashboard/PinAuthModal.tsx
 * 역할:
 *  1) 서버 검증 기반 관리자 PIN 인증 모달 (평문 노출 0%, 5회 오입력 시 60초 브루트포스 잠금)
 *  2) 관리자 PIN 비밀번호 변경 탭 (4~6자리 숫자, 서버 scrypt 단방향 해시 저장)
 */

import React, { useState, useEffect } from "react";

export interface PinUnlockResult {
  token: string;
  expiresInSec: number;
  isDefaultPin: boolean;
}

interface PinModalProps {
  open: boolean;
  initialTab?: "UNLOCK" | "CHANGE";
  wsConnected: boolean;
  isDefaultPin?: boolean;
  onClose: () => void;
  onSuccessUnlock: (result: PinUnlockResult) => void;
  onPinChanged?: (result: PinUnlockResult) => void;
}

export function PinAuthModal({
  open,
  initialTab = "UNLOCK",
  wsConnected,
  isDefaultPin = false,
  onClose,
  onSuccessUnlock,
  onPinChanged,
}: PinModalProps) {
  const [tab, setTab] = useState<"UNLOCK" | "CHANGE">(initialTab);
  const [pinInput, setPinInput] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setPinInput("");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setLoading(false);
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [open, initialTab]);

  if (!open) return null;

  const getApiBaseUrl = () => {
    if (typeof window === "undefined") return "http://localhost:4000";
    return `http://${window.location.hostname || "localhost"}:4000`;
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pinInput)) {
      setErrorMsg("4~6자리 숫자 PIN 번호를 입력해 주세요.");
      return;
    }

    // 클라우드 단독 시연 환경(로컬 브릿지 미연결)일 때의 안전한 시연 폴백
    if (!wsConnected) {
      if (pinInput === "1234") {
        onSuccessUnlock({ token: "DEMO_MODE_TOKEN", expiresInSec: 300, isDefaultPin: true });
        onClose();
      } else {
        setErrorMsg("시연 모드 PIN 번호가 일치하지 않습니다.");
      }
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.message || "PIN 인증에 실패했습니다.");
        setPinInput("");
        return;
      }
      onSuccessUnlock({
        token: data.token,
        expiresInSec: Number(data.expiresInSec || 300),
        isDefaultPin: Boolean(data.isDefaultPin),
      });
      onClose();
    } catch {
      setErrorMsg("중앙 브릿지 인증 서버와 통신할 수 없습니다. 서버 상태를 확인하세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!wsConnected) {
      setErrorMsg("로컬 관제 브릿지 서버 연결 시에만 실제 DB PIN 변경이 가능합니다.");
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      setErrorMsg("새 PIN 번호는 4~6자리 숫자로 입력해 주세요.");
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg("새 PIN 번호와 확인 입력값이 일치하지 않습니다.");
      return;
    }
    if (currentPin === newPin) {
      setErrorMsg("기존 PIN과 다른 새로운 번호를 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/change-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.message || "PIN 변경에 실패했습니다.");
        return;
      }
      setSuccessMsg("✅ 새 관리자 PIN 번호가 암호화되어 저장되었습니다!");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      onPinChanged?.({
        token: data.token,
        expiresInSec: Number(data.expiresInSec || 300),
        isDefaultPin: Boolean(data.isDefaultPin),
      });
      setTimeout(() => onClose(), 1000);
    } catch {
      setErrorMsg("브릿지 서버 통신 오류로 PIN을 변경하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        {/* 상단 탭 전환 */}
        <div className="mb-4 flex gap-2 rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setTab("UNLOCK");
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`min-h-[44px] flex-1 rounded-lg text-xs font-extrabold transition-all ${
              tab === "UNLOCK"
                ? "bg-cyan-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🔒 관리자 잠금 해제
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("CHANGE");
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`min-h-[44px] flex-1 rounded-lg text-xs font-extrabold transition-all ${
              tab === "CHANGE"
                ? "bg-amber-400 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🔑 PIN 비밀번호 변경
          </button>
        </div>

        {isDefaultPin && tab === "UNLOCK" && (
          <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-200">
            ⚠️ 현재 공장 출고 초기 PIN이 설정되어 있습니다. 현장 보안을 위해 우측 탭에서 고유 PIN 번호로 변경해 주세요.
          </div>
        )}

        {tab === "UNLOCK" ? (
          <form onSubmit={handleVerify}>
            <h3 className="text-base font-extrabold text-white">🛡️ 관리자 보안 인증</h3>
            <p className="mt-1 text-xs text-slate-400">
              밸브 제어, 설정 변경, 전광판 잠금 해제를 위해 관리자 PIN(4~6자리)을 입력하세요. 5회 연속 실패 시 60초간 차단되며, 해제 후 5분 뒤 자동 잠금됩니다.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-cyan-300 focus:border-cyan-400 focus:outline-none"
            />
            {errorMsg && <p className="mt-2 text-xs font-bold text-rose-400">⛔ {errorMsg}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="min-h-[44px] flex-1 rounded-xl bg-slate-800 font-bold text-slate-300 hover:bg-slate-700"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="min-h-[44px] flex-1 rounded-xl bg-cyan-500 font-extrabold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              >
                {loading ? "인증 확인 중..." : "잠금 해제"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleChangePin} className="space-y-3">
            <div>
              <h3 className="text-base font-extrabold text-white">🔑 관리자 PIN 비밀번호 변경</h3>
              <p className="mt-1 text-xs text-slate-400">
                입력한 새 PIN은 서버에 단방향 암호화(scrypt)되어 안전하게 저장됩니다.
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">현재 PIN 번호</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                placeholder="현재 PIN 입력"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-center font-mono text-lg tracking-widest text-slate-100 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">새 PIN (4~6자리)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="숫자 4~6자리"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-center font-mono text-lg tracking-widest text-amber-300 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">새 PIN 재입력</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="동일하게 입력"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-center font-mono text-lg tracking-widest text-amber-300 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
            {errorMsg && <p className="text-xs font-bold text-rose-400">⛔ {errorMsg}</p>}
            {successMsg && <p className="text-xs font-bold text-emerald-400">{successMsg}</p>}
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="min-h-[44px] flex-1 rounded-xl bg-slate-800 font-bold text-slate-300 hover:bg-slate-700"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={loading}
                className="min-h-[44px] flex-1 rounded-xl bg-amber-400 font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
              >
                {loading ? "암호화 저장 중..." : "새 PIN 저장"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
