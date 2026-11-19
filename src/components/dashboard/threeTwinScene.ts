/**
 * 파일명: src/components/dashboard/threeTwinScene.ts
 * 역할: Three.js 단일 WebGL 씬 빌더 & 실시간 모션그래픽 업데이터
 *  - 앞열(Z = +2.8): 제1구역 가스캐비닛 5뱅크 (1~5번 뱅크)
 *  - 뒷열(Z = -2.8): 제2·3구역 오토체인지 6뱅크 (6~11번 뱅크)
 *  - 각 뱅크: 반투명 유리 실린더 2기 + 실시간 잔량 발광 코어 + 돔 숄더 + 황동 밸브 + 절체 매니폴드 + 가스 흐름 파티클
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
    const x = (bankNum - 3) * 3.1; // -6.2, -3.1, 0, 3.1, 6.2
    return new THREE.Vector3(x, 0, 2.7);
  }
  const idx = bankNum - 6; // 0..5
  const x = (idx - 2.5) * 2.85;
  return new THREE.Vector3(x, 0, -2.7);
}

export function buildDigitalTwinScene(allPairs: BankPairItem[]): TwinSceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#030816");
  scene.fog = new THREE.FogExp2("#030816", 0.024);

  // 조명 세팅 (클린룸 메탈릭 + 네온 하이라이트)
  const ambient = new THREE.AmbientLight("#93c5fd", 1.15);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight("#ffffff", 2.2);
  keyLight.position.set(10, 18, 12);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight("#38bdf8", 1.3);
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

  // 공정 공급 메인 헤더 파이프 (상단 연결 배관)
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
  const ringGeo = new THREE.TorusGeometry(0.42, 0.032, 10, 28);
  const manifoldGeo = new THREE.BoxGeometry(1.15, 0.32, 0.38);
  const beaconGeo = new THREE.SphereGeometry(0.12, 14, 14);
  const particleGeo = new THREE.SphereGeometry(0.065, 10, 10);

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
    const gasColor = new THREE.Color(pair.chA.color || "#0ea5e9");
    const group = new THREE.Group();
    group.position.copy(pos);

    // 뱅크 바닥 발판(클릭 히트박스 겸 네온 베이스)
    const baseMat = new THREE.MeshStandardMaterial({
      color: "#0b1933",
      emissive: gasColor,
      emissiveIntensity: 0.16,
      metalness: 0.6,
      roughness: 0.3,
    });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.12, 1.35), baseMat);
    baseMesh.position.y = 0.06;
    baseMesh.userData = { bankNum: pair.bankNum };
    group.add(baseMesh);
    clickableMeshes.push(baseMesh);

    const buildCylinder = (offsetX: number, ch: ChannelData) => {
      // 유리 외피 + 돔 숄더
      const outer = new THREE.Mesh(outerCylGeo, glassMat);
      outer.position.set(offsetX, 1.05, 0);
      outer.userData = { bankNum: pair.bankNum };
      group.add(outer);
      clickableMeshes.push(outer);

      const dome = new THREE.Mesh(domeGeo, glassMat);
      dome.position.set(offsetX, 1.97, 0);
      group.add(dome);

      // 내부 발광 가스 잔량 코어
      const fillMat = new THREE.MeshStandardMaterial({
        color: gasColor,
        emissive: gasColor,
        emissiveIntensity: 0.55,
        roughness: 0.25,
      });
      const fill = new THREE.Mesh(fillCylGeo, fillMat);
      fill.position.set(offsetX, 1.02, 0);
      group.add(fill);

      // 황동 밸브 & 핸들
      const valve = new THREE.Mesh(valveGeo, brassMat);
      valve.position.set(offsetX, 2.38, 0);
      group.add(valve);

      const wheel = new THREE.Mesh(wheelGeo, brassMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(offsetX, 2.52, 0);
      group.add(wheel);

      // 바닥 네온 링 (공급중일 때 밝게 맥동)
      const ringMat = new THREE.MeshStandardMaterial({
        color: "#10b981",
        emissive: "#10b981",
        emissiveIntensity: ch.valveState === 0 ? 1.4 : 0.1,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(offsetX, 0.14, 0);
      group.add(ring);

      return { fill, ring };
    };

    const cylA = buildCylinder(-0.52, pair.chA);
    const cylB = buildCylinder(0.52, pair.chB);

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

    // 피그테일 상승 파이프 & 가스 흐름 모션 파티클 (3개)
    const particles: THREE.Mesh[] = [];
    const particlePhase: number[] = [];
    for (let k = 0; k < 3; k++) {
      const pMat = new THREE.MeshBasicMaterial({ color: gasColor });
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
      }
    });
  };

  return { scene, bankHandles, clickableMeshes, dispose };
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

    // 1. 실린더 내부 잔량 높이 실시간 스케일링
    const pctA = Math.max(0.05, getGasPhysicsMeta(chA.gasCode, chA.pressureBar, chA.maxBar).realMassPct / 100);
    const pctB = Math.max(0.05, getGasPhysicsMeta(chB.gasCode, chB.pressureBar, chB.maxBar).realMassPct / 100);
    h.fillA.scale.y = pctA;
    h.fillA.position.y = 0.16 + (1.75 * pctA) / 2;
    h.fillB.scale.y = pctB;
    h.fillB.position.y = 0.16 + (1.75 * pctB) / 2;

    // 2. 공급중 바닥 네온 링 맥동
    const pulse = 1.0 + 0.5 * Math.sin(elapsedSec * 4.2 + h.bankNum);
    const ringAMat = h.ringA.material as THREE.MeshStandardMaterial;
    const ringBMat = h.ringB.material as THREE.MeshStandardMaterial;
    ringAMat.emissiveIntensity = isAOpen ? pulse * 1.3 : 0.08;
    ringBMat.emissiveIntensity = isBOpen ? pulse * 1.3 : 0.08;

    // 3. 상단 상태 비콘 (위험/센서고장 점멸)
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

    // 4. 공급중인 실린더 -> 상단 매니폴드로 흐르는 가스 입자 모션
    const activeX = isAOpen ? -0.52 : isBOpen ? 0.52 : 0;
    h.particles.forEach((p, idx) => {
      if (!isAOpen && !isBOpen) {
        p.visible = false;
        return;
      }
      p.visible = true;
      const t = (elapsedSec * 0.85 + h.particlePhase[idx]) % 1;
      p.position.set(activeX * (1 - t * 0.7), 2.35 + t * 0.7, 0);
      const s = 0.8 + 0.4 * Math.sin(t * Math.PI);
      p.scale.setScalar(s);
    });
  }
}
