"use client";

/**
 * 파일명: src/components/dashboard/ThreeDigitalTwinView.tsx
 * 역할: [🧊 3D 디지털 트윈] — Three.js 단일 WebGL 캔버스 + 2D 고시인성 HUD 결합 관제 뷰
 *  - 브라우저 WebGL 컨텍스트 한도 초과를 막기 위해 단일 WebGLRenderer에서 11뱅크(22실린더) 전체를 렌더링
 *  - 원거리 숫자 가독성 보완을 위해 우상단 상세 HUD 및 하단 11뱅크 퀵 셀렉트 바 제공
 */

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ChannelData,
  PressureUnit,
  formatPressureByUnit,
  getGasPhysicsMeta,
  getUnitLabel,
} from "./types";
import { BankPairItem } from "./GasFilterBar";
import { buildDigitalTwinScene, updateDigitalTwinScene } from "./threeTwinScene";

interface ThreeDigitalTwinViewProps {
  allPairs: BankPairItem[];
  isFullscreen: boolean;
  unit: PressureUnit;
  onSelectChannel?: (ch: ChannelData) => void;
}

export default function ThreeDigitalTwinView({
  allPairs,
  isFullscreen,
  unit,
  onSelectChannel,
}: ThreeDigitalTwinViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const allPairsRef = useRef<BankPairItem[]>(allPairs);
  allPairsRef.current = allPairs;

  const [selectedBankNum, setSelectedBankNum] = useState<number>(1);
  const selectedBankRef = useRef<number>(1);
  selectedBankRef.current = selectedBankNum;

  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const autoRotateRef = useRef<boolean>(true);
  autoRotateRef.current = autoRotate;

  const [webglError, setWebglError] = useState<string>("");

  const cameraGoalRef = useRef<{
    pos: THREE.Vector3;
    target: THREE.Vector3;
    active: boolean;
  }>({
    pos: new THREE.Vector3(0, 8.5, 13.5),
    target: new THREE.Vector3(0, 1.2, 0),
    active: false,
  });

  const unitLabel = getUnitLabel(unit);

  const flyTo = (pos: [number, number, number], target: [number, number, number]) => {
    cameraGoalRef.current = {
      pos: new THREE.Vector3(...pos),
      target: new THREE.Vector3(...target),
      active: true,
    };
  };

  const focusBank = (bankNum: number) => {
    setSelectedBankNum(bankNum);
    setAutoRotate(false);
    if (bankNum <= 5) {
      const x = (bankNum - 3) * 3.1;
      flyTo([x, 3.8, 7.6], [x, 1.35, 2.7]);
    } else {
      const x = (bankNum - 6 - 2.5) * 2.85;
      flyTo([x, 3.8, 2.2], [x, 1.35, -2.7]);
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setWebglError("현재 브라우저 또는 GPU 환경에서 WebGL 3D 가속을 사용할 수 없습니다.");
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 500);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      46,
      (container.clientWidth || 800) / Math.max(1, container.clientHeight || 500),
      0.1,
      100
    );
    camera.position.set(0, 8.5, 13.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4;
    controls.maxDistance = 28;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.target.set(0, 1.2, 0);

    // 사용자가 직접 드래그를 시작하면 자동 이동/회전 일시 중지
    const handleControlStart = () => {
      cameraGoalRef.current.active = false;
    };
    controls.addEventListener("start", handleControlStart);

    const twin = buildDigitalTwinScene(allPairsRef.current);

    // Raycaster 클릭으로 뱅크 선택
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // 드래그 회전 시 클릭 무시
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(twin.clickableMeshes, false);
      if (hits.length > 0) {
        const hitBank = hits[0].object.userData?.bankNum;
        if (typeof hitBank === "number") {
          focusBank(hitBank);
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    // 컨테이너 크기 변경 감지 (4K·풀화면·모바일 대응)
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || 800;
      const h = Math.max(1, container.clientHeight || 500);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      updateDigitalTwinScene(
        twin.bankHandles,
        allPairsRef.current,
        elapsed,
        selectedBankRef.current
      );

      if (cameraGoalRef.current.active) {
        camera.position.lerp(cameraGoalRef.current.pos, 0.08);
        controls.target.lerp(cameraGoalRef.current.target, 0.08);
        if (camera.position.distanceTo(cameraGoalRef.current.pos) < 0.05) {
          cameraGoalRef.current.active = false;
        }
      }

      controls.autoRotate = autoRotateRef.current && !cameraGoalRef.current.active;
      controls.autoRotateSpeed = 0.65;
      controls.update();
      renderer.render(twin.scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.removeEventListener("start", handleControlStart);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      controls.dispose();
      twin.dispose();
      renderer.dispose();
    };
  }, []);

  const selectedPair =
    allPairs.find((p) => p.bankNum === selectedBankNum) || allPairs[0];

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-2xl border border-cyan-500/40 bg-slate-950 p-3 shadow-2xl ${
        isFullscreen ? "flex-1 min-h-0" : ""
      }`}
    >
      {/* 1. 상단 3D 카메라 프리셋 & 조작 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-black text-cyan-300 mr-1">
            🧊 3D 디지털 트윈 (드래그 회전 · 휠 줌 · 실린더 클릭)
          </span>
          <button
            type="button"
            onClick={() => flyTo([0, 8.5, 13.5], [0, 1.2, 0])}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-xs font-bold text-cyan-200 hover:bg-cyan-500 hover:text-slate-950"
          >
            전체 조감도
          </button>
          <button
            type="button"
            onClick={() => flyTo([0, 5.2, 10.5], [0, 1.3, 2.7])}
            className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-xs font-bold text-sky-200 hover:bg-sky-500 hover:text-slate-950"
          >
            제1구역: 캐비닛(1~5)
          </button>
          <button
            type="button"
            onClick={() => flyTo([0, 5.2, 4.8], [0, 1.3, -2.7])}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-200 hover:bg-emerald-500 hover:text-slate-950"
          >
            제2·3구역: 오토체인지(6~11)
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAutoRotate((v) => !v)}
          className={`rounded-lg border px-2.5 py-1 text-xs font-black transition-all ${
            autoRotate
              ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
              : "border-slate-700 bg-slate-800 text-slate-300"
          }`}
        >
          {autoRotate ? "🔄 자동 회전 ON" : "⏸️ 회전 일시정지"}
        </button>
      </div>

      {/* 2. 중앙 3D WebGL 캔버스 + 우상단 선택 뱅크 2D 고시인성 HUD */}
      <div
        className={`relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#030816] ${
          isFullscreen ? "flex-1 min-h-[380px]" : "h-[520px] sm:h-[600px]"
        }`}
      >
        {webglError ? (
          <div className="flex h-full items-center justify-center p-6 text-sm font-bold text-rose-300">
            {webglError}
          </div>
        ) : (
          <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
        )}

        {/* 우상단 선택된 뱅크 2D 상세 HUD (3D 원근 가독성 보완) */}
        {selectedPair && (
          <div
            className="absolute top-3 right-3 z-10 w-[250px] sm:w-[280px] rounded-2xl border-2 bg-slate-950/90 backdrop-blur-md p-3 shadow-2xl"
            style={{ borderColor: selectedPair.chA.color || "#38bdf8" }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <span
                className="rounded px-2 py-0.5 font-mono text-[11px] font-black text-slate-950"
                style={{ backgroundColor: selectedPair.chA.color || "#38bdf8" }}
              >
                {selectedPair.bankNum}번 뱅크
              </span>
              <span className="text-sm font-black text-white truncate">
                {selectedPair.chA.gasName.replace(/\[.*?\]\s*/g, "")}
              </span>
            </div>
            <div className="my-2 grid grid-cols-2 gap-2 text-xs">
              {[selectedPair.chA, selectedPair.chB].map((ch) => {
                const pct = getGasPhysicsMeta(ch.gasCode, ch.pressureBar, ch.maxBar).realMassPct;
                const isOpen = ch.valveState === 0;
                return (
                  <div
                    key={ch.id}
                    className={`rounded-xl border p-2 ${
                      isOpen
                        ? "border-emerald-400/70 bg-emerald-950/40"
                        : "border-slate-800 bg-slate-900/80"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className={isOpen ? "text-emerald-300" : "text-slate-400"}>
                        {isOpen ? "🟢 공급중" : "⚪ 대기중"}
                      </span>
                      <span className="font-mono text-slate-300">{pct}%</span>
                    </div>
                    <div className="mt-1 font-mono text-sm font-black text-white">
                      {ch.status === "SENSOR_FAULT"
                        ? "점검"
                        : `${formatPressureByUnit(ch.pressureBar, unit, ch.maxBar)}${unitLabel}`}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                const active =
                  selectedPair.chA.valveState === 0 ? selectedPair.chA : selectedPair.chB;
                onSelectChannel?.(active);
              }}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-1.5 text-xs font-black text-white hover:brightness-110"
            >
              📊 상세 트렌드 &amp; 영점 보정 열기
            </button>
          </div>
        )}
      </div>

      {/* 3. 하단 11뱅크 2D 퀵 셀렉트 바 (원클릭 카메라 Fly-to & 100% 숫자 가독성) */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11">
        {allPairs.map((pair) => {
          const activeCh =
            pair.chA.valveState === 0 ? pair.chA : pair.chB.valveState === 0 ? pair.chB : pair.chA;
          const isSelected = pair.bankNum === selectedBankNum;
          const shortName = pair.chA.gasName
            .replace(/\[.*?\]/g, "")
            .replace(/\(.*?\)/g, "")
            .replace(/^[A-Za-z0-9\-]+\s*/g, "")
            .trim();

          return (
            <button
              key={pair.bankId}
              type="button"
              onClick={() => focusBank(pair.bankNum)}
              className={`rounded-xl border px-2 py-1.5 text-left transition-all ${
                isSelected
                  ? "border-cyan-400 bg-cyan-950/60 ring-1 ring-cyan-400/60"
                  : "border-slate-800 bg-slate-900/80 hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                <span className="truncate text-white">{shortName}</span>
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: pair.chA.color || "#38bdf8" }}
                />
              </div>
              <div className="mt-0.5 font-mono text-xs font-black text-cyan-300">
                {activeCh.status === "SENSOR_FAULT"
                  ? "점검"
                  : `${formatPressureByUnit(activeCh.pressureBar, unit, activeCh.maxBar)}${unitLabel}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
