/**
 * 파일명: server/lib/safety-interlock.js
 * 역할: 특수가스 설비 안전 인터록(Safety Interlock) 전담 모듈
 *  1) PLC 통신 두절(plcConnected === false) 상태에서 무리한 원격 밸브 조작 차단
 *  2) 반대편 예비 실린더가 저압(빈 통)이거나 센서 고장(SENSOR_FAULT)일 때 오절체 차단(가스 공급 끊김 원천 방지)
 *  3) A⇄B 절체 시 반드시 [예비통 먼저 OPEN → 오버랩 유지(350ms) → 기존통 SHUTOFF] 순차 제어(Make-Before-Break) 실행
 */

const { CHANNEL_COUNT, getSetting, setSetting, logAudit } = require("./db");

// 동일 뱅크 동시 중복 절체 명령 방지 락
const bankSwitchingLocks = new Set();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 안전 인터록 기반 A⇄B 밸브 토글/제어 실행
 */
async function executeSafeValveSwitch({
  channelId,
  requestedValveState,
  forceEmergency = false,
  runtimeState,
  writePlcValve,
  actorTag,
  pushAlert,
}) {
  if (!Number.isInteger(channelId) || channelId < 1 || channelId > CHANNEL_COUNT) {
    return { ok: false, message: "⛔ 유효하지 않은 채널 번호입니다." };
  }

  // [인터록 1] PLC 통신 두절 시 원격 밸브 제어 차단
  if (!runtimeState.plcConnected) {
    logAudit(
      actorTag,
      "SAFETY_INTERLOCK_BLOCK",
      `CH-${String(channelId).padStart(2, "0")}`,
      "PLC 통신 두절 상태에서 원격 밸브 제어 시도 안전 차단됨"
    );
    return {
      ok: false,
      message: "🚨 현재 현장 PLC와 통신이 끊긴 상태입니다. 통신 복구 전까지 원격 밸브 조작이 안전 잠금됩니다.",
    };
  }

  const bankIdx = Math.floor((channelId - 1) / 2);
  const bankId = `BANK-${String(bankIdx + 1).padStart(2, "0")}`;

  if (bankSwitchingLocks.has(bankId)) {
    return {
      ok: false,
      message: `⏳ ${bankId} 무중단 순차 절체가 이미 진행 중입니다. 잠시만 기다려 주세요.`,
    };
  }

  const pairChAId = bankIdx * 2 + 1;
  const pairChBId = bankIdx * 2 + 2;
  const targetVal = Number(requestedValveState) ? 1 : 0;

  // 작업자가 선택한 동작에 따라 새로 열릴 통(nextOpenId)과 닫힐 통(nextCloseId) 결정
  const nextOpenId =
    targetVal === 0 ? channelId : channelId === pairChAId ? pairChBId : pairChAId;
  const nextCloseId = nextOpenId === pairChAId ? pairChBId : pairChAId;
  const newActiveSide = nextOpenId === pairChAId ? "A" : "B";

  const nextOpenCh = runtimeState.channels.find((c) => c.id === nextOpenId);
  const nextCloseCh = runtimeState.channels.find((c) => c.id === nextCloseId);

  // [인터록 2] 새로 공급을 맡을 예비통의 센서 고장 또는 저압(빈 통) 여부 사전 검증
  if (nextOpenCh && !forceEmergency) {
    if (nextOpenCh.status === "SENSOR_FAULT") {
      const msg = `⛔ [안전 인터록 작동] 전환 대상인 ${nextOpenCh.name}(${nextOpenCh.gasName})에 센서 이상(${nextOpenCh.faultReason || "신호 불량"})이 감지되어 절체를 차단했습니다.`;
      logAudit(actorTag, "SAFETY_INTERLOCK_BLOCK", bankId, msg);
      return { ok: false, blockedByInterlock: true, message: msg };
    }

    const minSafeBar = Number(nextOpenCh.dangerBar || 15.0);
    if (nextOpenCh.pressureBar <= minSafeBar) {
      const msg = `⛔ [안전 인터록 작동] 전환 대상 ${nextOpenCh.name} 잔량(${nextOpenCh.pressureBar} bar)이 위험 기준(${minSafeBar} bar) 이하인 빈 통입니다! 가스 공급 중단 방지를 위해 절체를 차단했습니다.`;
      logAudit(actorTag, "SAFETY_INTERLOCK_BLOCK", bankId, msg);
      pushAlert?.({
        level: "WARN",
        code: "INTERLOCK_EMPTY_BLOCK",
        bankId,
        channelId: nextOpenId,
        message: msg,
      });
      return { ok: false, blockedByInterlock: true, message: msg };
    }
  }

  // [인터록 3] Make-Before-Break (예비통 먼저 OPEN -> 350ms 무중단 오버랩 -> 기존통 CLOSE)
  bankSwitchingLocks.add(bankId);
  try {
    // 1단계: 새로 공급할 실린더 밸브 먼저 개방(OPEN = 0)
    await writePlcValve(
      nextOpenId - 1,
      0,
      `${bankId} 무중단 절체 1단계: ${newActiveSide}통 먼저 개방(OPEN)`
    );

    // 2단계: 배관 압력 연속성 유지를 위한 350ms 오버랩 대기
    await sleep(350);

    // 3단계: 기존 실린더 밸브 차단(SHUTOFF = 1)
    await writePlcValve(
      nextCloseId - 1,
      1,
      `${bankId} 무중단 절체 2단계: 반대통 안전 차단(SHUTOFF)`
    );

    // 4단계: 뱅크 activeSide 설정 동기화
    const banks = getSetting("bank_configs", []);
    const updatedBanks = banks.map((b) =>
      b.id === bankId ? { ...b, activeSide: newActiveSide } : b
    );
    setSetting("bank_configs", updatedBanks);

    const detailMsg = `${bankId} (${nextOpenCh?.gasName || "특수가스"}) 무중단 안전절체 완료: ${newActiveSide}통[OPEN ${nextOpenCh?.pressureBar ?? "-"}bar] ⇄ ${
      newActiveSide === "A" ? "B" : "A"
    }통[CLOSE 대기] (Make-Before-Break 적용)`;

    logAudit(actorTag, "SAFE_VALVE_SWITCH", bankId, detailMsg);

    return {
      ok: true,
      bankId,
      activeSide: newActiveSide,
      openedChannelId: nextOpenId,
      closedChannelId: nextCloseId,
      message: `✅ ${detailMsg}`,
      closePrevBar: nextCloseCh?.pressureBar,
    };
  } finally {
    bankSwitchingLocks.delete(bankId);
  }
}

module.exports = {
  executeSafeValveSwitch,
};
