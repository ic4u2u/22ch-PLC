/**
 * LS ELECTRIC XGT 전용 프로토콜 (LSIS-XGT FEnet, TCP 2004) 프레임 인코더 / 디코더
 * - 첨부 PDF 7페이지 규격 100% 준수 (Header 20 Bytes + Application Instruction)
 * - 외부 라이브러리 의존성 없음 (순수 Node.js Buffer 사용)
 */

const COMPANY_ID = "LSIS-XGT";
const HEADER_SIZE = 20;

// 명령어 코드 (Little Endian 2 Bytes)
const CMD = {
  READ_REQ: 0x0054,   // 읽기 요청 (PC -> PLC)
  READ_RES: 0x0055,   // 읽기 응답 (PLC -> PC)
  WRITE_REQ: 0x0058,  // 쓰기 요청 (PC -> PLC)
  WRITE_RES: 0x0059,  // 쓰기 응답 (PLC -> PC)
};

// 데이터 타입 코드 (Little Endian 2 Bytes)
const DATA_TYPE = {
  BIT: 0x0000,
  BYTE: 0x0001,
  WORD: 0x0002,       // %MW0, %MW100 등 16비트 워드 (PDF 예시: 02 00)
  DWORD: 0x0003,
  LWORD: 0x0004,
  CONTINUOUS: 0x0014, // 연속 읽기/쓰기
};

/** Buffer를 공백 구분 대문자 HEX 문자열로 변환 */
function toHex(buf) {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

/** 공백/하이픈이 섞인 HEX 문자열을 Buffer로 변환 */
function fromHex(hexStr) {
  const clean = hexStr.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length === 0 || clean.length % 2 !== 0) {
    throw new Error("올바른 짝수 길이의 HEX 문자열이 아닙니다.");
  }
  return Buffer.from(clean, "hex");
}

/** 20바이트 LSIS-XGT 헤더 생성 */
function buildHeader({ sourceOfFrame, invokeId = 0, length, plcInfo = 0x0000, cpuInfo = 0x00, fenetPos = 0x00 }) {
  const header = Buffer.alloc(HEADER_SIZE, 0x00);
  header.write(COMPANY_ID, 0, 8, "ascii");        // 0..7   Company ID ('LSIS-XGT')
  header.writeUInt16LE(0x0000, 8);                // 8..9   Reserved (0x0000)
  header.writeUInt16LE(plcInfo, 10);              // 10..11 PLC Info
  header.writeUInt8(cpuInfo, 12);                 // 12     CPU Info
  header.writeUInt8(sourceOfFrame, 13);           // 13     Source of Frame (0x33: PC->PLC, 0x11: PLC->PC)
  header.writeUInt16LE(invokeId & 0xffff, 14);    // 14..15 Invoke ID
  header.writeUInt16LE(length & 0xffff, 16);      // 16..17 Instruction Byte Length
  header.writeUInt8(fenetPos, 18);                // 18     Fenet Position
  header.writeUInt8(0x00, 19);                    // 19     Reserved (BCC)
  return header;
}

/**
 * XGT 개별 워드 읽기 요청 프레임 생성 (PDF 7페이지 예시와 동일 구조)
 * 예: variableName = "%MW0" -> Length = 14 (0x0E)
 */
function buildWordReadRequest(variableName, invokeId = 0) {
  const nameBuf = Buffer.from(variableName.trim().toUpperCase(), "ascii");
  const instruction = Buffer.alloc(10 + nameBuf.length);
  instruction.writeUInt16LE(CMD.READ_REQ, 0);     // Command: 54 00
  instruction.writeUInt16LE(DATA_TYPE.WORD, 2);   // Data Type: 02 00 (Word)
  instruction.writeUInt16LE(0x0000, 4);           // Reserved: 00 00
  instruction.writeUInt16LE(0x0001, 6);           // Block Count: 01 00
  instruction.writeUInt16LE(nameBuf.length, 8);   // Variable Name Length (예: 04 00)
  nameBuf.copy(instruction, 10);                  // Variable Name ASCII (예: 25 4D 57 30)

  const header = buildHeader({
    sourceOfFrame: 0x33,
    invokeId,
    length: instruction.length,
  });
  return Buffer.concat([header, instruction]);
}

/** XGT 개별 워드 쓰기 요청 프레임 생성 */
function buildWordWriteRequest(variableName, wordValue, invokeId = 0) {
  const nameBuf = Buffer.from(variableName.trim().toUpperCase(), "ascii");
  const instruction = Buffer.alloc(14 + nameBuf.length);
  instruction.writeUInt16LE(CMD.WRITE_REQ, 0);    // Command: 58 00
  instruction.writeUInt16LE(DATA_TYPE.WORD, 2);   // Data Type: 02 00 (Word)
  instruction.writeUInt16LE(0x0000, 4);           // Reserved: 00 00
  instruction.writeUInt16LE(0x0001, 6);           // Block Count: 01 00
  instruction.writeUInt16LE(nameBuf.length, 8);   // Variable Name Length
  nameBuf.copy(instruction, 10);                  // Variable Name ASCII
  const dataOffset = 10 + nameBuf.length;
  instruction.writeUInt16LE(2, dataOffset);       // Data Byte Size (Word = 2 Bytes)
  instruction.writeUInt16LE(wordValue & 0xffff, dataOffset + 2);

  const header = buildHeader({
    sourceOfFrame: 0x33,
    invokeId,
    length: instruction.length,
  });
  return Buffer.concat([header, instruction]);
}

/** XGT 읽기 응답 프레임 생성 (가상 PLC 서버용) */
function buildWordReadResponse(invokeId, wordValue, errorCode = 0x0000) {
  const instruction = Buffer.alloc(errorCode === 0 ? 12 : 8);
  instruction.writeUInt16LE(CMD.READ_RES, 0);     // Command: 55 00
  instruction.writeUInt16LE(DATA_TYPE.WORD, 2);   // Data Type: 02 00
  instruction.writeUInt16LE(0x0000, 4);           // Reserved
  instruction.writeUInt16LE(errorCode, 6);        // Error Status (0x0000 = 정상)
  if (errorCode === 0) {
    instruction.writeUInt16LE(0x0001, 8);         // Block Count: 1
    // 응답 데이터 크기(2B) + 값(2B) -> 총 14바이트 구조
    const body = Buffer.alloc(14);
    instruction.copy(body, 0, 0, 10);
    body.writeUInt16LE(2, 10);                    // Data Length: 2 bytes
    body.writeUInt16LE(wordValue & 0xffff, 12);   // 16-bit Word Value
    const header = buildHeader({
      sourceOfFrame: 0x11,
      invokeId,
      length: body.length,
      plcInfo: 0x0101,
      cpuInfo: 0xa0,
    });
    return Buffer.concat([header, body]);
  }
  const header = buildHeader({
    sourceOfFrame: 0x11,
    invokeId,
    length: instruction.length,
    plcInfo: 0x0101,
    cpuInfo: 0xa0,
  });
  return Buffer.concat([header, instruction]);
}

/** XGT 연속 읽기(0x0014) 응답 프레임 생성 (가상 PLC 서버용) */
function buildContinuousReadResponse(invokeId, dataBuf, errorCode = 0x0000) {
  if (errorCode !== 0) {
    const instruction = Buffer.alloc(8);
    instruction.writeUInt16LE(CMD.READ_RES, 0);
    instruction.writeUInt16LE(DATA_TYPE.CONTINUOUS, 2);
    instruction.writeUInt16LE(0x0000, 4);
    instruction.writeUInt16LE(errorCode, 6);
    const header = buildHeader({
      sourceOfFrame: 0x11,
      invokeId,
      length: instruction.length,
      plcInfo: 0x0101,
      cpuInfo: 0xa0,
    });
    return Buffer.concat([header, instruction]);
  }
  const body = Buffer.alloc(12 + dataBuf.length);
  body.writeUInt16LE(CMD.READ_RES, 0);              // Command: 55 00
  body.writeUInt16LE(DATA_TYPE.CONTINUOUS, 2);      // Data Type: 14 00
  body.writeUInt16LE(0x0000, 4);                    // Reserved
  body.writeUInt16LE(0x0000, 6);                    // Error Status
  body.writeUInt16LE(0x0001, 8);                    // Block Count: 1
  body.writeUInt16LE(dataBuf.length, 10);           // Data Byte Length (예: 44 = 2C 00)
  dataBuf.copy(body, 12);
  const header = buildHeader({
    sourceOfFrame: 0x11,
    invokeId,
    length: body.length,
    plcInfo: 0x0101,
    cpuInfo: 0xa0,
  });
  return Buffer.concat([header, body]);
}

/** XGT 쓰기 응답 프레임 생성 (가상 PLC 서버용) */
function buildWordWriteResponse(invokeId, errorCode = 0x0000) {
  const instruction = Buffer.alloc(10);
  instruction.writeUInt16LE(CMD.WRITE_RES, 0);    // Command: 59 00
  instruction.writeUInt16LE(DATA_TYPE.WORD, 2);   // Data Type: 02 00
  instruction.writeUInt16LE(0x0000, 4);           // Reserved
  instruction.writeUInt16LE(errorCode, 6);        // Error Status
  instruction.writeUInt16LE(0x0001, 8);           // Block Count

  const header = buildHeader({
    sourceOfFrame: 0x11,
    invokeId,
    length: instruction.length,
    plcInfo: 0x0101,
    cpuInfo: 0xa0,
  });
  return Buffer.concat([header, instruction]);
}

/** 수신된 Buffer가 LSIS-XGT 프레임인지 판별 및 파싱 */
function parseXgtFrame(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < HEADER_SIZE + 4) {
    return { isXgt: false };
  }
  const companyId = buf.toString("ascii", 0, 8);
  if (companyId !== COMPANY_ID) {
    return { isXgt: false };
  }

  const sourceOfFrame = buf.readUInt8(13);
  const invokeId = buf.readUInt16LE(14);
  const length = buf.readUInt16LE(16);
  const command = buf.readUInt16LE(20);
  const dataType = buf.readUInt16LE(22);

  const result = {
    isXgt: true,
    companyId,
    sourceOfFrame,
    direction: sourceOfFrame === 0x33 ? "PC → PLC (요청)" : "PLC → PC (응답)",
    invokeId,
    length,
    command,
    dataType,
  };

  // 요청(읽기/쓰기) 파싱
  if ((command === CMD.READ_REQ || command === CMD.WRITE_REQ) && buf.length >= 30) {
    const varLen = buf.readUInt16LE(28);
    if (buf.length >= 30 + varLen) {
      result.variableName = buf.toString("ascii", 30, 30 + varLen);
      if (
        command === CMD.READ_REQ &&
        dataType === DATA_TYPE.CONTINUOUS &&
        buf.length >= 30 + varLen + 2
      ) {
        result.byteCount = buf.readUInt16LE(30 + varLen);
      }
      if (command === CMD.WRITE_REQ && buf.length >= 30 + varLen + 4) {
        const valLen = buf.readUInt16LE(30 + varLen);
        if (valLen >= 2) {
          result.value = buf.readUInt16LE(30 + varLen + 2);
        }
      }
    }
  }

  // 응답(읽기/쓰기) 파싱
  if (command === CMD.READ_RES && buf.length >= 28) {
    result.errorCode = buf.readUInt16LE(26);
    if (result.errorCode === 0 && buf.length >= 34) {
      const dataLen = buf.readUInt16LE(30);
      if (dataLen >= 2 && buf.length >= 34) {
        result.value = buf.readUInt16LE(32);
      }
    }
  } else if (command === CMD.WRITE_RES && buf.length >= 28) {
    result.errorCode = buf.readUInt16LE(26);
  }

  return result;
}

module.exports = {
  CMD,
  DATA_TYPE,
  toHex,
  fromHex,
  buildWordReadRequest,
  buildWordWriteRequest,
  buildWordReadResponse,
  buildContinuousReadResponse,
  buildWordWriteResponse,
  parseXgtFrame,
};
