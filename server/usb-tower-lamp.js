/**
 * [파일 3] server/usb-tower-lamp.js
 * 역할: 상황실 큐텍 미니 PC USB 직결형 3색 타워램프(경광등: 적/황/녹 LED + 내장 부저) 제어 드라이버
 *
 * - serialport를 이용해 미니 PC의 USB 포트에 연결된 타워램프(큐라이트 USB 경광등 또는
 *   USB-Serial CH340/FTDI 릴레이 경광등)를 자동 탐색하여 연결하고,
 *   미연결 시에도 에러 없이 가상 시뮬레이션(VIRTUAL) 상태로 안전하게 동작합니다.
 * - 자동 상태 연동 규칙:
 *   1) 22채널 모두 NORMAL: 녹색(Green) ON, 나머지 OFF, 부저 OFF
 *   2) 1개 이상 WARN(WARNING) 또는 SENSOR_FAULT: 황색(Yellow) BLINK, 부저 OFF
 *   3) 1개 이상 DANGER(CRITICAL): 적색(Red) BLINK + 부저(Buzzer) ON
 *      (단, 사용자가 TOWER_LAMP_MUTE_BUZZER 클릭 시 적색 점멸은 유지하고 부저만 OFF)
 *   4) TOWER_LAMP_TEST 수신 시: 3초간 적+황+녹+부저 전체 점등 테스트 후 원래 상태로 자동 복귀
 */

let SerialPort = null;
try {
  const sp = require("serialport");
  SerialPort = sp.SerialPort || sp;
} catch {
  SerialPort = null;
}

class UsbTowerLampController {
  constructor(options = {}) {
    this.preferredPort = options.port || process.env.LAMP_USB_PORT || "AUTO";
    this.baudRate = Number(options.baudRate || 9600);
    this.portInstance = null;
    this.connected = false;
    this.portPath = "VIRTUAL (시뮬레이션)";

    // 현재 경광등 상태
    this.state = {
      connected: false,
      portPath: "VIRTUAL (시뮬레이션)",
      mode: "NORMAL", // "NORMAL" | "WARNING" | "CRITICAL" | "TEST"
      red: "OFF", // "OFF" | "ON" | "BLINK"
      yellow: "OFF", // "OFF" | "ON" | "BLINK"
      green: "ON", // "OFF" | "ON" | "BLINK"
      buzzer: "OFF", // "OFF" | "ON"
      buzzerMuted: false,
      testing: false,
      updatedAt: new Date().toISOString(),
    };

    this.testTimer = null;
    this.initSerialConnection();
  }

  /**
   * USB 타워램프 포트 자동 탐색 (CH340, FTDI, Silicon Labs, USB-SERIAL 등) 및 연결
   */
  async initSerialConnection() {
    if (!SerialPort || typeof SerialPort.list !== "function") {
      return;
    }

    try {
      const ports = await SerialPort.list();
      let target = null;

      if (this.preferredPort && this.preferredPort !== "AUTO") {
        target = ports.find(
          (p) => p.path.toUpperCase() === this.preferredPort.toUpperCase()
        );
      } else {
        target = ports.find((p) => {
          const info = `${p.manufacturer || ""} ${p.friendlyName || ""} ${
            p.pnpId || ""
          }`.toUpperCase();
          return (
            info.includes("CH340") ||
            info.includes("FTDI") ||
            info.includes("USB") ||
            info.includes("SERIAL") ||
            info.includes("QLIGHT") ||
            info.includes("CP210")
          );
        });
      }

      if (!target) {
        this.connected = false;
        this.portPath = "VIRTUAL (USB 미연결 · 가상 시뮬레이션)";
        this.state.connected = false;
        this.state.portPath = this.portPath;
        return;
      }

      this.portInstance = new SerialPort({
        path: target.path,
        baudRate: this.baudRate,
        autoOpen: false,
      });

      this.portInstance.open((err) => {
        if (err) {
          this.connected = false;
          this.portPath = "VIRTUAL (시뮬레이션)";
          return;
        }
        this.connected = true;
        this.portPath = target.path;
        this.state.connected = true;
        this.state.portPath = target.path;
        console.log(
          `🚨 [USB 타워램프] 하드웨어 경광등 연결 완료: ${target.path} (${this.baudRate} bps)`
        );
        this.sendHardwarePacket();
      });

      this.portInstance.on("error", () => {
        this.connected = false;
        this.state.connected = false;
      });

      this.portInstance.on("close", () => {
        this.connected = false;
        this.state.connected = false;
      });
    } catch {
      this.connected = false;
      this.portPath = "VIRTUAL (시뮬레이션)";
    }
  }

  /**
   * 실제 USB 시리얼 경광등으로 제어 바이트 패킷 송신
   * (Bit 0: Red, Bit 1: Yellow, Bit 2: Green, Bit 3: Buzzer, Bit 4~6: Blink flags)
   */
  sendHardwarePacket() {
    if (!this.connected || !this.portInstance || !this.portInstance.isOpen) {
      return;
    }
    try {
      let mask = 0x00;
      if (this.state.red !== "OFF") mask |= 0x01;
      if (this.state.yellow !== "OFF") mask |= 0x02;
      if (this.state.green !== "OFF") mask |= 0x04;
      if (this.state.buzzer === "ON") mask |= 0x08;
      if (this.state.red === "BLINK") mask |= 0x10;
      if (this.state.yellow === "BLINK") mask |= 0x20;

      // 표준 USB 릴레이/타워램프 호환 프로토콜 프레임 송신
      const buf = Buffer.from([0x57, mask, 0x0d, 0x0a]);
      this.portInstance.write(buf);
    } catch {}
  }

  /**
   * 직접 경광등 상태를 지정하고 변경 여부를 반환합니다.
   */
  setLampState(nextPartial) {
    const prevKey = `${this.state.mode}|${this.state.red}|${this.state.yellow}|${this.state.green}|${this.state.buzzer}|${this.state.buzzerMuted}|${this.state.testing}`;
    this.state = {
      ...this.state,
      ...nextPartial,
      connected: this.connected,
      portPath: this.portPath,
      updatedAt: new Date().toISOString(),
    };
    const nextKey = `${this.state.mode}|${this.state.red}|${this.state.yellow}|${this.state.green}|${this.state.buzzer}|${this.state.buzzerMuted}|${this.state.testing}`;

    if (prevKey !== nextKey) {
      this.sendHardwarePacket();
      return true;
    }
    return false;
  }

  /**
   * 22채널 실시간 상태 배열을 기반으로 경광등 상태를 자동 산출 및 반영합니다.
   * @param {Array} evaluatedChannels 22채널 상태 배열
   * @returns {{ changed: boolean, state: object }}
   */
  updateFromChannels(evaluatedChannels = []) {
    // 3초 전체 점등 테스트 중일 때는 테스트 상태를 유지
    if (this.state.testing) {
      return { changed: false, state: this.getState() };
    }

    const hasCritical = evaluatedChannels.some((c) => c.status === "DANGER");
    const hasWarningOrFault = evaluatedChannels.some(
      (c) => c.status === "WARN" || c.status === "SENSOR_FAULT"
    );

    // 모든 위험(CRITICAL/DANGER) 상황이 해제되면 부저 음소거(buzzerMuted) 자동 리셋
    if (!hasCritical && this.state.buzzerMuted) {
      this.state.buzzerMuted = false;
    }

    let changed = false;

    if (hasCritical) {
      // 1개 이상 CRITICAL(DANGER): 적색 BLINK + 부저 ON (단, 부저 음소거 시 부저만 OFF)
      changed = this.setLampState({
        mode: "CRITICAL",
        red: "BLINK",
        yellow: hasWarningOrFault ? "BLINK" : "OFF",
        green: "OFF",
        buzzer: this.state.buzzerMuted ? "OFF" : "ON",
      });
    } else if (hasWarningOrFault) {
      // 1개 이상 WARNING 또는 SENSOR_FAULT: 황색 BLINK, 부저 OFF
      changed = this.setLampState({
        mode: "WARNING",
        red: "OFF",
        yellow: "BLINK",
        green: "OFF",
        buzzer: "OFF",
      });
    } else {
      // 22채널 모두 NORMAL: 녹색 ON, 나머지 OFF, 부저 OFF
      changed = this.setLampState({
        mode: "NORMAL",
        red: "OFF",
        yellow: "OFF",
        green: "ON",
        buzzer: "OFF",
      });
    }

    return { changed, state: this.getState() };
  }

  /**
   * [🔕 경광등 부저만 끄기] (TOWER_LAMP_MUTE_BUZZER)
   * 적색 점멸은 그대로 유지하고 시끄러운 부저만 즉시 OFF 처리합니다.
   */
  muteBuzzer(mute = true) {
    const changed = this.setLampState({
      buzzerMuted: Boolean(mute),
      buzzer: mute ? "OFF" : this.state.mode === "CRITICAL" ? "ON" : "OFF",
    });
    return { changed, state: this.getState() };
  }

  /**
   * [⚡ 경광등 테스트] (TOWER_LAMP_TEST)
   * 3초간 적+황+녹+부저 전체 점등 테스트 후 원래 상태로 자동 복귀합니다.
   */
  triggerTest(onCompleteCallback) {
    if (this.testTimer) {
      clearTimeout(this.testTimer);
    }

    this.setLampState({
      testing: true,
      mode: "TEST",
      red: "ON",
      yellow: "ON",
      green: "ON",
      buzzer: "ON",
    });

    this.testTimer = setTimeout(() => {
      this.state.testing = false;
      this.testTimer = null;
      if (typeof onCompleteCallback === "function") {
        onCompleteCallback();
      }
    }, 3000);

    return this.getState();
  }

  getState() {
    return { ...this.state };
  }
}

const usbTowerLamp = new UsbTowerLampController();

module.exports = {
  UsbTowerLampController,
  usbTowerLamp,
};
