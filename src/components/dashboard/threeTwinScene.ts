/**
 * 파일명: src/components/dashboard/threeTwinScene.ts
 * 역할: Three.js 단일 WebGL 씬 빌더 & 실시간 모션그래픽 업데이터
 *  - 앞열(Z = +2.8): 제1구역 가스캐비닛 5뱅크 (1~5번 뱅크)
 *  - 뒷열(Z = -2.8): 제2·3구역 오토체인지 6뱅크 (6~11번 뱅크)
 *  - 각 뱅크: 반투명 유리 실린더 2기 + 공급중/대기중 3D 라벨 & 발광 대비 + 가스명/코드 3D 캔버스 라벨 + 가스 흐름 파티클
 */

import * as THREE from "three";
import { ChannelData, getGasPhysicsMeta } from "./types";
import { BankPairItem } from "./GasFilterBar";

export interface BankMeshHandle {
  bankNum: number;
  group: THREE.Group;
  centerPos: THREE.Vector3;
  fillA: THREE.Mesh;
  fillB: THREE.Mesh;
  ringA: THREE.Mesh;
  ringB: THREE.Mesh;
  stateSpriteA: THREE.Sprite;
  stateSpriteB: THREE.Sprite;
  lastStateA: string;
  lastStateB: string;
  beacon: THREE.Mesh;
  particles: THREE.Mesh[];
  particlePhase: number[];
  isAOpen: boolean;
  gasColor: THREE.Color;
}

export interface TwinSceneContext {
  scene: THREE.Scene;
  bankHandles: BankMeshHandle[];
  clickableMeshes: THREE.Object3D[];
  dispose: () => void;
}

function getBankWorldPosition(bankNum: number): THREE.Vector3 {
  if (bankNum <= 5) {
    const x = (bankNum - 3) * 3.1;
    return new THREE.Vector3(x, 0, 2.7);
  }
  const idx = bankNum - 6;
  const x = (idx - 2.5) * 2.85;
  return new THREE.Vector3(x, 0, -2.7);
}

/**
 * 3D 공간 위에 선명한 한글·영문 라벨을 띄우기 위한 고해상도 CanvasTexture 생성기
 */
function createLabelTexture(
  title: string,
  subtitle: string,
  accentColor: string,
  bgColor = "rgba(4, 12, 28, 0.9)"
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 라운드 배경 박스
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 24);
    ctx.fill();
    ctx.stroke();

    // 상단 컬러 바 포인트
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(18, 18, 16, canvas.height - 36, 8);
    ctx.fill();

    // 한글 가스명 (큰 글씨)
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 42px 'Malgun Gothic', 'Pretendard', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(title, 50, 48);

    // 영문 가스코드 (보조 글씨)
    ctx.fillStyle = accentColor;
    ctx.font = "800 28px Consolas, monospace";
    ctx.fillText(subtitle, 50, 92);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 실린더 개별 상태('공급중' / '대기중' / '교체필요') 3D 배지 텍스처 생성기
 */
function createStateBadgeTexture(
  label: string,
  bgHex: string,
  borderHex: string,
  textHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 220;
  canvas.height = 72;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bgHex;
    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textHex;
    ctx.font = "900 34px 'Malgun Gothic', 'Pretendard', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 실린더 몸통 앞면 부착용 가스 이름 텍스처
 */
function createCylinderTagTexture(code: string, korName: string, colorHex: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 112;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colorHex;
    ctx.font = "900 32px Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(code, canvas.width / 2, 38);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 28px 'Malgun Gothic', 'Pretendard', sans-serif";
    ctx.fillText(korName, canvas.width / 2, 78);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function buildDigitalTwinScene(allPairs: BankPairItem[]): TwinSceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#030816");
  scene.fog = new THREE.FogExp2("#030816", 0.02);

  // 조명 세팅
  const ambient = new THREE.AmbientLight("#93c5fd", 1.25);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight("#ffffff", 2.2);
  keyLight.position.set(10, 18, 12);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight("#38bdf8", 1.35);
  rimLight.position.set(-12, 10, -10);
  scene.add(rimLight);

  // 바닥 스테이지 & 그리드
  const floorGeo = new THREE.PlaneGeometry(34, 18);
  const floorMat = new THREE.MeshStandardMaterial({
    color: "#061024",
    metalness: 0.75,
    roughness: 0.35,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);

  const grid = new THREE.GridHelper(32, 32, "#0ea5e9", "#0f294a");
  grid.position.y = 0;
  scene.add(grid);

  // 공정 공급 메인 헤더 파이프
  const mainPipeMat = new THREE.MeshStandardMaterial({
    color: "#334155",
    metalness: 0.85,
    roughness: 0.25,
  });
  const frontHeader = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 14.5, 16),
    mainPipeMat
  );
  frontHeader.rotation.z = Math.PI / 2;
  frontHeader.position.set(0, 3.05, 2.7);
  scene.add(frontHeader);

  const backHeader = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 16.5, 16),
    mainPipeMat
  );
  backHeader.rotation.z = Math.PI / 2;
  backHeader.position.set(0, 3.05, -2.7);
  scene.add(backHeader);

  // 공유 지오메트리
  const outerCylGeo = new THREE.CylinderGeometry(0.36, 0.36, 1.85, 24, 1, false);
  const domeGeo = new THREE.SphereGeometry(0.36, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const fillCylGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.75, 20);
  const valveGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.26, 12);
  const wheelGeo = new THREE.TorusGeometry(0.11, 0.025, 8, 18);
  const ringGeo = new THREE.TorusGeometry(0.44, 0.042, 10, 28);
  const manifoldGeo = new THREE.BoxGeometry(1.15, 0.32, 0.38);
  const beaconGeo = new THREE.SphereGeometry(0.12, 14, 14);
  const particleGeo = new THREE.SphereGeometry(0.075, 10, 10);

  const glassMat = new THREE.MeshStandardMaterial({
    color: "#e2e8f0",
    transparent: true,
    opacity: 0.22,
    roughness: 0.15,
    metalness: 0.25,
    depthWrite: false,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: "#eab308",
    metalness: 0.85,
    roughness: 0.25,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: "#1e293b",
    metalness: 0.7,
    roughness: 0.35,
  });

  const bankHandles: BankMeshHandle[] = [];
  const clickableMeshes: THREE.Object3D[] = [];

  for (const pair of allPairs) {
    const pos = getBankWorldPosition(pair.bankNum);
    const colorHex = pair.chA.color || "#0ea5e9";
    const gasColor = new THREE.Color(colorHex);
    const group = new THREE.Group();
    group.position.copy(pos);

    const shortCode = (pair.chA.gasCode || "")
      .replace(/\[.*?\]/g, "")
      .replace(/\(.*?\)/g, "")
      .trim();
    const korName = (pair.chA.gasName || "")
      .replace(/\[.*?\]/g, "")
      .replace(/\(.*?\)/g, "")
      .replace(/^[A-Za-z0-9\-]+\s*/g, "")
      .trim() || pair.chA.gasName;

    // 뱅크 바닥 발판
    const baseMat = new THREE.MeshStandardMaterial({
      color: "#0b1933",
      emissive: gasColor,
      emissiveIntensity: 0.18,
      metalness: 0.6,
      roughness: 0.3,
    });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.12, 1.45), baseMat);
    baseMesh.position.y = 0.06;
    baseMesh.userData = { bankNum: pair.bankNum };
    group.add(baseMesh);
    clickableMeshes.push(baseMesh);

    // 뱅크 상단 플로팅 가스명 3D 라벨 (항상 카메라 정면)
    const headerTex = createLabelTexture(korName, `${pair.bankNum}B · ${shortCode}`, colorHex);
    const headerSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: headerTex, transparent: true, depthTest: false })
    );
    headerSprite.position.set(0, 3.72, 0);
    headerSprite.scale.set(2.35, 0.78, 1);
    headerSprite.renderOrder = 10;
    group.add(headerSprite);

    const buildCylinder = (offsetX: number, ch: ChannelData) => {
      const outer = new THREE.Mesh(outerCylGeo, glassMat);
      outer.position.set(offsetX, 1.05, 0);
      outer.userData = { bankNum: pair.bankNum };
      group.add(outer);
      clickableMeshes.push(outer);

      const dome = new THREE.Mesh(domeGeo, glassMat);
      dome.position.set(offsetX, 1.97, 0);
      group.add(dome);

      // 내부 발광 가스 잔량 코어 (공급중 vs 대기중 색/발광 대비 확실히 적용)
      const fillMat = new THREE.MeshStandardMaterial({
        color: ch.valveState === 0 ? gasColor : "#475569",
        emissive: ch.valveState === 0 ? gasColor : "#1e293b",
        emissiveIntensity: ch.valveState === 0 ? 0.9 : 0.15,
        roughness: 0.25,
      });
      const fill = new THREE.Mesh(fillCylGeo, fillMat);
      fill.position.set(offsetX, 1.02, 0);
      group.add(fill);

      // 실린더 몸통 앞면 가스 이름 태그 (Sprite)
      const tagTex = createCylinderTagTexture(shortCode, korName, colorHex);
      const tagSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tagTex, transparent: true })
      );
      tagSprite.position.set(offsetX, 1.25, 0.44);
      tagSprite.scale.set(0.72, 0.32, 1);
      group.add(tagSprite);

      // 황동 밸브 & 핸들
      const valve = new THREE.Mesh(valveGeo, brassMat);
      valve.position.set(offsetX, 2.38, 0);
      group.add(valve);

      const wheel = new THREE.Mesh(wheelGeo, brassMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(offsetX, 2.52, 0);
      group.add(wheel);

      // 바닥 네온 링 (공급중 = 밝은 초록 / 대기중 = 어두운 슬레이트)
      const ringMat = new THREE.MeshStandardMaterial({
        color: ch.valveState === 0 ? "#10b981" : "#334155",
        emissive: ch.valveState === 0 ? "#10b981" : "#0f172a",
        emissiveIntensity: ch.valveState === 0 ? 1.8 : 0.05,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(offsetX, 0.14, 0);
      group.add(ring);

      // 실린더 하단 앞쪽 [공급중 / 대기중] 상태 3D 라벨
      const initLabel = ch.valveState === 0 ? "공급중" : "대기중";
      const stateTex = createStateBadgeTexture(
        initLabel,
        ch.valveState === 0 ? "rgba(16, 185, 129, 0.95)" : "rgba(30, 41, 59, 0.9)",
        ch.valveState === 0 ? "#6ee7b7" : "#475569",
        ch.valveState === 0 ? "#022c22" : "#cbd5e1"
      );
      const stateSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: stateTex, transparent: true, depthTest: false })
      );
      stateSprite.position.set(offsetX, 0.36, 0.56);
      stateSprite.scale.set(0.84, 0.28, 1);
      stateSprite.renderOrder = 11;
      group.add(stateSprite);

      return { fill, ring, stateSprite, initLabel };
    };

    const cylA = buildCylinder(-0.54, pair.chA);
    const cylB = buildCylinder(0.54, pair.chB);

    // 상단 자동절체기 매니폴드 블록 + 상태 비콘
    const manifold = new THREE.Mesh(manifoldGeo, darkMetalMat);
    manifold.position.set(0, 2.75, 0);
    manifold.userData = { bankNum: pair.bankNum };
    group.add(manifold);
    clickableMeshes.push(manifold);

    const beaconMat = new THREE.MeshStandardMaterial({
      color: "#10b981",
      emissive: "#10b981",
      emissiveIntensity: 1.2,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 3.02, 0.18);
    group.add(beacon);

    // 가스 흐름 모션 파티클 (3개)
    const particles: THREE.Mesh[] = [];
    const particlePhase: number[] = [];
    for (let k = 0; k < 3; k++) {
      const pMat = new THREE.MeshBasicMaterial({ color: "#34d399" });
      const pMesh = new THREE.Mesh(particleGeo, pMat);
      group.add(pMesh);
      particles.push(pMesh);
      particlePhase.push(k / 3);
    }

    scene.add(group);
    bankHandles.push({
      bankNum: pair.bankNum,
      group,
      centerPos: pos.clone(),
      fillA: cylA.fill,
      fillB: cylB.fill,
      ringA: cylA.ring,
      ringB: cylB.ring,
      stateSpriteA: cylA.stateSprite,
      stateSpriteB: cylB.stateSprite,
      lastStateA: cylA.initLabel,
      lastStateB: cylB.initLabel,
      beacon,
      particles,
      particlePhase,
      isAOpen: pair.chA.valveState === 0,
      gasColor,
    });
  }

  const dispose = () => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      } else if (obj instanceof THREE.Sprite) {
        obj.material?.map?.dispose();
        obj.material?.dispose();
      }
    });
  };

  return { scene, bankHandles, clickableMeshes, dispose };
}

function getCylinderStateKey(ch: ChannelData): string {
  if (ch.status === "SENSOR_FAULT") return "점검";
  if (ch.valveState === 0) return "공급중";
  if (ch.pressureBar <= (ch.dangerBar || 15)) return "교체필요";
  return "대기중";
}

function updateStateSpriteIfChanged(
  sprite: THREE.Sprite,
  prevKey: string,
  nextKey: string
): string {
  if (prevKey === nextKey) return prevKey;
  const oldMap = sprite.material.map;
  if (nextKey === "공급중") {
    sprite.material.map = createStateBadgeTexture(
      "공급중",
      "rgba(16, 185, 129, 0.96)",
      "#6ee7b7",
      "#022c22"
    );
  } else if (nextKey === "교체필요") {
    sprite.material.map = createStateBadgeTexture(
      "교체필요",
      "rgba(225, 29, 72, 0.95)",
      "#fda4af",
      "#ffffff"
    );
  } else if (nextKey === "점검") {
    sprite.material.map = createStateBadgeTexture(
      "점검",
      "rgba(147, 51, 234, 0.95)",
      "#d8b4fe",
      "#ffffff"
    );
  } else {
    sprite.material.map = createStateBadgeTexture(
      "대기중",
      "rgba(30, 41, 59, 0.9)",
      "#475569",
      "#cbd5e1"
    );
  }
  sprite.material.needsUpdate = true;
  oldMap?.dispose();
  return nextKey;
}

export function updateDigitalTwinScene(
  handles: BankMeshHandle[],
  allPairs: BankPairItem[],
  elapsedSec: number,
  selectedBankNum: number | null
) {
  for (const h of handles) {
    const pair = allPairs.find((p) => p.bankNum === h.bankNum);
    if (!pair) continue;

    const { chA, chB } = pair;
    const isAOpen = chA.valveState === 0;
    const isBOpen = chB.valveState === 0;
    h.isAOpen = isAOpen;

    // 1. 실린더 내부 잔량 높이 & 공급중/대기중 확실한 발광 대비
    const pctA = Math.max(0.05, getGasPhysicsMeta(chA.gasCode, chA.pressureBar, chA.maxBar).realMassPct / 100);
    const pctB = Math.max(0.05, getGasPhysicsMeta(chB.gasCode, chB.pressureBar, chB.maxBar).realMassPct / 100);
    h.fillA.scale.y = pctA;
    h.fillA.position.y = 0.16 + (1.75 * pctA) / 2;
    h.fillB.scale.y = pctB;
    h.fillB.position.y = 0.16 + (1.75 * pctB) / 2;

    const fillAMat = h.fillA.material as THREE.MeshStandardMaterial;
    const fillBMat = h.fillB.material as THREE.MeshStandardMaterial;
    if (isAOpen) {
      fillAMat.color.copy(h.gasColor);
      fillAMat.emissive.copy(h.gasColor);
      fillAMat.emissiveIntensity = 0.95;
    } else {
      fillAMat.color.set("#475569");
      fillAMat.emissive.set("#1e293b");
      fillAMat.emissiveIntensity = 0.14;
    }
    if (isBOpen) {
      fillBMat.color.copy(h.gasColor);
      fillBMat.emissive.copy(h.gasColor);
      fillBMat.emissiveIntensity = 0.95;
    } else {
      fillBMat.color.set("#475569");
      fillBMat.emissive.set("#1e293b");
      fillBMat.emissiveIntensity = 0.14;
    }

    // 2. 바닥 네온 링 (공급중 = 초록 네온 맥동 / 대기중 = 어두운 회색)
    const pulse = 1.1 + 0.7 * Math.sin(elapsedSec * 4.2 + h.bankNum);
    const ringAMat = h.ringA.material as THREE.MeshStandardMaterial;
    const ringBMat = h.ringB.material as THREE.MeshStandardMaterial;
    ringAMat.color.set(isAOpen ? "#10b981" : "#334155");
    ringAMat.emissive.set(isAOpen ? "#10b981" : "#0f172a");
    ringAMat.emissiveIntensity = isAOpen ? pulse * 1.6 : 0.05;

    ringBMat.color.set(isBOpen ? "#10b981" : "#334155");
    ringBMat.emissive.set(isBOpen ? "#10b981" : "#0f172a");
    ringBMat.emissiveIntensity = isBOpen ? pulse * 1.6 : 0.05;

    // 3. [공급중 / 대기중] 3D 라벨 실시간 동기화
    h.lastStateA = updateStateSpriteIfChanged(
      h.stateSpriteA,
      h.lastStateA,
      getCylinderStateKey(chA)
    );
    h.lastStateB = updateStateSpriteIfChanged(
      h.stateSpriteB,
      h.lastStateB,
      getCylinderStateKey(chB)
    );

    // 4. 상단 상태 비콘
    const hasDanger = chA.status === "DANGER" || chB.status === "DANGER";
    const hasFault = chA.status === "SENSOR_FAULT" || chB.status === "SENSOR_FAULT";
    const hasWarn = chA.status === "WARN" || chB.status === "WARN";
    const beaconMat = h.beacon.material as THREE.MeshStandardMaterial;

    if (hasDanger) {
      beaconMat.color.set("#f43f5e");
      beaconMat.emissive.set("#f43f5e");
      beaconMat.emissiveIntensity = 1.0 + 1.2 * Math.abs(Math.sin(elapsedSec * 8));
    } else if (hasFault) {
      beaconMat.color.set("#a855f7");
      beaconMat.emissive.set("#a855f7");
      beaconMat.emissiveIntensity = 1.0 + 1.0 * Math.abs(Math.sin(elapsedSec * 6));
    } else if (hasWarn) {
      beaconMat.color.set("#f59e0b");
      beaconMat.emissive.set("#f59e0b");
      beaconMat.emissiveIntensity = 1.2;
    } else {
      beaconMat.color.set("#10b981");
      beaconMat.emissive.set("#10b981");
      beaconMat.emissiveIntensity = h.bankNum === selectedBankNum ? 2.0 : 1.0;
    }

    // 5. 공급중인 실린더 -> 상단 매니폴드로 흐르는 가스 입자 모션
    const activeX = isAOpen ? -0.54 : isBOpen ? 0.54 : 0;
    h.particles.forEach((p, idx) => {
      if (!isAOpen && !isBOpen) {
        p.visible = false;
        return;
      }
      p.visible = true;
      const t = (elapsedSec * 0.9 + h.particlePhase[idx]) % 1;
      p.position.set(activeX * (1 - t * 0.7), 2.35 + t * 0.7, 0);
      const s = 0.85 + 0.45 * Math.sin(t * Math.PI);
      p.scale.setScalar(s);
    });
  }
}
