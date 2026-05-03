import * as THREE from "three";

export interface EnemyData {
  id: number;
  position: [number, number, number];
  alive: boolean;
  respawnTimer: number;
}

export interface BulletTrail {
  id: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  createdAt: number;
}

export interface ImpactMark {
  id: number;
  position: THREE.Vector3;
  createdAt: number;
}

export interface SmokeOrb {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  createdAt: number;
  moving: boolean;
}
