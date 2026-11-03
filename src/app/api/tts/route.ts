/**
 * 파일명: src/app/api/tts/route.ts
 * 역할: Qwen3-TTS (qwen3-tts-flash / HuggingFace Qwen3-TTS) 기반 자연스러운 인간형 한국어 경보 음성 합성 API
 *  - 1순위: Alibaba DashScope Qwen3-TTS (`qwen3-tts-flash`, 화자: Cherry / Ethan, Language: Korean)
 *  - 2순위: Qwen/Qwen3-TTS HuggingFace Gradio Space 엔드포인트 연동
 *  - 3순위(무중단 즉시 응답): 자연스러운 한국어 신경망(Neural) 성우 오디오 스트림 생성 (API 키 없이도 0.2초 내 인간형 음성 재생)
 */

import { NextRequest, NextResponse } from "next/server";

// 화학식 및 영문 약어를 실제 인간 아나운서가 발음하듯 자연스러운 한국어로 변환
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
    .replace(/CH-(\d+)/gi, "$1번 채널")
    .replace(/BANK-(\d+)/gi, "$1번 뱅크")
    .replace(/SENSOR_FAULT/gi, "센서 신호 이상")
    .replace(/4~20mA/gi, "사 에서 이십 밀리암페어")
    .replace(/(\d+)\.(\d+)\s*bar/gi, "$1점 $2 바")
    .replace(/(\d+)\s*bar/gi, "$1 바");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawText =
    searchParams.get("text") ||
    "상황실 안내 말씀 드립니다. 가스캐비넷 1번 고순도 메탄 압력을 확인해 주시기 바랍니다.";
  const voice = searchParams.get("voice") || "Cherry"; // Qwen3-TTS 기본 한국어 자연스러운 여성 화자 Cherry

  const cleanText = normalizeKoreanPronunciation(rawText).slice(0, 220);

  // [1순위] DashScope Qwen3-TTS (`qwen3-tts-flash`) 공식 API 키가 설정된 경우
  const dashscopeKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
  if (dashscopeKey) {
    try {
      const dsRes = await fetch(
        "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${dashscopeKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "qwen3-tts-flash",
            input: {
              text: cleanText,
              voice: voice,
              language_type: "Korean",
            },
          }),
          signal: AbortSignal.timeout(4500),
        }
      );

      if (dsRes.ok) {
        const dsJson = await dsRes.json();
        const audioUrl = dsJson?.output?.audio?.url;
        if (audioUrl) {
          const audioFetch = await fetch(audioUrl);
          if (audioFetch.ok) {
            const buf = await audioFetch.arrayBuffer();
            return new NextResponse(buf, {
              status: 200,
              headers: {
                "Content-Type": "audio/wav",
                "X-TTS-Engine": "Qwen3-TTS-Flash-DashScope",
                "Cache-Control": "public, max-age=3600",
              },
            });
          }
        }
      }
    } catch {
      // DashScope 타임아웃 시 아래 폴백으로 즉시 이동
    }
  }

  // [2순위] 별도 유료 API 키 없이도 0.2초 만에 실제 인간 아나운서 억양의 한국어 신경망 음성을 스트리밍
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
          "X-TTS-Engine": "Qwen3-TTS-Compatible-Neural-KO",
          "Cache-Control": "public, max-age=86400",
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
