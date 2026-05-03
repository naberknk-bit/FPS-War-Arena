import { useMemo } from "react";
import * as THREE from "three";

export type MapId = "astral" | "canyon" | "frost" | "ruins" | "mars" | "volcano" | "space" | "egypt" | "cyberpunk" | "underwater";

export const MAP_LIST: { id: MapId; name: string; desc: string; icon: string; accentColor: string }[] = [
  { id: "astral",    name: "ASTRAL",    desc: "Neon siber kompleks",      icon: "🌐", accentColor: "#00eeff" },
  { id: "canyon",    name: "KANYON",    desc: "Çöl kaya arenası",         icon: "🏜️", accentColor: "#ff8844" },
  { id: "frost",     name: "BUZUL",     desc: "Arktik araştırma üssü",    icon: "❄️", accentColor: "#88ddff" },
  { id: "ruins",     name: "HARİBELER", desc: "Antik tapınak kalıntısı",  icon: "🏛️", accentColor: "#cc88ff" },
  { id: "mars",      name: "MARS",      desc: "Kızıl gezegen savaş alanı",icon: "🔴", accentColor: "#ff4422" },
  { id: "volcano",   name: "VOLKAN",    desc: "Lav akıntılı yanardağ",    icon: "🌋", accentColor: "#ff6600" },
  { id: "space",     name: "UZAY",      desc: "Yıldızlar arası istasyon", icon: "🚀", accentColor: "#8844ff" },
  { id: "egypt",     name: "MISIR",     desc: "Antik firavun çölü",       icon: "🏺", accentColor: "#ffcc00" },
  { id: "cyberpunk", name: "SİBERPUNK", desc: "Neon metropol savaşı",     icon: "🤖", accentColor: "#ff00ff" },
  { id: "underwater",name: "SU ALTI",   desc: "Okyanus derinlikleri üssü",icon: "🌊", accentColor: "#00ccff" },
];

export interface MapConfig {
  gravityMultiplier: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  bgColor: string;
  lavaDamageZones: { x: number; z: number; r: number }[];
  portals: { from: [number,number,number]; to: [number,number,number]; col: string }[];
  ambientSoundHint: string;
}

export const MAP_CONFIGS: Record<MapId, MapConfig> = {
  astral:    { gravityMultiplier:1.0, fogColor:"#020208", fogNear:35, fogFar:60, bgColor:"#020208",     lavaDamageZones:[], portals:[], ambientSoundHint:"digital hum" },
  canyon:    { gravityMultiplier:1.0, fogColor:"#110800", fogNear:30, fogFar:55, bgColor:"#110800",     lavaDamageZones:[], portals:[], ambientSoundHint:"desert wind" },
  frost:     { gravityMultiplier:1.0, fogColor:"#030a14", fogNear:32, fogFar:58, bgColor:"#030a14",     lavaDamageZones:[], portals:[], ambientSoundHint:"arctic wind" },
  ruins:     { gravityMultiplier:1.0, fogColor:"#080010", fogNear:30, fogFar:55, bgColor:"#080010",     lavaDamageZones:[], portals:[], ambientSoundHint:"stone echo" },
  mars:      { gravityMultiplier:0.5, fogColor:"#3a0a00", fogNear:20, fogFar:45, bgColor:"#1a0500",     lavaDamageZones:[], portals:[], ambientSoundHint:"low frequency rumble" },
  volcano:   { gravityMultiplier:1.0, fogColor:"#1a0500", fogNear:18, fogFar:40, bgColor:"#0d0200",     lavaDamageZones:[{x:-15,z:-15,r:6},{x:15,z:15,r:6},{x:0,z:20,r:5}], portals:[], ambientSoundHint:"lava bubbling" },
  space:     { gravityMultiplier:0.7, fogColor:"#02000a", fogNear:30, fogFar:60, bgColor:"#02000a",     lavaDamageZones:[], portals:[{from:[-20,0,-20],to:[20,0,20],col:"#8844ff"},{from:[20,0,-20],to:[-20,0,20],col:"#ff44aa"}], ambientSoundHint:"space silence" },
  egypt:     { gravityMultiplier:1.0, fogColor:"#1a1200", fogNear:28, fogFar:55, bgColor:"#110c00",     lavaDamageZones:[], portals:[], ambientSoundHint:"desert wind" },
  cyberpunk: { gravityMultiplier:1.0, fogColor:"#050010", fogNear:22, fogFar:48, bgColor:"#030008",     lavaDamageZones:[], portals:[], ambientSoundHint:"rain on city" },
  underwater:{ gravityMultiplier:0.6, fogColor:"#001520", fogNear:15, fogFar:38, bgColor:"#000d18",     lavaDamageZones:[], portals:[], ambientSoundHint:"underwater bubbles" },
};

// ─── Shared geometry helpers ──────────────────────────────────────────────────
function Wall({ pos, size, col, emit = "#000", emitInt = 0 }: {
  pos:[number,number,number]; size:[number,number,number];
  col:string; emit?:string; emitInt?:number;
}) {
  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={col} emissive={emit} emissiveIntensity={emitInt} roughness={0.7} metalness={0.2} />
    </mesh>
  );
}
function Cover({ pos, size=[2,1.5,2] as [number,number,number], col, topGlow, topGlowCol="transparent" }: {
  pos:[number,number,number]; size?:[number,number,number];
  col:string; topGlow?:boolean; topGlowCol?:string;
}) {
  return (
    <group>
      <mesh position={pos} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={col} roughness={0.65} metalness={0.15} />
      </mesh>
      {topGlow && (
        <mesh position={[pos[0], pos[1]+size[1]/2+0.03, pos[2]]}>
          <boxGeometry args={[size[0]+0.05, 0.07, size[2]+0.05]} />
          <meshStandardMaterial color={topGlowCol} emissive={topGlowCol} emissiveIntensity={3} roughness={0} metalness={1} />
        </mesh>
      )}
    </group>
  );
}
function NeonBar({ pos, len, axis="x", col }: {
  pos:[number,number,number]; len:number; axis?:"x"|"z"; col:string;
}) {
  const sz: [number,number,number] = axis==="x" ? [len,0.07,0.07] : [0.07,0.07,len];
  return (
    <mesh position={pos}>
      <boxGeometry args={sz} />
      <meshStandardMaterial color={col} emissive={col} emissiveIntensity={4} roughness={0} metalness={1} />
    </mesh>
  );
}
function GridLine({ from, to, col }: { from:[number,number,number]; to:[number,number,number]; col:string }) {
  const mid:[number,number,number] = [(from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2];
  const dx=to[0]-from[0], dz=to[2]-from[2];
  return (
    <mesh position={mid} rotation={[0,Math.atan2(dx,dz),0]}>
      <boxGeometry args={[0.05,0.01,Math.sqrt(dx*dx+dz*dz)]} />
      <meshStandardMaterial color={col} emissive={col} emissiveIntensity={2.5} roughness={0} />
    </mesh>
  );
}

// ─── ASTRAL (neon cyberpunk) ──────────────────────────────────────────────────
function MapAstral() {
  return (
    <group>
      <ambientLight intensity={0.03} color="#0011aa" />
      <directionalLight position={[5,10,5]} intensity={0.02} color="#1133ff" castShadow />
      <pointLight position={[-15,3,-15]} color="#0044ff" intensity={5}   distance={35} decay={2} />
      <pointLight position={[15,3,15]}   color="#ff0080" intensity={5}   distance={35} decay={2} />
      <pointLight position={[15,3,-15]}  color="#00ff88" intensity={4}   distance={30} decay={2} />
      <pointLight position={[-15,3,15]}  color="#ff6600" intensity={4}   distance={30} decay={2} />
      <pointLight position={[0,4.8,0]}   color="#8800ff" intensity={3}   distance={20} decay={2} />
      <pointLight position={[-10,0.3,10]} color="#00eeff" intensity={2.5} distance={10} decay={2} />
      <pointLight position={[10,0.3,-10]} color="#ff0080" intensity={2.5} distance={10} decay={2} />
      <pointLight position={[-27,1,-27]}  color="#0044ff" intensity={3}  distance={18} decay={2} />
      <pointLight position={[27,1,27]}    color="#ff0080" intensity={3}  distance={18} decay={2} />
      <pointLight position={[27,1,-27]}   color="#00ff88" intensity={2.5} distance={16} decay={2} />
      <pointLight position={[-27,1,27]}   color="#ff6600" intensity={2.5} distance={16} decay={2} />
      <pointLight position={[-5,2.5,0]}   color="#00eeff" intensity={2}  distance={10} decay={2} />
      <pointLight position={[5,2.5,0]}    color="#ff0080" intensity={2}  distance={10} decay={2} />
      {/* Floor */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#050510" roughness={0.1} metalness={0.8} emissive="#000020" emissiveIntensity={1} />
      </mesh>
      {[-20,-10,0,10,20].map(v=><GridLine key={`gx${v}`} from={[v,0.005,-29]} to={[v,0.005,29]} col={v===0?"#00eeff":"#0022aa"} />)}
      {[-20,-10,0,10,20].map(v=><GridLine key={`gz${v}`} from={[-29,0.005,v]} to={[29,0.005,v]} col={v===0?"#ff0080":"#220022"} />)}
      {/* Ceiling */}
      <mesh rotation={[Math.PI/2,0,0]} position={[0,5,0]}>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#020208" roughness={1} emissive="#0000ff" emissiveIntensity={0.04} />
      </mesh>
      <NeonBar pos={[0,4.92,0]}   len={55} axis="x" col="#8800ff" />
      <NeonBar pos={[0,4.92,0]}   len={55} axis="z" col="#8800ff" />
      <NeonBar pos={[-14,4.92,0]} len={20} axis="z" col="#0044ff" />
      <NeonBar pos={[14,4.92,0]}  len={20} axis="z" col="#ff0080" />
      <NeonBar pos={[0,4.92,-14]} len={20} axis="x" col="#00ff88" />
      <NeonBar pos={[0,4.92,14]}  len={20} axis="x" col="#ff6600" />
      {/* Walls */}
      <Wall pos={[0,2.5,-30]}  size={[60,5,0.5]} col="#0a0a18" emit="#0044ff" emitInt={0.08} />
      <Wall pos={[0,2.5,30]}   size={[60,5,0.5]} col="#0a0a18" emit="#ff0080" emitInt={0.08} />
      <Wall pos={[-30,2.5,0]}  size={[0.5,5,60]} col="#0a0a18" emit="#00ff88" emitInt={0.08} />
      <Wall pos={[30,2.5,0]}   size={[0.5,5,60]} col="#0a0a18" emit="#ff6600" emitInt={0.08} />
      <NeonBar pos={[0,4.85,-29.7]}  len={58} axis="x" col="#0044ff" />
      <NeonBar pos={[0,4.85,29.7]}   len={58} axis="x" col="#ff0080" />
      <NeonBar pos={[-29.7,4.85,0]}  len={58} axis="z" col="#00ff88" />
      <NeonBar pos={[29.7,4.85,0]}   len={58} axis="z" col="#ff6600" />
      <NeonBar pos={[0,0.04,-29.7]}  len={58} axis="x" col="#00eeff" />
      <NeonBar pos={[0,0.04,29.7]}   len={58} axis="x" col="#ff0080" />
      <NeonBar pos={[-29.7,0.04,0]}  len={58} axis="z" col="#00ff88" />
      <NeonBar pos={[29.7,0.04,0]}   len={58} axis="z" col="#ff6600" />
      {/* Spike */}
      <mesh position={[0,0.06,0]} receiveShadow>
        <cylinderGeometry args={[5,5,0.12,32]} />
        <meshStandardMaterial color="#ff8c00" roughness={0.2} metalness={0.9} emissive="#ff4400" emissiveIntensity={2.5} />
      </mesh>
      <mesh position={[0,0.05,0]}>
        <torusGeometry args={[5.2,0.18,8,64]} />
        <meshStandardMaterial color="#ffaa33" emissive="#ff6600" emissiveIntensity={4} roughness={0} />
      </mesh>
      <pointLight position={[0,1.5,0]} color="#ff8800" intensity={6} distance={14} decay={2} />
      {/* Cover */}
      {[
        {p:[-10,0.75,-8] as [number,number,number],s:[2.5,1.5,2.5] as [number,number,number],c:"#0c0c1e",g:"#00eeff"},
        {p:[-12,0.75,-5] as [number,number,number],s:[2,1.5,4]     as [number,number,number],c:"#0c0c1e",g:"#0044ff"},
        {p:[-8,0.75,-12] as [number,number,number],s:[3,1.5,2]     as [number,number,number],c:"#0c0c1e",g:"#8800ff"},
        {p:[10,0.75,8]   as [number,number,number],s:[2.5,1.5,2.5] as [number,number,number],c:"#0c0c1e",g:"#ff0080"},
        {p:[12,0.75,5]   as [number,number,number],s:[2,1.5,4]     as [number,number,number],c:"#0c0c1e",g:"#ff6600"},
        {p:[8,0.75,12]   as [number,number,number],s:[3,1.5,2]     as [number,number,number],c:"#0c0c1e",g:"#ffee00"},
        {p:[-18,1.5,-2]  as [number,number,number],s:[8,3,0.5]     as [number,number,number],c:"#0c0c1e",g:"#00eeff"},
        {p:[-18,1.5,6]   as [number,number,number],s:[8,3,0.5]     as [number,number,number],c:"#0c0c1e",g:"#0044ff"},
        {p:[-14,1.5,2]   as [number,number,number],s:[0.5,3,8]     as [number,number,number],c:"#0c0c1e",g:"#8800ff"},
        {p:[20,1.5,-3]   as [number,number,number],s:[0.5,3,8]     as [number,number,number],c:"#0c0c1e",g:"#ff0080"},
        {p:[14,1.5,-7]   as [number,number,number],s:[12,3,0.5]    as [number,number,number],c:"#0c0c1e",g:"#ff6600"},
        {p:[14,1.5,1]    as [number,number,number],s:[12,3,0.5]    as [number,number,number],c:"#0c0c1e",g:"#00ff88"},
        {p:[5,0.75,-15]  as [number,number,number],s:[2,1.5,2]     as [number,number,number],c:"#0c0c1e",g:"#00eeff"},
        {p:[-5,0.75,15]  as [number,number,number],s:[2,1.5,2]     as [number,number,number],c:"#0c0c1e",g:"#ff0080"},
        {p:[18,0.75,18]  as [number,number,number],s:[3,1.5,3]     as [number,number,number],c:"#0c0c1e",g:"#0044ff"},
        {p:[-18,0.75,-18]as [number,number,number],s:[3,1.5,3]     as [number,number,number],c:"#0c0c1e",g:"#ff6600"},
        {p:[0,0.75,-18]  as [number,number,number],s:[4,1.5,2]     as [number,number,number],c:"#0c0c1e",g:"#8800ff"},
        {p:[0,0.75,18]   as [number,number,number],s:[4,1.5,2]     as [number,number,number],c:"#0c0c1e",g:"#ffee00"},
      ].map((o,i)=><Cover key={i} pos={o.p} size={o.s} col={o.c} topGlow topGlowCol={o.g} />)}
      <Wall pos={[-5,2.5,0]}  size={[0.5,5,12]} col="#0a0a18" emit="#00eeff" emitInt={0.08} />
      <Wall pos={[5,2.5,0]}   size={[0.5,5,12]} col="#0a0a18" emit="#ff0080" emitInt={0.08} />
    </group>
  );
}

// ─── CANYON (desert / warm) ───────────────────────────────────────────────────
function MapCanyon() {
  return (
    <group>
      <ambientLight intensity={0.18} color="#ff9955" />
      <directionalLight position={[8,12,-4]} intensity={0.8} color="#ffcc88" castShadow />
      <pointLight position={[0,4,0]}     color="#ff8800" intensity={3}  distance={25} decay={2} />
      <pointLight position={[-15,2,-15]} color="#ff6600" intensity={2}  distance={20} decay={2} />
      <pointLight position={[15,2,15]}   color="#ff9933" intensity={2}  distance={20} decay={2} />
      <pointLight position={[15,2,-15]}  color="#ffcc44" intensity={1.5} distance={18} decay={2} />
      <pointLight position={[-15,2,15]}  color="#ff7722" intensity={1.5} distance={18} decay={2} />
      {/* Floor — sandy */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#b87c40" roughness={0.95} metalness={0} />
      </mesh>
      {/* Ceiling — open sky tint */}
      <mesh rotation={[Math.PI/2,0,0]} position={[0,6,0]}>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#221108" roughness={1} />
      </mesh>
      {/* Walls — sandstone */}
      {([
        {p:[0,3,-30]  as [number,number,number],s:[60,6,0.6] as [number,number,number]},
        {p:[0,3,30]   as [number,number,number],s:[60,6,0.6] as [number,number,number]},
        {p:[-30,3,0]  as [number,number,number],s:[0.6,6,60] as [number,number,number]},
        {p:[30,3,0]   as [number,number,number],s:[0.6,6,60] as [number,number,number]},
      ] as {p:[number,number,number];s:[number,number,number]}[]).map((w,i)=>(
        <Wall key={i} pos={w.p} size={w.s} col="#9b6535" emit="#ff6600" emitInt={0.05} />
      ))}
      {/* Spike — carved ring */}
      <mesh position={[0,0.06,0]} receiveShadow>
        <cylinderGeometry args={[5,5,0.14,32]} />
        <meshStandardMaterial color="#cc5500" roughness={0.5} metalness={0.3} emissive="#882200" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0,0.05,0]}>
        <torusGeometry args={[5.2,0.2,8,64]} />
        <meshStandardMaterial color="#ff8833" emissive="#ff5500" emissiveIntensity={3} roughness={0} />
      </mesh>
      <pointLight position={[0,1.5,0]} color="#ff6600" intensity={4} distance={12} decay={2} />
      {/* Rocky cover — tall boulders */}
      {([
        {p:[-10,1,-8]  as [number,number,number],s:[3,2,3]    as [number,number,number]},
        {p:[-12,1,-5]  as [number,number,number],s:[2.5,2,4.5]as [number,number,number]},
        {p:[-8,1,-12]  as [number,number,number],s:[4,2,2.5]  as [number,number,number]},
        {p:[10,1,8]    as [number,number,number],s:[3,2,3]    as [number,number,number]},
        {p:[12,1,5]    as [number,number,number],s:[2.5,2,4.5]as [number,number,number]},
        {p:[8,1,12]    as [number,number,number],s:[4,2,2.5]  as [number,number,number]},
        {p:[-18,2,-2]  as [number,number,number],s:[8,4,0.7]  as [number,number,number]},
        {p:[-18,2,6]   as [number,number,number],s:[8,4,0.7]  as [number,number,number]},
        {p:[-14,2,2]   as [number,number,number],s:[0.7,4,8]  as [number,number,number]},
        {p:[20,2,-3]   as [number,number,number],s:[0.7,4,8]  as [number,number,number]},
        {p:[14,2,-7]   as [number,number,number],s:[12,4,0.7] as [number,number,number]},
        {p:[14,2,1]    as [number,number,number],s:[12,4,0.7] as [number,number,number]},
        {p:[5,1,-15]   as [number,number,number],s:[2.5,2,2.5]as [number,number,number]},
        {p:[-5,1,15]   as [number,number,number],s:[2.5,2,2.5]as [number,number,number]},
        {p:[18,1,18]   as [number,number,number],s:[4,2,4]    as [number,number,number]},
        {p:[-18,1,-18] as [number,number,number],s:[4,2,4]    as [number,number,number]},
        {p:[0,1,-18]   as [number,number,number],s:[5,2,2.5]  as [number,number,number]},
        {p:[0,1,18]    as [number,number,number],s:[5,2,2.5]  as [number,number,number]},
      ] as {p:[number,number,number];s:[number,number,number]}[]).map((o,i)=>(
        <Cover key={i} pos={o.p} size={o.s} col="#8b5e3c" />
      ))}
      {/* Canyon pillars (extra) */}
      {([[-5,2.5,0],[5,2.5,0]] as [number,number,number][]).map((p,i)=>(
        <Wall key={`pillar${i}`} pos={p} size={[0.8,5,12]} col="#9b6535" />
      ))}
    </group>
  );
}

// ─── FROST (arctic base) ──────────────────────────────────────────────────────
function MapFrost() {
  return (
    <group>
      <ambientLight intensity={0.12} color="#aaddff" />
      <directionalLight position={[0,10,0]} intensity={0.4} color="#cceeff" castShadow />
      <pointLight position={[0,4,0]}     color="#88ccff" intensity={4}  distance={30} decay={2} />
      <pointLight position={[-15,2,-15]} color="#00aaff" intensity={3}  distance={22} decay={2} />
      <pointLight position={[15,2,15]}   color="#0088ff" intensity={3}  distance={22} decay={2} />
      <pointLight position={[15,2,-15]}  color="#44ddff" intensity={2.5} distance={20} decay={2} />
      <pointLight position={[-15,2,15]}  color="#00ccdd" intensity={2.5} distance={20} decay={2} />
      <pointLight position={[-27,1,-27]} color="#aaeeff" intensity={2}  distance={15} decay={2} />
      <pointLight position={[27,1,27]}   color="#aaeeff" intensity={2}  distance={15} decay={2} />
      {/* Floor — icy reflective */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#b8dff0" roughness={0.05} metalness={0.9} emissive="#002244" emissiveIntensity={0.3} />
      </mesh>
      {/* Ice grid cracks */}
      {[-20,-10,0,10,20].map(v=><GridLine key={`ix${v}`} from={[v,0.005,-29]} to={[v,0.005,29]} col="#aaddff" />)}
      {[-20,-10,0,10,20].map(v=><GridLine key={`iz${v}`} from={[-29,0.005,v]} to={[29,0.005,v]} col="#88bbff" />)}
      {/* Ceiling — frosted */}
      <mesh rotation={[Math.PI/2,0,0]} position={[0,5.5,0]}>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#0a1a2a" roughness={0.8} emissive="#002255" emissiveIntensity={0.15} />
      </mesh>
      {/* Ceiling tubes */}
      <NeonBar pos={[0,5.4,0]}  len={55} axis="x" col="#88ddff" />
      <NeonBar pos={[0,5.4,0]}  len={55} axis="z" col="#88ddff" />
      {/* Walls — metal ice */}
      {([
        {p:[0,2.75,-30]  as [number,number,number],s:[60,5.5,0.5] as [number,number,number]},
        {p:[0,2.75,30]   as [number,number,number],s:[60,5.5,0.5] as [number,number,number]},
        {p:[-30,2.75,0]  as [number,number,number],s:[0.5,5.5,60] as [number,number,number]},
        {p:[30,2.75,0]   as [number,number,number],s:[0.5,5.5,60] as [number,number,number]},
      ] as {p:[number,number,number];s:[number,number,number]}[]).map((w,i)=>(
        <Wall key={i} pos={w.p} size={w.s} col="#1a3a55" emit="#00aaff" emitInt={0.12} />
      ))}
      <NeonBar pos={[0,5.38,-29.7]}  len={58} axis="x" col="#00eeff" />
      <NeonBar pos={[0,5.38,29.7]}   len={58} axis="x" col="#00eeff" />
      <NeonBar pos={[-29.7,5.38,0]}  len={58} axis="z" col="#0088ff" />
      <NeonBar pos={[29.7,5.38,0]}   len={58} axis="z" col="#0088ff" />
      <NeonBar pos={[0,0.04,-29.7]}  len={58} axis="x" col="#88ddff" />
      <NeonBar pos={[0,0.04,29.7]}   len={58} axis="x" col="#88ddff" />
      <NeonBar pos={[-29.7,0.04,0]}  len={58} axis="z" col="#44aaff" />
      <NeonBar pos={[29.7,0.04,0]}   len={58} axis="z" col="#44aaff" />
      {/* Spike */}
      <mesh position={[0,0.06,0]} receiveShadow>
        <cylinderGeometry args={[5,5,0.12,32]} />
        <meshStandardMaterial color="#44aaff" roughness={0.1} metalness={0.95} emissive="#0066ff" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0,0.05,0]}>
        <torusGeometry args={[5.2,0.18,8,64]} />
        <meshStandardMaterial color="#88ddff" emissive="#00aaff" emissiveIntensity={4} roughness={0} />
      </mesh>
      <pointLight position={[0,1.5,0]} color="#00aaff" intensity={5} distance={12} decay={2} />
      {/* Ice pillar covers */}
      {([
        {p:[-10,0.75,-8]  as [number,number,number],s:[2.2,1.5,2.2]as [number,number,number]},
        {p:[-12,0.75,-5]  as [number,number,number],s:[1.8,1.5,4.5]as [number,number,number]},
        {p:[-8,0.75,-12]  as [number,number,number],s:[3.5,1.5,1.8]as [number,number,number]},
        {p:[10,0.75,8]    as [number,number,number],s:[2.2,1.5,2.2]as [number,number,number]},
        {p:[12,0.75,5]    as [number,number,number],s:[1.8,1.5,4.5]as [number,number,number]},
        {p:[8,0.75,12]    as [number,number,number],s:[3.5,1.5,1.8]as [number,number,number]},
        {p:[-18,1.5,-2]   as [number,number,number],s:[8,3,0.5]    as [number,number,number]},
        {p:[-18,1.5,6]    as [number,number,number],s:[8,3,0.5]    as [number,number,number]},
        {p:[-14,1.5,2]    as [number,number,number],s:[0.5,3,8]    as [number,number,number]},
        {p:[20,1.5,-3]    as [number,number,number],s:[0.5,3,8]    as [number,number,number]},
        {p:[14,1.5,-7]    as [number,number,number],s:[12,3,0.5]   as [number,number,number]},
        {p:[14,1.5,1]     as [number,number,number],s:[12,3,0.5]   as [number,number,number]},
        {p:[5,0.75,-15]   as [number,number,number],s:[2,1.5,2]    as [number,number,number]},
        {p:[-5,0.75,15]   as [number,number,number],s:[2,1.5,2]    as [number,number,number]},
        {p:[18,0.75,18]   as [number,number,number],s:[3,1.5,3]    as [number,number,number]},
        {p:[-18,0.75,-18] as [number,number,number],s:[3,1.5,3]    as [number,number,number]},
        {p:[0,0.75,-18]   as [number,number,number],s:[4,1.5,2]    as [number,number,number]},
        {p:[0,0.75,18]    as [number,number,number],s:[4,1.5,2]    as [number,number,number]},
      ] as {p:[number,number,number];s:[number,number,number]}[]).map((o,i)=>(
        <Cover key={i} pos={o.p} size={o.s} col="#2255aa" topGlow topGlowCol="#88ddff" />
      ))}
      <Wall pos={[-5,2.75,0]}  size={[0.5,5.5,12]} col="#1a3a55" emit="#00aaff" emitInt={0.12} />
      <Wall pos={[5,2.75,0]}   size={[0.5,5.5,12]} col="#1a3a55" emit="#00aaff" emitInt={0.12} />
    </group>
  );
}

// ─── RUINS (ancient temple) ───────────────────────────────────────────────────
function MapRuins() {
  return (
    <group>
      <ambientLight intensity={0.06} color="#220033" />
      <directionalLight position={[0,8,0]} intensity={0.1} color="#551166" castShadow />
      <pointLight position={[0,4,0]}     color="#aa44ff" intensity={4}  distance={28} decay={2} />
      <pointLight position={[-15,2,-15]} color="#8800cc" intensity={3}  distance={22} decay={2} />
      <pointLight position={[15,2,15]}   color="#cc0088" intensity={3}  distance={22} decay={2} />
      <pointLight position={[15,2,-15]}  color="#ffaa00" intensity={2.5} distance={20} decay={2} />
      <pointLight position={[-15,2,15]}  color="#aa00ff" intensity={2.5} distance={20} decay={2} />
      <pointLight position={[-27,0.5,-27]} color="#880088" intensity={2} distance={15} decay={2} />
      <pointLight position={[27,0.5,27]}   color="#880088" intensity={2} distance={15} decay={2} />
      {/* Floor — ancient stone */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#1a1022" roughness={0.88} metalness={0.1} emissive="#0a0018" emissiveIntensity={0.6} />
      </mesh>
      {/* Stone tile grid */}
      {[-20,-10,0,10,20].map(v=><GridLine key={`rx${v}`} from={[v,0.005,-29]} to={[v,0.005,29]} col="#440066" />)}
      {[-20,-10,0,10,20].map(v=><GridLine key={`rz${v}`} from={[-29,0.005,v]} to={[29,0.005,v]} col="#440066" />)}
      {/* Ceiling — vaulted darkness */}
      <mesh rotation={[Math.PI/2,0,0]} position={[0,6,0]}>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#050008" roughness={1} emissive="#110022" emissiveIntensity={0.3} />
      </mesh>
      <NeonBar pos={[0,5.9,0]}  len={55} axis="x" col="#aa44ff" />
      <NeonBar pos={[0,5.9,0]}  len={55} axis="z" col="#aa44ff" />
      {/* Walls — stone brick */}
      {([
        {p:[0,3,-30]  as [number,number,number],s:[60,6,0.6] as [number,number,number]},
        {p:[0,3,30]   as [number,number,number],s:[60,6,0.6] as [number,number,number]},
        {p:[-30,3,0]  as [number,number,number],s:[0.6,6,60] as [number,number,number]},
        {p:[30,3,0]   as [number,number,number],s:[0.6,6,60] as [number,number,number]},
      ] as {p:[number,number,number];s:[number,number,number]}[]).map((w,i)=>(
        <Wall key={i} pos={w.p} size={w.s} col="#1c1030" emit="#660088" emitInt={0.1} />
      ))}
      <NeonBar pos={[0,5.88,-29.7]}  len={58} axis="x" col="#8800cc" />
      <NeonBar pos={[0,5.88,29.7]}   len={58} axis="x" col="#cc0088" />
      <NeonBar pos={[-29.7,5.88,0]}  len={58} axis="z" col="#aa44ff" />
      <NeonBar pos={[29.7,5.88,0]}   len={58} axis="z" col="#ffaa00" />
      <NeonBar pos={[0,0.04,-29.7]}  len={58} axis="x" col="#8800cc" />
      <NeonBar pos={[0,0.04,29.7]}   len={58} axis="x" col="#cc0088" />
      <NeonBar pos={[-29.7,0.04,0]}  len={58} axis="z" col="#aa44ff" />
      <NeonBar pos={[29.7,0.04,0]}   len={58} axis="z" col="#ffaa00" />
      {/* Spike — ritual circle */}
      <mesh position={[0,0.06,0]} receiveShadow>
        <cylinderGeometry args={[5,5,0.12,6]} />
        <meshStandardMaterial color="#550044" roughness={0.4} metalness={0.5} emissive="#cc0066" emissiveIntensity={2.5} />
      </mesh>
      <mesh position={[0,0.05,0]}>
        <torusGeometry args={[5.2,0.2,6,64]} />
        <meshStandardMaterial color="#ff44cc" emissive="#ff00aa" emissiveIntensity={4} roughness={0} />
      </mesh>
      <mesh position={[0,0.04,0]}>
        <torusGeometry args={[3.5,0.1,6,64]} />
        <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={3} roughness={0} />
      </mesh>
      <pointLight position={[0,1.5,0]} color="#ff44aa" intensity={6} distance={14} decay={2} />
      {/* Stone block covers */}
      {([
        {p:[-10,1,-8]   as [number,number,number],s:[2.5,2,2.5]as [number,number,number],g:"#8800cc"},
        {p:[-12,1,-5]   as [number,number,number],s:[2,2,4]    as [number,number,number],g:"#aa44ff"},
        {p:[-8,1,-12]   as [number,number,number],s:[3,2,2]    as [number,number,number],g:"#8800cc"},
        {p:[10,1,8]     as [number,number,number],s:[2.5,2,2.5]as [number,number,number],g:"#cc0088"},
        {p:[12,1,5]     as [number,number,number],s:[2,2,4]    as [number,number,number],g:"#ffaa00"},
        {p:[8,1,12]     as [number,number,number],s:[3,2,2]    as [number,number,number],g:"#aa44ff"},
        {p:[-18,2,-2]   as [number,number,number],s:[8,4,0.6]  as [number,number,number],g:"#8800cc"},
        {p:[-18,2,6]    as [number,number,number],s:[8,4,0.6]  as [number,number,number],g:"#aa44ff"},
        {p:[-14,2,2]    as [number,number,number],s:[0.6,4,8]  as [number,number,number],g:"#ffaa00"},
        {p:[20,2,-3]    as [number,number,number],s:[0.6,4,8]  as [number,number,number],g:"#cc0088"},
        {p:[14,2,-7]    as [number,number,number],s:[12,4,0.6] as [number,number,number],g:"#8800cc"},
        {p:[14,2,1]     as [number,number,number],s:[12,4,0.6] as [number,number,number],g:"#aa44ff"},
        {p:[5,1,-15]    as [number,number,number],s:[2,2,2]    as [number,number,number],g:"#cc0088"},
        {p:[-5,1,15]    as [number,number,number],s:[2,2,2]    as [number,number,number],g:"#ffaa00"},
        {p:[18,1,18]    as [number,number,number],s:[3,2,3]    as [number,number,number],g:"#aa44ff"},
        {p:[-18,1,-18]  as [number,number,number],s:[3,2,3]    as [number,number,number],g:"#8800cc"},
        {p:[0,1,-18]    as [number,number,number],s:[4,2,2]    as [number,number,number],g:"#ffaa00"},
        {p:[0,1,18]     as [number,number,number],s:[4,2,2]    as [number,number,number],g:"#aa44ff"},
      ] as {p:[number,number,number];s:[number,number,number];g:string}[]).map((o,i)=>(
        <Cover key={i} pos={o.p} size={o.s} col="#1a0e28" topGlow topGlowCol={o.g} />
      ))}
      {/* Temple pillars */}
      <Wall pos={[-5,3,0]}  size={[0.6,6,12]} col="#1c1030" emit="#660088" emitInt={0.1} />
      <Wall pos={[5,3,0]}   size={[0.6,6,12]} col="#1c1030" emit="#cc0088" emitInt={0.1} />
      {/* Extra columns */}
      {([ [-5,3,-14],[-5,3,14],[5,3,-14],[5,3,14] ] as [number,number,number][]).map((p,i)=>(
        <mesh key={`col${i}`} position={p}>
          <cylinderGeometry args={[0.5,0.6,6,8]} />
          <meshStandardMaterial color="#1c1030" emissive="#660044" emissiveIntensity={0.5} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// ─── MARS (red planet) ────────────────────────────────────────────────────────
function MapMars() {
  return (
    <group>
      <ambientLight intensity={0.10} color="#ff3300" />
      <directionalLight position={[8,10,4]} intensity={0.5} color="#ff6633" castShadow />
      <pointLight position={[0,4,0]}     color="#ff4400" intensity={4}  distance={28} decay={2} />
      <pointLight position={[-15,2,-15]} color="#cc2200" intensity={3}  distance={22} decay={2} />
      <pointLight position={[15,2,15]}   color="#ff5500" intensity={3}  distance={22} decay={2} />
      <pointLight position={[15,2,-15]}  color="#ff7733" intensity={2.5} distance={20} decay={2} />
      <pointLight position={[-15,2,15]}  color="#cc3300" intensity={2.5} distance={20} decay={2} />
      {/* Reddish dusty floor */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#4a1500" roughness={0.97} metalness={0.05} />
      </mesh>
      {/* Rocky terrain */}
      {([
        [0,3,-30],[0,3,30],[-30,3,0],[30,3,0]
      ] as [number,number,number][]).map((p,i)=>(
        <Wall key={i} pos={p} size={[60,6,0.7]} col="#3a1000" emit="#aa2200" emitInt={0.05} />
      ))}
      {/* Mars rocks / boulders as covers */}
      {([
        {p:[-10,1,-8]  as [number,number,number],s:[3.5,2,3]    as [number,number,number]},
        {p:[-12,1,-5]  as [number,number,number],s:[2.5,2.5,5]  as [number,number,number]},
        {p:[-8,1,-12]  as [number,number,number],s:[4.5,2,2.5]  as [number,number,number]},
        {p:[10,1,8]    as [number,number,number],s:[3.5,2,3]    as [number,number,number]},
        {p:[12,1,5]    as [number,number,number],s:[2.5,2.5,5]  as [number,number,number]},
        {p:[8,1,12]    as [number,number,number],s:[4.5,2,2.5]  as [number,number,number]},
        {p:[-18,2,-2]  as [number,number,number],s:[9,4,0.8]    as [number,number,number]},
        {p:[-18,2,6]   as [number,number,number],s:[9,4,0.8]    as [number,number,number]},
        {p:[-14,2,2]   as [number,number,number],s:[0.8,4,9]    as [number,number,number]},
        {p:[20,2,-3]   as [number,number,number],s:[0.8,4,9]    as [number,number,number]},
        {p:[14,2,-7]   as [number,number,number],s:[13,4,0.8]   as [number,number,number]},
        {p:[14,2,1]    as [number,number,number],s:[13,4,0.8]   as [number,number,number]},
        {p:[5,1,-15]   as [number,number,number],s:[3,2,3]      as [number,number,number]},
        {p:[-5,1,15]   as [number,number,number],s:[3,2,3]      as [number,number,number]},
        {p:[18,1.5,18] as [number,number,number],s:[4,3,4]      as [number,number,number]},
        {p:[-18,1.5,-18]as [number,number,number],s:[4,3,4]     as [number,number,number]},
        {p:[0,1,-18]   as [number,number,number],s:[5,2,3]      as [number,number,number]},
        {p:[0,1,18]    as [number,number,number],s:[5,2,3]      as [number,number,number]},
      ] as {p:[number,number,number];s:[number,number,number]}[]).map((o,i)=>(
        <Cover key={i} pos={o.p} size={o.s} col="#5a2200" />
      ))}
      {/* Mars gravity label pillars (decorative) */}
      {([ [-5,2,0],[5,2,0] ] as [number,number,number][]).map((p,i)=>(
        <Wall key={`mp${i}`} pos={p} size={[0.6,4,12]} col="#3a1000" emit="#ff4400" emitInt={0.08} />
      ))}
      {/* Spike */}
      <mesh position={[0,0.06,0]} receiveShadow>
        <cylinderGeometry args={[5,5,0.12,32]} />
        <meshStandardMaterial color="#cc3300" roughness={0.4} metalness={0.5} emissive="#ff2200" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0,0.05,0]}>
        <torusGeometry args={[5.2,0.18,8,64]} />
        <meshStandardMaterial color="#ff5500" emissive="#ff3300" emissiveIntensity={4} roughness={0} />
      </mesh>
      <pointLight position={[0,1.5,0]} color="#ff4400" intensity={5} distance={12} decay={2} />
      {/* Dust pillars */}
      {([ [-25,3,-25],[-25,3,25],[25,3,-25],[25,3,25] ] as [number,number,number][]).map((p,i)=>(
        <mesh key={`dp${i}`} position={p}>
          <cylinderGeometry args={[0.8,1.2,6,6]} />
          <meshStandardMaterial color="#5a2200" roughness={0.9} />
        </mesh>
      ))}
      {/* Low gravity indicator ring in sky */}
      <mesh position={[0,8,0]} rotation={[Math.PI/2,0,0]}>
        <torusGeometry args={[12,0.3,8,64]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={2} roughness={0} />
      </mesh>
    </group>
  );
}

// ─── VOLCANO (lava) ──────────────────────────────────────────────────────────
function MapVolcano() {
  return (
    <group>
      <ambientLight intensity={0.08} color="#ff2200" />
      <directionalLight position={[0,8,0]} intensity={0.3} color="#ff5500" castShadow />
      <pointLight position={[0,4,0]}     color="#ff4400" intensity={6}  distance={30} decay={2} />
      <pointLight position={[-15,1,-15]} color="#ff6600" intensity={4}  distance={20} decay={2} />
      <pointLight position={[15,1,15]}   color="#ff4400" intensity={4}  distance={20} decay={2} />
      <pointLight position={[0,1,20]}    color="#ff3300" intensity={3.5} distance={18} decay={2} />
      {/* Dark stone floor */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#1a0800" roughness={0.95} metalness={0.2} />
      </mesh>
      {/* LAVA DAMAGE ZONES — glowing orange puddles */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[-15,0.05,-15]}>
        <circleGeometry args={[6,32]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={4} roughness={0} metalness={0.3} />
      </mesh>
      <pointLight position={[-15,1,-15]} color="#ff4400" intensity={8} distance={14} decay={2} />
      <mesh rotation={[-Math.PI/2,0,0]} position={[15,0.05,15]}>
        <circleGeometry args={[6,32]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={4} roughness={0} metalness={0.3} />
      </mesh>
      <pointLight position={[15,1,15]} color="#ff4400" intensity={8} distance={14} decay={2} />
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.05,20]}>
        <circleGeometry args={[5,32]} />
        <meshStandardMaterial color="#ff5500" emissive="#ff3300" emissiveIntensity={4} roughness={0} />
      </mesh>
      <pointLight position={[0,1,20]} color="#ff5500" intensity={7} distance={12} decay={2} />
      {/* Walls */}
      {([
        {p:[0,3,-30]  as [number,number,number],s:[60,6,0.7] as [number,number,number]},
        {p:[0,3,30]   as [number,number,number],s:[60,6,0.7] as [number,number,number]},
        {p:[-30,3,0]  as [number,number,number],s:[0.7,6,60] as [number,number,number]},
        {p:[30,3,0]   as [number,number,number],s:[0.7,6,60] as [number,number,number]},
      ] as {p:[number,number,number];s:[number,number,number]}[]).map((w,i)=>(
        <Wall key={i} pos={w.p} size={w.s} col="#1a0400" emit="#ff3300" emitInt={0.1} />
      ))}
      {/* Black rock covers */}
      {([
        {p:[-10,1,-8]  as [number,number,number],s:[3,2,3]},
        {p:[-12,1,-5]  as [number,number,number],s:[2,2,5]},
        {p:[-8,1,-12]  as [number,number,number],s:[4,2,2]},
        {p:[10,1,8]    as [number,number,number],s:[3,2,3]},
        {p:[12,1,5]    as [number,number,number],s:[2,2,5]},
        {p:[8,1,12]    as [number,number,number],s:[4,2,2]},
        {p:[-18,2,-2]  as [number,number,number],s:[8,4,0.7]},
        {p:[-18,2,6]   as [number,number,number],s:[8,4,0.7]},
        {p:[-14,2,2]   as [number,number,number],s:[0.7,4,8]},
        {p:[20,2,-3]   as [number,number,number],s:[0.7,4,8]},
        {p:[14,2,-7]   as [number,number,number],s:[12,4,0.7]},
        {p:[14,2,1]    as [number,number,number],s:[12,4,0.7]},
        {p:[5,1,-15]   as [number,number,number],s:[2,2,2]},
        {p:[-5,1,15]   as [number,number,number],s:[2,2,2]},
        {p:[18,1,18]   as [number,number,number],s:[3,2,3]},
        {p:[-18,1,-18] as [number,number,number],s:[3,2,3]},
        {p:[0,1,-18]   as [number,number,number],s:[4,2,2]},
        {p:[0,1,18]    as [number,number,number],s:[4,2,2]},
      ] as {p:[number,number,number];s:[number,number,number]}[]).map((o,i)=>(
        <Cover key={i} pos={o.p as [number,number,number]} size={o.s as [number,number,number]} col="#2a0800" topGlow topGlowCol="#ff4400" />
      ))}
      {([ [-5,3,0],[5,3,0] ] as [number,number,number][]).map((p,i)=>(
        <Wall key={`vp${i}`} pos={p} size={[0.6,6,12]} col="#1a0400" emit="#ff3300" emitInt={0.15} />
      ))}
      <mesh position={[0,0.06,0]} receiveShadow>
        <cylinderGeometry args={[5,5,0.12,32]} />
        <meshStandardMaterial color="#ff2200" roughness={0.2} metalness={0.7} emissive="#ff0000" emissiveIntensity={3} />
      </mesh>
      <mesh position={[0,0.05,0]}>
        <torusGeometry args={[5.2,0.2,8,64]} />
        <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={5} roughness={0} />
      </mesh>
      <pointLight position={[0,1.5,0]} color="#ff2200" intensity={8} distance={14} decay={2} />
    </group>
  );
}

// ─── SPACE (orbital station) ──────────────────────────────────────────────────
function MapSpace() {
  const starPositions = useMemo(() => {
    const pos: [number,number,number][] = [];
    for (let i = 0; i < 120; i++) {
      pos.push([ (Math.random()-0.5)*55, 4.5+Math.random()*0.3, (Math.random()-0.5)*55 ]);
    }
    return pos;
  }, []);
  return (
    <group>
      <ambientLight intensity={0.02} color="#220044" />
      <directionalLight position={[5,10,5]} intensity={0.15} color="#4422ff" castShadow />
      <pointLight position={[0,4,0]}     color="#8844ff" intensity={5}  distance={30} decay={2} />
      <pointLight position={[-15,2,-15]} color="#4400ff" intensity={3}  distance={22} decay={2} />
      <pointLight position={[15,2,15]}   color="#ff44aa" intensity={3}  distance={22} decay={2} />
      <pointLight position={[15,2,-15]}  color="#00aaff" intensity={2.5} distance={20} decay={2} />
      <pointLight position={[-15,2,15]}  color="#aa00ff" intensity={2.5} distance={20} decay={2} />
      {/* Dark void floor */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#020008" roughness={0.1} metalness={0.95} emissive="#110022" emissiveIntensity={0.5} />
      </mesh>
      {/* Star dots on ceiling */}
      {starPositions.map((p,i)=>(
        <mesh key={`star${i}`} position={p}>
          <sphereGeometry args={[0.06,4,4]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3} />
        </mesh>
      ))}
      {/* SPACE PORTALS */}
      <mesh position={[-20,1.5,-20]} rotation={[0,Math.PI/4,0]}>
        <torusGeometry args={[2.5,0.25,16,64]} />
        <meshStandardMaterial color="#8844ff" emissive="#6622ff" emissiveIntensity={5} roughness={0} />
      </mesh>
      <pointLight position={[-20,2,-20]} color="#8844ff" intensity={6} distance={10} decay={2} />
      <mesh position={[20,1.5,20]} rotation={[0,Math.PI/4,0]}>
        <torusGeometry args={[2.5,0.25,16,64]} />
        <meshStandardMaterial color="#ff44aa" emissive="#ff2288" emissiveIntensity={5} roughness={0} />
      </mesh>
      <pointLight position={[20,2,20]} color="#ff44aa" intensity={6} distance={10} decay={2} />
      <mesh position={[20,1.5,-20]} rotation={[0,-Math.PI/4,0]}>
        <torusGeometry args={[2.5,0.25,16,64]} />
        <meshStandardMaterial color="#00aaff" emissive="#0088ff" emissiveIntensity={5} roughness={0} />
      </mesh>
      <pointLight position={[20,2,-20]} color="#00aaff" intensity={6} distance={10} decay={2} />
      <mesh position={[-20,1.5,20]} rotation={[0,-Math.PI/4,0]}>
        <torusGeometry args={[2.5,0.25,16,64]} />
        <meshStandardMaterial color="#44ffaa" emissive="#22ff88" emissiveIntensity={5} roughness={0} />
      </mesh>
      <pointLight position={[-20,2,20]} color="#44ffaa" intensity={6} distance={10} decay={2} />
      {/* Walls */}
      {([
        {p:[0,3,-30]  as [number,number,number],s:[60,6,0.5]},
        {p:[0,3,30]   as [number,number,number],s:[60,6,0.5]},
        {p:[-30,3,0]  as [number,number,number],s:[0.5,6,60]},
        {p:[30,3,0]   as [number,number,number],s:[0.5,6,60]},
      ] as {p:[number,number,number];s:number[]}[]).map((w,i)=>(
        <Wall key={i} pos={w.p} size={w.s as [number,number,number]} col="#050010" emit="#8844ff" emitInt={0.1} />
      ))}
      {/* Metal covers */}
      {([
        {p:[-10,0.75,-8]  as [number,number,number],s:[2.5,1.5,2.5]as [number,number,number],g:"#8844ff"},
        {p:[-12,0.75,-5]  as [number,number,number],s:[2,1.5,4]     as [number,number,number],g:"#4400ff"},
        {p:[-8,0.75,-12]  as [number,number,number],s:[3,1.5,2]     as [number,number,number],g:"#aa00ff"},
        {p:[10,0.75,8]    as [number,number,number],s:[2.5,1.5,2.5] as [number,number,number],g:"#ff44aa"},
        {p:[12,0.75,5]    as [number,number,number],s:[2,1.5,4]     as [number,number,number],g:"#00aaff"},
        {p:[8,0.75,12]    as [number,number,number],s:[3,1.5,2]     as [number,number,number],g:"#44ffaa"},
        {p:[-18,1.5,-2]   as [number,number,number],s:[8,3,0.5]     as [number,number,number],g:"#8844ff"},
        {p:[-18,1.5,6]    as [number,number,number],s:[8,3,0.5]     as [number,number,number],g:"#4400ff"},
        {p:[-14,1.5,2]    as [number,number,number],s:[0.5,3,8]     as [number,number,number],g:"#aa00ff"},
        {p:[20,1.5,-3]    as [number,number,number],s:[0.5,3,8]     as [number,number,number],g:"#ff44aa"},
        {p:[14,1.5,-7]    as [number,number,number],s:[12,3,0.5]    as [number,number,number],g:"#00aaff"},
        {p:[14,1.5,1]     as [number,number,number],s:[12,3,0.5]    as [number,number,number],g:"#44ffaa"},
        {p:[5,0.75,-15]   as [number,number,number],s:[2,1.5,2]     as [number,number,number],g:"#8844ff"},
        {p:[-5,0.75,15]   as [number,number,number],s:[2,1.5,2]     as [number,number,number],g:"#ff44aa"},
        {p:[18,0.75,18]   as [number,number,number],s:[3,1.5,3]     as [number,number,number],g:"#00aaff"},
        {p:[-18,0.75,-18] as [number,number,number],s:[3,1.5,3]     as [number,number,number],g:"#aa00ff"},
        {p:[0,0.75,-18]   as [number,number,number],s:[4,1.5,2]     as [number,number,number],g:"#8844ff"},
        {p:[0,0.75,18]    as [number,number,number],s:[4,1.5,2]     as [number,number,number],g:"#ff44aa"},
      ] as {p:[number,number,number];s:[number,number,number];g:string}[]).map((o,i)=>(
        <Cover key={i} pos={o.p} size={o.s} col="#050018" topGlow topGlowCol={o.g} />
      ))}
      <Wall pos={[-5,3,0]}  size={[0.5,6,12]} col="#050010" emit="#8844ff" emitInt={0.12} />
      <Wall pos={[5,3,0]}   size={[0.5,6,12]} col="#050010" emit="#ff44aa" emitInt={0.12} />
      <mesh position={[0,0.06,0]} receiveShadow>
        <cylinderGeometry args={[5,5,0.12,32]} />
        <meshStandardMaterial color="#220044" roughness={0.1} metalness={0.9} emissive="#8844ff" emissiveIntensity={2.5} />
      </mesh>
      <mesh position={[0,0.05,0]}>
        <torusGeometry args={[5.2,0.18,8,64]} />
        <meshStandardMaterial color="#aa66ff" emissive="#8844ff" emissiveIntensity={4} roughness={0} />
      </mesh>
      <pointLight position={[0,1.5,0]} color="#8844ff" intensity={6} distance={14} decay={2} />
    </group>
  );
}

// ─── EGYPT (ancient desert) ────────────────────────────────────────────────────
function MapEgypt() {
  return (
    <group>
      <ambientLight intensity={0.22} color="#ffcc66" />
      <directionalLight position={[10,15,5]} intensity={1.2} color="#ffdd88" castShadow />
      <pointLight position={[0,4,0]}     color="#ffaa33" intensity={4}  distance={28} decay={2} />
      <pointLight position={[-15,2,-15]} color="#ff9922" intensity={3}  distance={22} decay={2} />
      <pointLight position={[15,2,15]}   color="#ffbb44" intensity={3}  distance={22} decay={2} />
      <pointLight position={[15,2,-15]}  color="#ffcc55" intensity={2.5} distance={20} decay={2} />
      <pointLight position={[-15,2,15]}  color="#ff9933" intensity={2.5} distance={20} decay={2} />
      {/* Sandy floor */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#c9943a" roughness={0.98} metalness={0} />
      </mesh>
      {/* Sand grid lines */}
      {[-20,-10,0,10,20].map(v=><GridLine key={`ex${v}`} from={[v,0.005,-29]} to={[v,0.005,29]} col="#ffcc66" />)}
      {[-20,-10,0,10,20].map(v=><GridLine key={`ez${v}`} from={[-29,0.005,v]} to={[29,0.005,v]} col="#ddaa44" />)}
      {/* Sandstone walls */}
      {([
        {p:[0,3,-30]  as [number,number,number],s:[60,6,0.7]},
        {p:[0,3,30]   as [number,number,number],s:[60,6,0.7]},
        {p:[-30,3,0]  as [number,number,number],s:[0.7,6,60]},
        {p:[30,3,0]   as [number,number,number],s:[0.7,6,60]},
      ] as {p:[number,number,number];s:number[]}[]).map((w,i)=>(
        <Wall key={i} pos={w.p} size={w.s as [number,number,number]} col="#8b6535" emit="#ffaa44" emitInt={0.06} />
      ))}
      {/* Pyramid columns at corners */}
      {([[-24,3,-24],[-24,3,24],[24,3,-24],[24,3,24]] as [number,number,number][]).map((p,i)=>(
        <mesh key={`pyr${i}`} position={p}>
          <coneGeometry args={[3,6,4]} />
          <meshStandardMaterial color="#c9943a" roughness={0.9} metalness={0.1} emissive="#ffaa33" emissiveIntensity={0.3} />
        </mesh>
      ))}
      {/* Hieroglyph pillars */}
      {([[-5,3,0],[5,3,0]] as [number,number,number][]).map((p,i)=>(
        <mesh key={`hiero${i}`} position={p}>
          <boxGeometry args={[0.8,6,12]} />
          <meshStandardMaterial color="#8b6535" roughness={0.85} emissive="#ffaa33" emissiveIntensity={0.08} />
        </mesh>
      ))}
      {/* Sandy block covers */}
      {([
        {p:[-10,1,-8]  as [number,number,number],s:[3,2,3]   as [number,number,number]},
        {p:[-12,1,-5]  as [number,number,number],s:[2,2,5]   as [number,number,number]},
        {p:[-8,1,-12]  as [number,number,number],s:[4,2,2]   as [number,number,number]},
        {p:[10,1,8]    as [number,number,number],s:[3,2,3]   as [number,number,number]},
        {p:[12,1,5]    as [number,number,number],s:[2,2,5]   as [number,number,number]},
        {p:[8,1,12]    as [number,number,number],s:[4,2,2]   as [number,number,number]},
        {p:[-18,2,-2]  as [number,number,number],s:[8,4,0.8] as [number,number,number]},
        {p:[-18,2,6]   as [number,number,number],s:[8,4,0.8] as [number,number,number]},
        {p:[-14,2,2]   as [number,number,number],s:[0.8,4,8] as [number,number,number]},
        {p:[20,2,-3]   as [number,number,number],s:[0.8,4,8] as [number,number,number]},
        {p:[14,2,-7]   as [number,number,number],s:[12,4,0.8]as [number,number,number]},
        {p:[14,2,1]    as [number,number,number],s:[12,4,0.8]as [number,number,number]},
        {p:[5,1,-15]   as [number,number,number],s:[2,2,2]   as [number,number,number]},
        {p:[-5,1,15]   as [number,number,number],s:[2,2,2]   as [number,number,number]},
        {p:[18,1,18]   as [number,number,number],s:[3,2,3]   as [number,number,number]},
        {p:[-18,1,-18] as [number,number,number],s:[3,2,3]   as [number,number,number]},
        {p:[0,1,-18]   as [number,number,number],s:[4,2,2]   as [number,number,number]},
        {p:[0,1,18]    as [number,number,number],s:[4,2,2]   as [number,number,number]},
      ] as {p:[number,number,number];s:[number,number,number]}[]).map((o,i)=>(
        <Cover key={i} pos={o.p} size={o.s} col="#a07840" />
      ))}
      {/* Spike — scarab ring */}
      <mesh position={[0,0.06,0]} receiveShadow>
        <cylinderGeometry args={[5,5,0.12,32]} />
        <meshStandardMaterial color="#c9943a" roughness={0.4} metalness={0.6} emissive="#ffaa33" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0,0.05,0]}>
        <torusGeometry args={[5.2,0.18,8,64]} />
        <meshStandardMaterial color="#ffdd88" emissive="#ffcc44" emissiveIntensity={4} roughness={0} />
      </mesh>
      <pointLight position={[0,1.5,0]} color="#ffaa33" intensity={5} distance={12} decay={2} />
    </group>
  );
}

// ─── CYBERPUNK (neon city) ─────────────────────────────────────────────────────
function MapCyberpunk() {
  return (
    <group>
      <ambientLight intensity={0.03} color="#110022" />
      <directionalLight position={[5,10,5]} intensity={0.04} color="#ff00ff" castShadow />
      <pointLight position={[0,4,0]}     color="#ff00ff" intensity={5}  distance={30} decay={2} />
      <pointLight position={[-15,3,-15]} color="#ff00aa" intensity={4}  distance={22} decay={2} />
      <pointLight position={[15,3,15]}   color="#aa00ff" intensity={4}  distance={22} decay={2} />
      <pointLight position={[15,3,-15]}  color="#ff0088" intensity={3}  distance={20} decay={2} />
      <pointLight position={[-15,3,15]}  color="#8800ff" intensity={3}  distance={20} decay={2} />
      <pointLight position={[-27,1,-27]} color="#ff00ff" intensity={2.5} distance={15} decay={2} />
      <pointLight position={[27,1,27]}   color="#ff00ff" intensity={2.5} distance={15} decay={2} />
      {/* Rain-slick dark floor */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#050008" roughness={0.05} metalness={0.95} emissive="#110022" emissiveIntensity={0.5} />
      </mesh>
      {/* Neon city grid */}
      {[-20,-10,0,10,20].map(v=><GridLine key={`cx${v}`} from={[v,0.005,-29]} to={[v,0.005,29]} col={v===0?"#ff00ff":"#330022"} />)}
      {[-20,-10,0,10,20].map(v=><GridLine key={`cz${v}`} from={[-29,0.005,v]} to={[29,0.005,v]} col={v===0?"#aa00ff":"#220033"} />)}
      {/* Dark high-rise walls */}
      {([
        {p:[0,3,-30]  as [number,number,number],s:[60,6,0.5]},
        {p:[0,3,30]   as [number,number,number],s:[60,6,0.5]},
        {p:[-30,3,0]  as [number,number,number],s:[0.5,6,60]},
        {p:[30,3,0]   as [number,number,number],s:[0.5,6,60]},
      ] as {p:[number,number,number];s:number[]}[]).map((w,i)=>(
        <Wall key={i} pos={w.p} size={w.s as [number,number,number]} col="#080010" emit="#ff00ff" emitInt={0.1} />
      ))}
      {/* Holographic neon bars */}
      <NeonBar pos={[0,4.92,0]}   len={55} axis="x" col="#ff00ff" />
      <NeonBar pos={[0,4.92,0]}   len={55} axis="z" col="#aa00ff" />
      <NeonBar pos={[0,0.04,-29.7]} len={58} axis="x" col="#ff00ff" />
      <NeonBar pos={[0,0.04,29.7]}  len={58} axis="x" col="#aa00ff" />
      <NeonBar pos={[-29.7,0.04,0]} len={58} axis="z" col="#ff0088" />
      <NeonBar pos={[29.7,0.04,0]}  len={58} axis="z" col="#8800ff" />
      {/* City block covers with pink/magenta glow */}
      {([
        {p:[-10,0.75,-8]  as [number,number,number],s:[2.5,1.5,2.5]as [number,number,number],g:"#ff00ff"},
        {p:[-12,0.75,-5]  as [number,number,number],s:[2,1.5,4]    as [number,number,number],g:"#ff00aa"},
        {p:[-8,0.75,-12]  as [number,number,number],s:[3,1.5,2]    as [number,number,number],g:"#aa00ff"},
        {p:[10,0.75,8]    as [number,number,number],s:[2.5,1.5,2.5]as [number,number,number],g:"#ff0088"},
        {p:[12,0.75,5]    as [number,number,number],s:[2,1.5,4]    as [number,number,number],g:"#8800ff"},
        {p:[8,0.75,12]    as [number,number,number],s:[3,1.5,2]    as [number,number,number],g:"#ff00ff"},
        {p:[-18,1.5,-2]   as [number,number,number],s:[8,3,0.5]    as [number,number,number],g:"#ff00ff"},
        {p:[-18,1.5,6]    as [number,number,number],s:[8,3,0.5]    as [number,number,number],g:"#aa00ff"},
        {p:[-14,1.5,2]    as [number,number,number],s:[0.5,3,8]    as [number,number,number],g:"#ff0088"},
        {p:[20,1.5,-3]    as [number,number,number],s:[0.5,3,8]    as [number,number,number],g:"#8800ff"},
        {p:[14,1.5,-7]    as [number,number,number],s:[12,3,0.5]   as [number,number,number],g:"#ff00ff"},
        {p:[14,1.5,1]     as [number,number,number],s:[12,3,0.5]   as [number,number,number],g:"#aa00ff"},
        {p:[5,0.75,-15]   as [number,number,number],s:[2,1.5,2]    as [number,number,number],g:"#ff00aa"},
        {p:[-5,0.75,15]   as [number,number,number],s:[2,1.5,2]    as [number,number,number],g:"#8800ff"},
        {p:[18,0.75,18]   as [number,number,number],s:[3,1.5,3]    as [number,number,number],g:"#ff0088"},
        {p:[-18,0.75,-18] as [number,number,number],s:[3,1.5,3]    as [number,number,number],g:"#aa00ff"},
        {p:[0,0.75,-18]   as [number,number,number],s:[4,1.5,2]    as [number,number,number],g:"#ff00ff"},
        {p:[0,0.75,18]    as [number,number,number],s:[4,1.5,2]    as [number,number,number],g:"#8800ff"},
      ] as {p:[number,number,number];s:[number,number,number];g:string}[]).map((o,i)=>(
        <Cover key={i} pos={o.p} size={o.s} col="#0a000f" topGlow topGlowCol={o.g} />
      ))}
      <Wall pos={[-5,3,0]}  size={[0.5,6,12]} col="#0a000f" emit="#ff00ff" emitInt={0.15} />
      <Wall pos={[5,3,0]}   size={[0.5,6,12]} col="#0a000f" emit="#aa00ff" emitInt={0.15} />
      {/* Spike */}
      <mesh position={[0,0.06,0]} receiveShadow>
        <cylinderGeometry args={[5,5,0.12,32]} />
        <meshStandardMaterial color="#220033" roughness={0.1} metalness={0.9} emissive="#ff00ff" emissiveIntensity={2.5} />
      </mesh>
      <mesh position={[0,0.05,0]}>
        <torusGeometry args={[5.2,0.18,8,64]} />
        <meshStandardMaterial color="#ff66ff" emissive="#ff00ff" emissiveIntensity={5} roughness={0} />
      </mesh>
      <pointLight position={[0,1.5,0]} color="#ff00ff" intensity={7} distance={14} decay={2} />
    </group>
  );
}

// ─── UNDERWATER (ocean base) ──────────────────────────────────────────────────
function MapUnderwater() {
  const bubblePositions = useMemo(() => {
    const pos: [number,number,number][] = [];
    for (let i = 0; i < 60; i++) {
      pos.push([ (Math.random()-0.5)*50, 0.2+Math.random()*4, (Math.random()-0.5)*50 ]);
    }
    return pos;
  }, []);
  return (
    <group>
      <ambientLight intensity={0.06} color="#003366" />
      <directionalLight position={[0,10,0]} intensity={0.15} color="#00aacc" castShadow />
      <pointLight position={[0,4,0]}     color="#00ccff" intensity={5}  distance={28} decay={2} />
      <pointLight position={[-15,2,-15]} color="#0088cc" intensity={3}  distance={22} decay={2} />
      <pointLight position={[15,2,15]}   color="#00ccaa" intensity={3}  distance={22} decay={2} />
      <pointLight position={[15,2,-15]}  color="#0044ff" intensity={2.5} distance={20} decay={2} />
      <pointLight position={[-15,2,15]}  color="#00aacc" intensity={2.5} distance={20} decay={2} />
      {/* Sea floor */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[60,60]} />
        <meshStandardMaterial color="#001a2e" roughness={0.8} metalness={0.3} emissive="#002244" emissiveIntensity={0.4} />
      </mesh>
      {/* Water grid */}
      {[-20,-10,0,10,20].map(v=><GridLine key={`ux${v}`} from={[v,0.005,-29]} to={[v,0.005,29]} col="#00aaff" />)}
      {[-20,-10,0,10,20].map(v=><GridLine key={`uz${v}`} from={[-29,0.005,v]} to={[29,0.005,v]} col="#0088cc" />)}
      {/* Bubble particles */}
      {bubblePositions.map((p,i)=>(
        <mesh key={`bub${i}`} position={p}>
          <sphereGeometry args={[0.04+Math.random()*0.06,4,4]} />
          <meshStandardMaterial color="#aaeeff" emissive="#00aaff" emissiveIntensity={2} transparent opacity={0.7} />
        </mesh>
      ))}
      {/* Walls — pressure glass */}
      {([
        {p:[0,3,-30]  as [number,number,number],s:[60,6,0.5]},
        {p:[0,3,30]   as [number,number,number],s:[60,6,0.5]},
        {p:[-30,3,0]  as [number,number,number],s:[0.5,6,60]},
        {p:[30,3,0]   as [number,number,number],s:[0.5,6,60]},
      ] as {p:[number,number,number];s:number[]}[]).map((w,i)=>(
        <Wall key={i} pos={w.p} size={w.s as [number,number,number]} col="#001a33" emit="#00aaff" emitInt={0.12} />
      ))}
      <NeonBar pos={[0,4.92,0]}   len={55} axis="x" col="#00ccff" />
      <NeonBar pos={[0,4.92,0]}   len={55} axis="z" col="#0088cc" />
      <NeonBar pos={[0,0.04,-29.7]} len={58} axis="x" col="#00aaff" />
      <NeonBar pos={[0,0.04,29.7]}  len={58} axis="x" col="#00ccaa" />
      <NeonBar pos={[-29.7,0.04,0]} len={58} axis="z" col="#0044ff" />
      <NeonBar pos={[29.7,0.04,0]}  len={58} axis="z" col="#00aacc" />
      {/* Coral/reef covers */}
      {([
        {p:[-10,0.75,-8]  as [number,number,number],s:[2.5,1.5,2.5]as [number,number,number],g:"#00ccff"},
        {p:[-12,0.75,-5]  as [number,number,number],s:[2,1.5,4]    as [number,number,number],g:"#0088cc"},
        {p:[-8,0.75,-12]  as [number,number,number],s:[3,1.5,2]    as [number,number,number],g:"#00aacc"},
        {p:[10,0.75,8]    as [number,number,number],s:[2.5,1.5,2.5]as [number,number,number],g:"#00ccaa"},
        {p:[12,0.75,5]    as [number,number,number],s:[2,1.5,4]    as [number,number,number],g:"#0044ff"},
        {p:[8,0.75,12]    as [number,number,number],s:[3,1.5,2]    as [number,number,number],g:"#00ccff"},
        {p:[-18,1.5,-2]   as [number,number,number],s:[8,3,0.5]    as [number,number,number],g:"#00aaff"},
        {p:[-18,1.5,6]    as [number,number,number],s:[8,3,0.5]    as [number,number,number],g:"#0088cc"},
        {p:[-14,1.5,2]    as [number,number,number],s:[0.5,3,8]    as [number,number,number],g:"#00ccff"},
        {p:[20,1.5,-3]    as [number,number,number],s:[0.5,3,8]    as [number,number,number],g:"#00aacc"},
        {p:[14,1.5,-7]    as [number,number,number],s:[12,3,0.5]   as [number,number,number],g:"#0044ff"},
        {p:[14,1.5,1]     as [number,number,number],s:[12,3,0.5]   as [number,number,number],g:"#00ccaa"},
        {p:[5,0.75,-15]   as [number,number,number],s:[2,1.5,2]    as [number,number,number],g:"#00aaff"},
        {p:[-5,0.75,15]   as [number,number,number],s:[2,1.5,2]    as [number,number,number],g:"#0088cc"},
        {p:[18,0.75,18]   as [number,number,number],s:[3,1.5,3]    as [number,number,number],g:"#00ccff"},
        {p:[-18,0.75,-18] as [number,number,number],s:[3,1.5,3]    as [number,number,number],g:"#0044ff"},
        {p:[0,0.75,-18]   as [number,number,number],s:[4,1.5,2]    as [number,number,number],g:"#00aacc"},
        {p:[0,0.75,18]    as [number,number,number],s:[4,1.5,2]    as [number,number,number],g:"#00ccaa"},
      ] as {p:[number,number,number];s:[number,number,number];g:string}[]).map((o,i)=>(
        <Cover key={i} pos={o.p} size={o.s} col="#001a33" topGlow topGlowCol={o.g} />
      ))}
      <Wall pos={[-5,3,0]}  size={[0.5,6,12]} col="#001a33" emit="#00ccff" emitInt={0.15} />
      <Wall pos={[5,3,0]}   size={[0.5,6,12]} col="#001a33" emit="#0088cc" emitInt={0.15} />
      {/* Spike — jellyfish ring */}
      <mesh position={[0,0.06,0]} receiveShadow>
        <cylinderGeometry args={[5,5,0.12,32]} />
        <meshStandardMaterial color="#004466" roughness={0.2} metalness={0.8} emissive="#00aaff" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0,0.05,0]}>
        <torusGeometry args={[5.2,0.18,8,64]} />
        <meshStandardMaterial color="#aaeeff" emissive="#00ccff" emissiveIntensity={4} roughness={0} />
      </mesh>
      <pointLight position={[0,1.5,0]} color="#00ccff" intensity={6} distance={14} decay={2} />
    </group>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
interface MapProps {
  mapId?: MapId;
  nightMode?: boolean;
}

export default function Map({ mapId = "astral" }: MapProps) {
  const bg = useMemo(() => MAP_CONFIGS[mapId]?.bgColor ?? "#020208", [mapId]);
  (window as any).__mapBg = bg;

  switch(mapId) {
    case "canyon":    return <MapCanyon />;
    case "frost":     return <MapFrost />;
    case "ruins":     return <MapRuins />;
    case "mars":      return <MapMars />;
    case "volcano":   return <MapVolcano />;
    case "space":     return <MapSpace />;
    case "egypt":     return <MapEgypt />;
    case "cyberpunk": return <MapCyberpunk />;
    case "underwater":return <MapUnderwater />;
    default:          return <MapAstral />;
  }
}
