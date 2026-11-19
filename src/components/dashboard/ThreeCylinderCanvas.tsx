"use client";

/**
 * 파일명: src/components/dashboard/ThreeCylinderCanvas.tsx
 * 역할: 단일 공유 Three.js WebGLRenderer 기반 3D 47L 고압가스 실린더 + 실시간 가스 공급 애니메이션
 *  - 브라우저 WebGL 컨텍스트 한도(8~16개)를 넘지 않도록 모듈당 단 1개의 WebGLRenderer만 생성
 *  - 공급중인 실린더는 내부에서 가스 입자(파티클)가 아래->위로 솟구쳐 밸브로 공급되는 3D 모션 실행
 *  - 2D <canvas> 미러링 + 2D 고시인성 % 캡슐 오버레이로 4K(3840x2160)에서도 완벽한 선명도 유지
 */

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { ChannelData, getGasPhysicsMeta } from "./types";

interface CylinderInstance {
  id: number;
  canvas: HTMLCanvasElement;
  pct: number;
  gasColor: string;
  isOpen: boolean;
  isDanger: boolean;
  isFault: boolean;
  isWarn: boolean;
  isEmptyStandby: boolean;
}

interface SharedEngine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  fillMesh: THREE.Mesh;
  fillMat: THREE.MeshStandardMaterial;
  wheelMesh: THREE.Mesh;
  wheelMat: THREE.MeshStandardMaterial;
  ringMesh: THREE.Mesh;
  ringMat: THREE.MeshStandardMaterial;
  particles: THREE.Mesh[];
  particleOffsets: { x: number; z: number; speed: number; phase: number }[];
  instances: Map<number, CylinderInstance>;
  rafId: number | null;
  frameCount: number;
  clock: THREE.Clock;
}

const RENDER_W = 140;
const RENDER_H = 298;

let engine: SharedEngine | null = null;

function getOrCreateSharedEngine(): SharedEngine | null {
  if (typeof window === "undefined") return null;
  if (engine) return engine;

  try {
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(RENDER_W, RENDER_H, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, RENDER_W / RENDER_H, 0.1, 30);
    camera.position.set(0, 1.35, 5.15);
    camera.lookAt(0, 1.25, 0);

    // 3D 스튜디오 조명 (원통 좌측 광택 + 우측 입체 음영)
    const ambient = new THREE.AmbientLight(0xcbd5e1, 1.15);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
    keyLight.position.set(-3.2, 4.5, 4.0);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(3.5, 2.5, -2.5);
    scene.add(rimLight);

    // 47L 고압 실린더 외피 (반투명 유리/스틸 + 돔 숄더)
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.24,
      roughness: 0.14,
      metalness: 0.35,
      depthWrite: false,
    });
    const bodyMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.56, 1.75, 28, 1, false),
      outerMat
    );
    bodyMesh.position.y = 1.05;
    scene.add(bodyMesh);

    const domeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.56, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      outerMat
    );
    domeMesh.position.y = 1.92;
    scene.add(domeMesh);

    // 내부 가스 잔량 발광 코어
    const fillMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.15,
    });
    const fillMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.49, 0.49, 1.7, 24),
      fillMat
    );
    fillMesh.position.y = 1.02;
    scene.add(fillMesh);

    // 황동 밸브 넥 & 스템
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.85,
      roughness: 0.22,
    });
    const stemMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.22, 16),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
    );
    stemMesh.position.y = 2.48;
    scene.add(stemMesh);

    const brassNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.16, 16),
      brassMat
    );
    brassNeck.position.y = 2.66;
    scene.add(brassNeck);

    // 상단 밸브 핸들 휠 (공급중 회전)
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.8,
      metalness: 0.5,
      roughness: 0.25,
    });
    const wheelMesh = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 10, 22), wheelMat);
    wheelMesh.rotation.x = Math.PI / 2 - 0.15;
    wheelMesh.position.y = 2.79;
    scene.add(wheelMesh);

    // 바닥 3D 상태 링
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.4,
    });
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.045, 10, 28), ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.14;
    scene.add(ringMesh);

    // 공급중 가스 상승 입자 (10개)
    const particles: THREE.Mesh[] = [];
    const particleOffsets: { x: number; z: number; speed: number; phase: number }[] = [];
    const pGeo = new THREE.SphereGeometry(0.055, 8, 8);
    for (let i = 0; i < 10; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      scene.add(pMesh);
      particles.push(pMesh);
      const angle = (i / 10) * Math.PI * 2;
      const radius = 0.14 + (i % 3) * 0.1;
      particleOffsets.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        speed: 0.75 + (i % 4) * 0.2,
        phase: i / 10,
      });
    }

    engine = {
      renderer,
      scene,
      camera,
      fillMesh,
      fillMat,
      wheelMesh,
      wheelMat,
      ringMesh,
      ringMat,
      particles,
      particleOffsets,
      instances: new Map(),
      rafId: null,
      frameCount: 0,
      clock: new THREE.Clock(),
    };
    return engine;
  } catch {
    return null;
  }
}

function renderSharedLoop() {
  if (!engine) return;
  engine.frameCount += 1;

  // 30fps 페이스로 렌더링해 22개 3D 실린더를 4K 환경에서도 매우 부드럽고 가볍게 유지
  if (engine.frameCount % 2 === 0 && engine.instances.size > 0) {
    const t = engine.clock.getElapsedTime();

    for (const inst of engine.instances.values()) {
      const ctx = inst.canvas.getContext("2d");
      if (!ctx) continue;

      const pctRatio = Math.max(0.05, Math.min(1, inst.pct / 100));
      engine.fillMesh.scale.y = pctRatio;
      engine.fillMesh.position.y = 0.18 + (1.7 * pctRatio) / 2;

      if (inst.isFault) {
        engine.fillMat.color.set("#c084fc");
        engine.fillMat.emissive.set("#9333ea");
        engine.fillMat.emissiveIntensity = 0.8 + 0.4 * Math.sin(t * 6);
        engine.ringMat.color.set("#a855f7");
        engine.ringMat.emissive.set("#a855f7");
        engine.ringMat.emissiveIntensity = 1.4;
      } else if (!inst.isOpen) {
        const col = inst.isEmptyStandby ? "#fb7185" : "#475569";
        const em = inst.isEmptyStandby ? "#be123c" : "#1e293b";
        engine.fillMat.color.set(col);
        engine.fillMat.emissive.set(em);
        engine.fillMat.emissiveIntensity = inst.isEmptyStandby ? 0.55 : 0.15;
        engine.ringMat.color.set(inst.isEmptyStandby ? "#f43f5e" : "#334155");
        engine.ringMat.emissive.set(inst.isEmptyStandby ? "#f43f5e" : "#0f172a");
        engine.ringMat.emissiveIntensity = inst.isEmptyStandby ? 1.0 : 0.05;
      } else if (inst.isDanger) {
        engine.fillMat.color.set("#fb7185");
        engine.fillMat.emissive.set("#e11d48");
        engine.fillMat.emissiveIntensity = 0.85 + 0.5 * Math.abs(Math.sin(t * 7));
        engine.ringMat.color.set("#f43f5e");
        engine.ringMat.emissive.set("#f43f5e");
        engine.ringMat.emissiveIntensity = 1.8;
      } else if (inst.isWarn) {
        engine.fillMat.color.set("#fbbf24");
        engine.fillMat.emissive.set("#d97706");
        engine.fillMat.emissiveIntensity = 0.85;
        engine.ringMat.color.set("#f59e0b");
        engine.ringMat.emissive.set("#f59e0b");
        engine.ringMat.emissiveIntensity = 1.4;
      } else {
        engine.fillMat.color.set(inst.gasColor);
        engine.fillMat.emissive.set(inst.gasColor);
        engine.fillMat.emissiveIntensity = 0.78 + 0.18 * Math.sin(t * 3 + inst.id);
        engine.ringMat.color.set("#10b981");
        engine.ringMat.emissive.set("#10b981");
        engine.ringMat.emissiveIntensity = 1.4 + 0.5 * Math.sin(t * 4 + inst.id);
      }

      // 밸브 핸들 휠: 공급중일 때 밝은 네온 + 미세 회전
      if (inst.isOpen) {
        engine.wheelMat.color.set("#38bdf8");
        engine.wheelMat.emissive.set("#0ea5e9");
        engine.wheelMat.emissiveIntensity = 0.9;
        engine.wheelMesh.rotation.z = t * 1.6 + inst.id;
      } else {
        engine.wheelMat.color.set("#64748b");
        engine.wheelMat.emissive.set("#0f172a");
        engine.wheelMat.emissiveIntensity = 0.1;
        engine.wheelMesh.rotation.z = 0;
      }

      // 공급중일 때만 실린더 내부에서 밸브 출구로 실제 가스가 솟구쳐 올라가는 입자 애니메이션
      engine.particles.forEach((p, idx) => {
        if (!inst.isOpen) {
          p.visible = false;
          return;
        }
        p.visible = true;
        const cfg = engine!.particleOffsets[idx];
        const prog = (t * cfg.speed + cfg.phase + inst.id * 0.13) % 1;
        // 아래(0.25)에서 시작해 밸브 출구(2.85)까지 상승하며 중앙으로 수렴
        const y = 0.25 + prog * 2.55;
        const converge = prog > 0.7 ? 1 - (prog - 0.7) / 0.3 : 1;
        p.position.set(cfg.x * converge, y, cfg.z * converge);
        const scale = 0.65 + 0.5 * Math.sin(prog * Math.PI);
        p.scale.setScalar(scale);
        (p.material as THREE.MeshBasicMaterial).color.set("#ffffff");
        (p.material as THREE.MeshBasicMaterial).opacity = Math.sin(prog * Math.PI) * 0.92;
      });

      engine.renderer.render(engine.scene, engine.camera);
      ctx.clearRect(0, 0, RENDER_W, RENDER_H);
      ctx.drawImage(engine.renderer.domElement, 0, 0, RENDER_W, RENDER_H);
    }
  }

  engine.rafId = requestAnimationFrame(renderSharedLoop);
}

interface ThreeCylinderCanvasProps {
  ch: ChannelData;
  gasColor: string;
}

export default function ThreeCylinderCanvas({ ch, gasColor }: ThreeCylinderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phys = getGasPhysicsMeta(ch.gasCode, ch.pressureBar, ch.maxBar);
  const pct = phys.realMassPct;

  useEffect(() => {
    const canvas = canvasRef.current;
    const eng = getOrCreateSharedEngine();
    if (!canvas || !eng) return;

    eng.instances.set(ch.id, {
      id: ch.id,
      canvas,
      pct,
      gasColor,
      isOpen: ch.valveState === 0,
      isDanger: ch.status === "DANGER",
      isFault: ch.status === "SENSOR_FAULT",
      isWarn: ch.status === "WARN",
      isEmptyStandby: ch.valveState === 1 && ch.pressureBar <= (ch.dangerBar || 15),
    });

    if (eng.rafId === null) {
      eng.rafId = requestAnimationFrame(renderSharedLoop);
    }

    return () => {
      if (!eng) return;
      eng.instances.delete(ch.id);
      if (eng.instances.size === 0 && eng.rafId !== null) {
        cancelAnimationFrame(eng.rafId);
        eng.rafId = null;
      }
    };
  }, [ch.id, ch.valveState, ch.status, ch.pressureBar, ch.dangerBar, pct, gasColor]);

  return (
    <div className="relative w-[clamp(46px,4.2vw,148px)] max-h-[26vh] aspect-[60/128] flex items-center justify-center shrink-0">
      <canvas
        ref={canvasRef}
        width={RENDER_W}
        height={RENDER_H}
        className="h-full w-full drop-shadow-[0_8px_14px_rgba(0,0,0,0.75)]"
      />
      {/* 고시인성 2D 잔량 % 캡슐 뱃지 (4K에서도 100% 선명) */}
      <span className="pointer-events-none absolute top-[54%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/30 bg-slate-950/80 px-1.5 py-0.5 font-mono text-[clamp(0.68rem,0.85vw,1.45rem)] font-black text-white shadow">
        {pct}%
      </span>
    </div>
  );
}
