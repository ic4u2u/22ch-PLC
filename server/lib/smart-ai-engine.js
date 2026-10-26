/**
 * 파일명: server/lib/smart-ai-engine.js
 * 역할:
 *  1) 24채널 4~20mA 센서 자가 진단 (SENSOR_FAULT: 단선 <0, 한계 115% 초과, 0.5초 내 45bar 이상 급락)
 *  2) 채널별 압력 강하 속도(dP/dt) 및 실시간 잔여 소진 예상 시간 산출
 *  3) 저압(<=45 bar) -> 고압(>=90 bar, +60 bar 이상) 실린더 교체 자동 감지 및 DB 기록
 *  4) 12뱅크 Smart AI 밸브 스위칭 엔진 (0:Auto, 1:Smart AI, 2:Dual, 3:Moni) 및 STANDBY_EMPTY_WARN 감지
 */

const { db, logAudit, setSetting, CHANNEL_COUNT } = require("./db");

// 채널별 이전 폴링 상태 저장 (0.5초 주기 비교용, 22채널)
const prevChannelState = Array.from({ length: CHANNEL_COUNT }, () => ({
  rawBar: null,
  calibratedBar: null,
  lastValidBar: 120.0,
  dropRateBarPerSec: 0.05, // 기본 미세 소모율 (bar/sec)
  faultHoldTicks: 0,
  faultReason: null,
}));

// 뱅크별 절체 타이머 상태 저장
const bankSwitchTimers = {};

/**
 * 24채널 데이터 평가 및 센서 자가 진단 수행
 */
function evaluateChannels(rawRegisters, valveRegisters, channelConfigs) {
  const nowIso = new Date().toISOString().replace("T", " ").slice(0, 19);
  const yearMonth = nowIso.slice(0, 7);

  return channelConfigs.map((cfg, idx) => {
    const rawVal = Number(rawRegisters[idx] ?? 0);
    const valveState = Number(valveRegisters[idx] ?? 0); // 0: OPEN, 1: SHUTOFF
    const rawBar = Number((rawVal / 10).toFixed(1));
    const offset = Number(cfg.calibrationOffset || 0);
    const calibratedBar = Number((rawBar + offset).toFixed(1));
    const maxBar = Number(cfg.maxBar || 150.0);

    const prev = prevChannelState[idx];
    let isSensorFault = false;
    let faultReason = null;

    // 밸브가 열린(0) 상태에서 센서 자가 진단 수행
    if (valveState === 0) {
      const upperLimit = Number((maxBar * 1.15).toFixed(1)); // 115% 한계 (150bar 기준 172.5bar)
      const suddenDrop =
        prev.rawBar !== null && prev.rawBar - rawBar >= 45.0 && rawBar <= 5.0;

      if (rawBar < 0) {
        isSensorFault = true;
        faultReason = "4~20mA 루프 단선 (< 0 bar)";
      } else if (calibratedBar > upperLimit || rawBar > upperLimit) {
        isSensorFault = true;
        faultReason = `측정 한계 115% 초과 스파이크 (${rawBar} bar)`;
      } else if (suddenDrop) {
        isSensorFault = true;
        faultReason = `0.5초 내 급락 단선 감지 (-${(prev.rawBar - rawBar).toFixed(1)} bar)`;
      } else if (idx === CHANNEL_COUNT - 1 && rawBar === 0) {
        // 22번 채널(마지막 채널) 4~20mA 단선 급락(0 반환) 유지 구간
        isSensorFault = true;
        faultReason = "4~20mA 전류 루프 단선 (0.0 bar 급락)";
      }
    }

    if (isSensorFault) {
      prev.faultHoldTicks = 4; // 약 2초간 폴트 표시 유지로 채터링 방지
      prev.faultReason = faultReason;
    } else if (prev.faultHoldTicks > 0 && valveState === 0 && rawBar === 0) {
      isSensorFault = true;
      faultReason = prev.faultReason;
      prev.faultHoldTicks -= 1;
    } else {
      prev.faultHoldTicks = 0;
      prev.faultReason = null;
    }

    // 정상 측정치일 때 압력 강하 속도(dP/dt) 및 실린더 자동 교체 판별
    if (!isSensorFault && valveState === 0) {
      if (prev.lastValidBar !== null) {
        const delta = prev.lastValidBar - calibratedBar;
        // 0.5초 간격 강하량 -> 초당 강하 속도(bar/s) 지수이동평균(EMA) 산출
        if (delta > 0 && delta < 30) {
          const instRate = delta / 0.5;
          prev.dropRateBarPerSec = Number(
            (prev.dropRateBarPerSec * 0.75 + instRate * 0.25).toFixed(3)
          );
        }

        // 실린더 교체 감지: 저압(<= 45 bar)에서 고압(>= 90 bar, 상승폭 +60 bar 이상) 상승 시
        const rise = calibratedBar - prev.lastValidBar;
        if (
          prev.lastValidBar <= 45.0 &&
          calibratedBar >= 90.0 &&
          rise >= 60.0
        ) {
          db.prepare(`
            INSERT INTO cylinder_replacements (timestamp, year_month, channel_id, gas_name, prev_pressure, new_pressure, delta_pressure)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            nowIso,
            yearMonth,
            cfg.id,
            cfg.gasName,
            Number(prev.lastValidBar.toFixed(1)),
            calibratedBar,
            Number(rise.toFixed(1))
          );

          logAudit(
            "AUTO-DETECT",
            "CYLINDER_REPLACE",
            `CH-${String(cfg.id).padStart(2, "0")}`,
            `${cfg.gasName} 실린더 교체 자동 감지 (${prev.lastValidBar.toFixed(1)} bar → ${calibratedBar} bar, +${rise.toFixed(1)} bar)`
          );
        }
      }
      prev.lastValidBar = calibratedBar;
    }

    prev.rawBar = rawBar;
    prev.calibratedBar = calibratedBar;

    // 상태 등급 판정 (SENSOR_FAULT 최우선 분리 -> 밸브 오차단 방지)
    let status = "NORMAL";
    if (isSensorFault) {
      status = "SENSOR_FAULT";
    } else if (valveState === 1) {
      status = "SHUTOFF";
    } else if (calibratedBar <= Number(cfg.dangerBar || 15.0)) {
      status = "DANGER";
    } else if (calibratedBar <= Number(cfg.warnBar || 35.0)) {
      status = "WARN";
    }

    // 잔여 소진 예상 시간(분) 계산 (현재 압력에서 dangerBar까지 남은 시간)
    const usableBar = Math.max(0, calibratedBar - Number(cfg.dangerBar || 15.0));
    const effectiveRate = Math.max(0.02, prev.dropRateBarPerSec); // 최소 소모율 보정
    const remainingSec = valveState === 1 ? 0 : Math.round(usableBar / effectiveRate);
    const remainingHours = Math.floor(remainingSec / 3600);
    const remainingMinutes = Math.floor((remainingSec % 3600) / 60);

    return {
      ...cfg,
      rawBar,
      pressureBar: valveState === 1 ? 0 : Math.max(0, calibratedBar),
      valveState, // 0: OPEN, 1: SHUTOFF
      status, // NORMAL | WARN | DANGER | SHUTOFF | SENSOR_FAULT
      faultReason,
      dropRateBarPerSec: prev.dropRateBarPerSec,
      remainingText:
        valveState === 1
          ? "밸브 차단됨"
          : isSensorFault
          ? "센서 점검 필요"
          : `약 ${remainingHours}시간 ${remainingMinutes}분 남음`,
      remainingMinutesTotal: Math.round(remainingSec / 60),
    };
  });
}

/**
 * 12뱅크 Smart AI 밸브 스위칭 엔진 (미팅 스펙 0902_0910 반영)
 * @param {Array} bankConfigs 12뱅크 설정 배열
 * @param {Array} evaluatedChannels 24채널 실시간 상태 배열
 * @param {Function} writeValveCallback (chIndex0to23, value0or1, reason) => Promise<void>
 * @param {Function} notifyAlertCallback (alertObj) => void
 */
async function evaluateBanksAndSwitch(
  bankConfigs,
  evaluatedChannels,
  writeValveCallback,
  notifyAlertCallback
) {
  let settingsChanged = false;

  const updatedBanks = [];

  for (const bank of bankConfigs) {
    const chAObj = evaluatedChannels[bank.chA - 1];
    const chBObj = evaluatedChannels[bank.chB - 1];
    if (!chAObj || !chBObj) {
      updatedBanks.push(bank);
      continue;
    }

    const isAActive = bank.activeSide !== "B";
    const primaryCh = isAActive ? chAObj : chBObj;
    const standbyCh = isAActive ? chBObj : chAObj;

    // 1. 주 공급 실린더 압력 강하 속도(dP/dt) 기반 최적 지연시간 computedAiN 산출
    // 범위: 0.5초 ~ (runTimeSec - 0.5초), 0.1초 단위
    const rt = Math.min(6.0, Math.max(4.0, Number(bank.runTimeSec || 5.0)));
    const maxAiN = Number((rt - 0.5).toFixed(1));
    const minAiN = 0.5;
    // 강하 속도가 빠를수록 지연시간 N을 짧게 산출
    const dropRate = Number(primaryCh.dropRateBarPerSec || 0.05);
    const rawAiN = rt - 0.5 - Math.min(rt - 1.2, dropRate * 1.4);
    const computedAiN = Number(
      Math.max(minAiN, Math.min(maxAiN, rawAiN)).toFixed(1)
    );
    bank.computedAiN = computedAiN;

    const switchBar = Number(bank.switchPressureBar || 20.0);
    const hysteresisBar = Number(bank.hysteresisBar || 3.0);
    const standbyReadyMinBar = switchBar + hysteresisBar; // 교체압력 + Hysteresis(3 bar)
    const warnBar = Number(bank.warnPressureBar || 35.0);

    // 센서 고장(SENSOR_FAULT)인 경우에는 밸브 오차단 및 오절체 방지!
    const primaryFault = primaryCh.status === "SENSOR_FAULT";
    const standbyReady =
      standbyCh.status !== "SENSOR_FAULT" &&
      standbyCh.pressureBar >= standbyReadyMinBar;

    // 2. 사전 예고 알람 감지 (STANDBY_EMPTY_WARN):
    // 주 실린더 잔량이 주의 기준 이하인데 예비(Standby) 실린더마저 비어 있으면 경보 발생
    const isPrimaryLowWarn =
      !primaryFault && primaryCh.pressureBar <= warnBar;
    const standbyEmptyWarn = isPrimaryLowWarn && !standbyReady;

    if (standbyEmptyWarn && !bank._warnedStandbyEmpty) {
      bank._warnedStandbyEmpty = true;
      notifyAlertCallback({
        level: "WARN",
        code: "STANDBY_EMPTY_WARN",
        bankId: bank.id,
        channelId: standbyCh.id,
        message: `[사전예고] ${bank.id} (${bank.gasName}) 주 실린더 잔량 주의(${primaryCh.pressureBar} bar) 상태이나 예비(${standbyCh.side}) 실린더가 비어 있습니다! (${standbyCh.pressureBar} bar < 기준 ${standbyReadyMinBar} bar)`,
      });
    } else if (!standbyEmptyWarn) {
      bank._warnedStandbyEmpty = false;
    }

    // 3. 운전 모드별 밸브 제어
    // mode === 2 (Dual 모드): A/B 양쪽 밸브 동시 Open
    if (Number(bank.mode) === 2) {
      if (chAObj.valveState !== 0) {
        await writeValveCallback(chAObj.id - 1, 0, `${bank.id} Dual 모드 동시 개방`);
      }
      if (chBObj.valveState !== 0) {
        await writeValveCallback(chBObj.id - 1, 0, `${bank.id} Dual 모드 동시 개방`);
      }
    }
    // mode === 3 (Moni 모드): 모니터링 전용 (제어 안 함)
    else if (Number(bank.mode) === 3) {
      if (bankSwitchTimers[bank.id]) {
        delete bankSwitchTimers[bank.id];
      }
    }
    // mode === 0 (Auto 모드) 또는 mode === 1 (Smart AI 모드)
    else if (Number(bank.mode) === 0 || Number(bank.mode) === 1) {
      const needSwitch =
        !primaryFault &&
        primaryCh.pressureBar <= switchBar &&
        standbyReady;

      if (needSwitch) {
        const delaySec =
          Number(bank.mode) === 0
            ? Number(bank.mxFixedSec || 2.5)
            : computedAiN;

        if (!bankSwitchTimers[bank.id]) {
          bankSwitchTimers[bank.id] = {
            startedAt: Date.now(),
            delayMs: delaySec * 1000,
            targetSide: isAActive ? "B" : "A",
          };
        } else {
          const elapsed = Date.now() - bankSwitchTimers[bank.id].startedAt;
          if (elapsed >= bankSwitchTimers[bank.id].delayMs) {
            // 예비 밸브 Open(0) 및 주 밸브 Shutoff(1) 자동 실행
            const modeLabel = Number(bank.mode) === 1 ? `Smart AI (N=${computedAiN}s)` : `Auto (MX=${delaySec}s)`;
            await writeValveCallback(
              standbyCh.id - 1,
              0,
              `${bank.id} ${modeLabel} 예비(${standbyCh.side}) 밸브 OPEN`
            );
            await writeValveCallback(
              primaryCh.id - 1,
              1,
              `${bank.id} ${modeLabel} 주(${primaryCh.side}) 밸브 SHUTOFF`
            );

            const oldSide = bank.activeSide;
            const newSide = isAActive ? "B" : "A";
            bank.activeSide = newSide;
            settingsChanged = true;
            delete bankSwitchTimers[bank.id];

            const detailMsg = `${bank.id} (${bank.gasName}) ${oldSide}→${newSide} 자동 절체 완료 [${modeLabel}, 절체압력 ${primaryCh.pressureBar} bar, 예비압력 ${standbyCh.pressureBar} bar]`;
            logAudit("SMART-AI", "AUTO_SWITCH", bank.id, detailMsg);
            notifyAlertCallback({
              level: "INFO",
              code: "BANK_SWITCHED",
              bankId: bank.id,
              channelId: standbyCh.id,
              message: detailMsg,
            });
          }
        }
      } else {
        delete bankSwitchTimers[bank.id];
      }
    }

    updatedBanks.push({
      ...bank,
      standbyEmptyWarn,
      standbyReady,
      switchingRemainingSec: bankSwitchTimers[bank.id]
        ? Number(
            Math.max(
              0,
              (bankSwitchTimers[bank.id].delayMs -
                (Date.now() - bankSwitchTimers[bank.id].startedAt)) /
                1000
            ).toFixed(1)
          )
        : null,
    });
  }

  if (settingsChanged) {
    // 영구 설정에는 런타임 상태 필드를 제외하고 저장
    const cleanBanks = updatedBanks.map(
      ({ standbyEmptyWarn, standbyReady, switchingRemainingSec, _warnedStandbyEmpty, ...rest }) => rest
    );
    setSetting("bank_configs", cleanBanks);
  }

  return updatedBanks;
}

module.exports = {
  evaluateChannels,
  evaluateBanksAndSwitch,
};
