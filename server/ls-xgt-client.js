/**
 * [파일 2] server/ls-xgt-client.js
 * 역할: 순수 Node.js net.Socket 기반 LS ELECTRIC XGT 전용 프로토콜 (Port 2004) 드라이버
 *
 * - readWords(startWordAddr = 100, wordCount = 24):
 *     Command 0x0054 (연속 읽기 요청), 데이터 타입 0x0014(연속 바이트 %MB),
 *     %MW100은 바이트 주소 %MB200과 동일하며 24워드 = 48바이트(48B)를 연속 수신
 * - writeSingleWord(wordAddr = 200, value = 1):
 *     Command 0x0058 (개별 쓰기 요청), 데이터 타입 0x0002(워드 %MW),
 *     %MW200 ~ %MW223 단일 워드에 0(OPEN) 또는 1(SHUTOFF) 기록
 */

const net = require("net");

class LsXgtClient {
  /**
   * @param {object} options
   * @param {string} options.host PLC IP 주소 (기본: 192.168.0.50)
   * @param {number} options.port XGT 전용 프로토콜 포트 (기본: 2004)
   * @param {number} options.timeoutMs 응답 대기 제한시간 (기본: 1500ms)
   */
  constructor(options = {}) {
    this.host = options.host || process.env.PLC_IP || "192.168.0.50";
    this.port = Number(options.port || process.env.PLC_XGT_PORT || 2004);
    this.timeoutMs = options.timeoutMs || 1500;
    this.socket = null;
    this.connected = false;
    this.invokeId = 1;
  }

  /**
   * PLC XGT 서버(Port 2004)에 TCP 연결을 수립합니다.
   */
  connect() {
    if (this.connected && this.socket && !this.socket.destroyed) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const sock = new net.Socket();
      let settled = false;

      sock.setTimeout(this.timeoutMs);

      sock.once("connect", () => {
        this.socket = sock;
        this.connected = true;
        settled = true;
        resolve();
      });

      sock.once("error", (err) => {
        this.connected = false;
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      sock.once("close", () => {
        this.connected = false;
      });

      sock.connect(this.port, this.host);
    });
  }

  /**
   * XGT Application Header (20 Bytes) 생성 헬퍼
   * @param {number} bodyLengthInstruction 명령어 본문 바이트 길이
   */
  buildHeader(bodyLengthInstruction) {
    const header = Buffer.alloc(20, 0);
    // Company ID: "LSIS-XGT" (8 bytes) + 2 bytes reserved (0x0000)
    header.write("LSIS-XGT", 0, "ascii");
    // PLC Info (2B): Client -> Server 요청 시 0x0000
    header.writeUInt16LE(0x0000, 10);
    // CPU Info (1B): XGK/XGB = 0xA0
    header.writeUInt8(0xa0, 12);
    // Source of Frame (1B): Client -> Server = 0x33
    header.writeUInt8(0x33, 13);
    // Invoke ID (2B)
    this.invokeId = (this.invokeId + 1) % 65535;
    header.writeUInt16LE(this.invokeId, 14);
    // Length (2B): Instruction body length
    header.writeUInt16LE(bodyLengthInstruction, 16);
    // FEnet Position (1B): 0x00
    header.writeUInt8(0x00, 18);
    // Reserved BCC (1B): 0x00
    header.writeUInt8(0x00, 19);
    return header;
  }

  /**
   * 패킷 송신 후 응답 프레임 수신
   * @param {Buffer} packet
   * @returns {Promise<Buffer>}
   */
  sendAndReceive(packet) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.connect();
      } catch (err) {
        return reject(err);
      }

      let chunks = [];
      let totalLen = 0;

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`XGT 응답 시간 초과 (${this.timeoutMs}ms)`));
      }, this.timeoutMs);

      const onData = (chunk) => {
        chunks.push(chunk);
        totalLen += chunk.length;
        const buf = Buffer.concat(chunks, totalLen);

        if (buf.length >= 20) {
          const bodyLen = buf.readUInt16LE(16);
          if (buf.length >= 20 + bodyLen) {
            cleanup();
            resolve(buf);
          }
        }
      };

      const onError = (err) => {
        cleanup();
        this.connected = false;
        reject(err);
      };

      const cleanup = () => {
        clearTimeout(timer);
        if (this.socket) {
          this.socket.removeListener("data", onData);
          this.socket.removeListener("error", onError);
        }
      };

      this.socket.on("data", onData);
      this.socket.once("error", onError);
      this.socket.write(packet);
    });
  }

  /**
   * 연속 워드 읽기: Command 0x0054, DataType 0x0014 (연속 바이트 %MB 읽기)
   * %MW100은 바이트 오프셋 %MB200에 해당하며, wordCount * 2 바이트(48B)를 읽어
   * 16비트 부호 없는 정수 배열로 변환합니다.
   *
   * @param {number} startWordAddr 시작 워드 주소 (예: 100 -> %MW100 = %MB200)
   * @param {number} wordCount 읽을 워드 개수 (예: 24 -> 48 Bytes)
   * @returns {Promise<number[]>}
   */
  async readWords(startWordAddr = 100, wordCount = 24) {
    const byteAddr = startWordAddr * 2; // %MW100 === %MB200
    const varName = `%MB${byteAddr}`;
    const varBuf = Buffer.from(varName, "ascii");
    const byteCount = wordCount * 2; // 24 words = 48 bytes

    // Instruction Body:
    // Command(2B: 0x0054) + DataType(2B: 0x0014 Continuous Byte) + Reserved(2B: 0x0000)
    // + BlockCount(2B: 0x0001) + VarNameLen(2B) + VarName(N) + DataCount(2B: byteCount)
    const bodyLen = 2 + 2 + 2 + 2 + 2 + varBuf.length + 2;
    const body = Buffer.alloc(bodyLen);
    let offset = 0;

    body.writeUInt16LE(0x0054, offset);
    offset += 2; // Command: Read Request
    body.writeUInt16LE(0x0014, offset);
    offset += 2; // Data Type: Continuous Byte
    body.writeUInt16LE(0x0000, offset);
    offset += 2; // Reserved
    body.writeUInt16LE(0x0001, offset);
    offset += 2; // Block Count: 1
    body.writeUInt16LE(varBuf.length, offset);
    offset += 2; // Variable Name Length
    varBuf.copy(body, offset);
    offset += varBuf.length; // "%MB200"
    body.writeUInt16LE(byteCount, offset); // 48 Bytes

    const header = this.buildHeader(bodyLen);
    const response = await this.sendAndReceive(Buffer.concat([header, body]));

    // 응답 검증: Offset 20=Command(0x0055), Offset 26=ErrorState(2B)
    const errState = response.readUInt16LE(26);
    if (errState !== 0) {
      const errCode = response.length >= 30 ? response.readUInt16LE(28) : errState;
      throw new Error(`XGT Read Error: Code 0x${errCode.toString(16)}`);
    }

    // Offset 28=BlockCount(2B), Offset 30=DataByteCount(2B), Offset 32~=Data
    const dataByteCount = response.readUInt16LE(30);
    const words = [];
    for (let i = 0; i < dataByteCount && 32 + i + 1 < response.length; i += 2) {
      words.push(response.readUInt16LE(32 + i));
    }
    return words;
  }

  /**
   * 단일 워드 쓰기: Command 0x0058, DataType 0x0002 (Word %MW)
   * %MW200 ~ %MW223 밸브 제어 영역에 0(OPEN) 또는 1(SHUTOFF)을 기록합니다.
   *
   * @param {number} wordAddr 워드 주소 (예: 200 -> %MW200)
   * @param {number} value 기록할 16비트 정수값 (0 또는 1)
   */
  async writeSingleWord(wordAddr = 200, value = 1) {
    const varName = `%MW${wordAddr}`;
    const varBuf = Buffer.from(varName, "ascii");

    // Instruction Body:
    // Command(2B: 0x0058) + DataType(2B: 0x0002 Word) + Reserved(2B: 0x0000)
    // + BlockCount(2B: 0x0001) + VarNameLen(2B) + VarName(N) + DataSize(2B: 0x0002) + Value(2B)
    const bodyLen = 2 + 2 + 2 + 2 + 2 + varBuf.length + 2 + 2;
    const body = Buffer.alloc(bodyLen);
    let offset = 0;

    body.writeUInt16LE(0x0058, offset);
    offset += 2; // Command: Write Request
    body.writeUInt16LE(0x0002, offset);
    offset += 2; // Data Type: Word
    body.writeUInt16LE(0x0000, offset);
    offset += 2; // Reserved
    body.writeUInt16LE(0x0001, offset);
    offset += 2; // Block Count: 1
    body.writeUInt16LE(varBuf.length, offset);
    offset += 2; // Variable Name Length
    varBuf.copy(body, offset);
    offset += varBuf.length; // "%MW200"
    body.writeUInt16LE(0x0002, offset);
    offset += 2; // Data Size: 2 Bytes
    body.writeUInt16LE(value & 0xffff, offset);

    const header = this.buildHeader(bodyLen);
    const response = await this.sendAndReceive(Buffer.concat([header, body]));

    const errState = response.readUInt16LE(26);
    if (errState !== 0) {
      const errCode = response.length >= 30 ? response.readUInt16LE(28) : errState;
      throw new Error(`XGT Write Error: Code 0x${errCode.toString(16)}`);
    }
    return true;
  }

  close() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }
}

module.exports = { LsXgtClient };
