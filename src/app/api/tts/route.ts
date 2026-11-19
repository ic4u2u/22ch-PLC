/**
 * 파일명: src/app/api/tts/route.ts
 * 역할: Qwen3-TTS 최신 버전(`qwen3-tts-instruct-flash` + 한국어 네이티브 화자 `Sohee`) 및
 *       고품질 한국어 신경망 성우(`ko-KR-SunHiNeural` / `ko-KR-InJoonNeural`) 기반
 *       자연스러운 인간형 경보·안내 음성 합성 API
 *  - 1순위: Alibaba DashScope 최신 Qwen3-TTS (`qwen3-tts-instruct-flash`, 화자: Sohee, Language: Korean)
 *  - 2순위(무키 즉시 고음질): Microsoft Neural 성우 엔진 (`msedge-tts` — AI 티 없는 아나운서 톤)
 *  - 3순위(비상 폴백): Google TTS
 */

import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// 화학식 및 영문 약어를 실제 인간 아나운서가 발음하듯 자연스러운 한국어 호흡 문장으로 변환
function normalizeKoreanPronunciation(raw: string): string {
  return raw
    .replace(/P-CH4\s*\[CH4\(N5\)\]/gi, "고순도 메탄")
    .replace(/G-CH4\s*\[CH4\(N35\)\]/gi, "일반 메탄")
    .replace(/P-H2\s*\[H2\(N5\)\]/gi, "고순도 수소")
    .replace(/G-H2\s*\[H2\(N35\)\]/gi, "일반 수소")
    .replace(/MIX\(Ar\+H2\)/gi, "아르곤 수소 혼합가스")
    .replace(/C2H2\s*\[C2H2\(N5\)\]/gi, "고순도 아세틸렌")
    .replace(/P-N2\s*\[N2\(N5\)\]/gi, "고순도 질소")
    .replace(/G-N2\s*\[N2\(N35\)\]/gi, "일반 질소")
    .replace(/He\s*\[He\(N5\)\]/gi, "고순도 헬륨")
    .replace(/Ar\s*\[Ar\(N5\)\]/gi, "고순도 아르곤")
    .replace(/O2\s*\[O2\(N5\)\]/gi, "고순도 산소")
    .replace(/P-CH4/gi, "고순도 메탄")
    .replace(/G-CH4/gi, "일반 메탄")
    .replace(/P-H2/gi, "고순도 수소")
    .replace(/G-H2/gi, "일반 수소")
    .replace(/P-N2/gi, "고순도 질소")
    .replace(/G-N2/gi, "일반 질소")
    .replace(/C2H2/gi, "아세틸렌")
    .replace(/A실린더/g, "에이 실린더")
    .replace(/B실린더/g, "비 실린더")
    .replace(/1차측/g, "일차측")
    .replace(/2차측/g, "이차측")
    .replace(/CH-(\d+)/gi, "$1번 채널")
    .replace(/BANK-(\d+)/gi, "$1번 뱅크")
    .replace(/SENSOR_FAULT/gi, "센서 신호 이상")
    .replace(/4~20mA/gi, "사 에서 이십 밀리암페어")
    .replace(/(\d+)\.(\d+)\s*bar/gi, "$1점 $2 바")
    .replace(/(\d+)\s*bar/gi, "$1 바")
    .replace(/\.\s+/g, ", ");
}

async function synthesizeWithQwen3(
  dashscopeKey: string,
  cleanText: string,
  voice: string
): Promise<ArrayBuffer | null> {
  const targetVoice = voice === "Cherry" ? "Sohee" : voice;
  const attempts = [
    {
      model: "qwen3-tts-instruct-flash",
      input: {
        text: cleanText,
        voice: targetVoice,
        language_type: "Korean",
        instructions:
          "차분하고 신뢰감 있는 한국인 여자 아나운서처럼, 또렷하고 자연스러운 억양과 쉼표 호흡으로 안내해 주세요.",
      },
    },
    {
      model: "qwen3-tts-flash",
      input: {
        text: cleanText,
        voice: targetVoice,
        language_type: "Korean",
      },
    },
  ];

  for (const payload of attempts) {
    try {
      const dsRes = await fetch(
        "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${dashscopeKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(4500),
        }
      );

      if (dsRes.ok) {
        const dsJson = await dsRes.json();
        const audioUrl = dsJson?.output?.audio?.url;
        if (audioUrl) {
          const audioFetch = await fetch(audioUrl);
          if (audioFetch.ok) {
            return await audioFetch.arrayBuffer();
          }
        }
      }
    } catch {
      // 다음 모델 폴백 시도
    }
  }
  return null;
}

async function synthesizeWithNeuralEdge(
  cleanText: string,
  voice: string
): Promise<Buffer | null> {
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 4000,
    synthesisTimeoutMs: 6000,
  });
  try {
    const neuralVoice =
      voice === "Ethan" ? "ko-KR-InJoonNeural" : "ko-KR-SunHiNeural";
    await tts.setMetadata(
      neuralVoice,
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );
    const { audioStream } = tts.toStream(cleanText, {
      rate: "-2%",
      pitch: "+0Hz",
    });

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      audioStream.on("end", () => resolve());
      audioStream.on("error", (err: Error) => reject(err));
    });

    return chunks.length > 0 ? Buffer.concat(chunks) : null;
  } catch (err) {
    console.error("[TTS-NEURAL-ERR]", err);
    return null;
  } finally {
    try {
      tts.close();
    } catch {}
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawText =
    searchParams.get("text") ||
    "상황실 안내 말씀 드립니다. 가스캐비넷 1번 고순도 메탄 압력을 확인해 주시기 바랍니다.";
  const voice = searchParams.get("voice") || "Sohee";

  const cleanText = normalizeKoreanPronunciation(rawText).slice(0, 260);

  // [1순위] DashScope 최신 Qwen3-TTS Instruct (`qwen3-tts-instruct-flash` + Sohee)
  const dashscopeKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
  if (dashscopeKey) {
    const qwenBuf = await synthesizeWithQwen3(dashscopeKey, cleanText, voice);
    if (qwenBuf) {
      return new NextResponse(qwenBuf, {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "X-TTS-Engine": "Qwen3-TTS-Instruct-Flash-Sohee",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  // [2순위] 별도 API 키 없이도 실제 한국인 아나운서처럼 자연스러운 신경망 성우 스트림
  const neuralBuf = await synthesizeWithNeuralEdge(cleanText, voice);
  if (neuralBuf) {
    return new NextResponse(new Uint8Array(neuralBuf), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-TTS-Engine": "Neural-Korean-Announcer-SunHi",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // [3순위] 최후 비상 폴백
  try {
    const encoded = encodeURIComponent(cleanText);
    const ttsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ko&client=tw-ob&ttsspeed=1.0`;
    const res = await fetch(ttsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const audioBuffer = await res.arrayBuffer();
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "X-TTS-Engine": "Emergency-Fallback-TTS",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  } catch {
    // 네트워크 차단 시 클라이언트 신경망 보이스로 폴백
  }

  return NextResponse.json(
    { ok: false, fallbackText: cleanText },
    { status: 503 }
  );
}
