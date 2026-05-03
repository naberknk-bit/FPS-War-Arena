import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { MAP_LIST, MapId } from "./Map";

interface RoomInfo {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  vsMode: boolean;
  map: MapId;
}

interface RoomSystemProps {
  socket: Socket;
  username: string;
  isFounder: boolean;
  onRoomJoined: (roomId: string, isHost: boolean, vsMode: boolean, map: MapId) => void;
  onRoomLeft: () => void;
  currentRoom: string | null;
  isHost: boolean;
  vsMode: boolean;
  currentMap: MapId;
}

export default function RoomSystem({
  socket,
  username,
  isFounder,
  onRoomJoined,
  onRoomLeft,
  currentRoom,
  isHost,
  vsMode,
  currentMap,
}: RoomSystemProps) {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [roomName, setRoomName] = useState(`${username}'s Room`);
  const [tab, setTab] = useState<"lobby" | "create" | "join">("lobby");
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [localVsMode, setLocalVsMode] = useState(false);
  const [myTeam, setMyTeam] = useState<"red" | "blue" | null>(null);
  const [teamMap, setTeamMap] = useState<Record<string, string>>({});
  const [localMap, setLocalMap] = useState<MapId>(currentMap);

  useEffect(() => { setLocalMap(currentMap); }, [currentMap]);

  useEffect(() => {
    socket.on("rooms_updated", setRooms);
    socket.on("room_joined", ({ room, isHost: host }: any) => {
      onRoomJoined(room.id, host, room.vsMode, room.map ?? "astral");
      setMembers([]);
      setLocalVsMode(room.vsMode);
      setLocalMap(room.map ?? "astral");
      setError(null);
    });
    socket.on("room_update", ({ room, members: m }: any) => {
      setMembers(m);
      setLocalVsMode(room.vsMode);
    });
    socket.on("map_changed", ({ map }: { map: MapId }) => {
      setLocalMap(map);
    });
    socket.on("error_msg", (msg: string) => setError(msg));
    socket.on("team_update", ({ username: u, team }: any) => {
      setTeamMap((prev) => ({ ...prev, [u]: team }));
    });

    return () => {
      socket.off("rooms_updated");
      socket.off("room_joined");
      socket.off("room_update");
      socket.off("map_changed");
      socket.off("error_msg");
      socket.off("team_update");
    };
  }, [socket, onRoomJoined]);

  const createRoom = () => {
    socket.emit("create_room", { name: roomName, vsMode: false });
  };

  const joinRoom = () => {
    if (!joinCode.trim()) return;
    socket.emit("join_room", { roomId: joinCode.trim().toUpperCase() });
  };

  const leaveRoom = () => {
    socket.emit("leave_room");
    setMembers([]);
    setMyTeam(null);
    setTeamMap({});
    onRoomLeft();
  };

  const toggleVsMode = (val: boolean) => {
    setLocalVsMode(val);
    socket.emit("toggle_vs_mode", { vsMode: val });
  };

  const selectTeam = (team: "red" | "blue") => {
    setMyTeam(team);
    socket.emit("select_team", { team });
  };

  const handleMapSelect = (id: MapId) => {
    if (!isHost) return;
    setLocalMap(id);
    socket.emit("set_map", { map: id });
  };

  if (currentRoom) {
    const mapInfo = MAP_LIST.find((m) => m.id === localMap) ?? MAP_LIST[0];
    return (
      <div className="room-panel">
        <div className="room-panel-header">
          <span className="room-code-label">ODA: <strong>{currentRoom}</strong></span>
          {isHost && <span className="host-badge">HOST</span>}
        </div>
        <div className="room-members">
          {members.map((m, i) => (
            <div key={i} className="member-row">
              <span className="member-dot" style={{ background: teamMap[m] === "red" ? "#ff4444" : teamMap[m] === "blue" ? "#4488ff" : "#888" }} />
              <span className="member-name">{m}</span>
              {teamMap[m] && <span className="member-team">{teamMap[m] === "red" ? "🔴" : "🔵"}</span>}
            </div>
          ))}
        </div>

        {/* Map selector — host only */}
        <div className="room-map-section">
          <div className="room-map-label">
            🗺️ Harita:&nbsp;
            <span style={{ color: mapInfo.accentColor, fontWeight: 700 }}>
              {mapInfo.icon} {mapInfo.name}
            </span>
            {!isHost && <span className="room-map-locked"> (sadece host seçer)</span>}
          </div>
          <div className="room-map-grid">
            {MAP_LIST.map((m) => (
              <button
                key={m.id}
                className={`room-map-card${localMap === m.id ? " active" : ""}${!isHost ? " disabled" : ""}`}
                style={{ borderColor: localMap === m.id ? m.accentColor : undefined }}
                onClick={() => handleMapSelect(m.id)}
                disabled={!isHost}
              >
                <span className="rmc-icon">{m.icon}</span>
                <span className="rmc-name" style={{ color: localMap === m.id ? m.accentColor : undefined }}>{m.name}</span>
                <span className="rmc-desc">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {isHost && (
          <label className="vs-toggle">
            <input
              type="checkbox"
              checked={localVsMode}
              onChange={(e) => toggleVsMode(e.target.checked)}
            />
            <span>VS Modu</span>
          </label>
        )}
        {localVsMode && (
          <div className="team-select">
            <button className={`team-btn red ${myTeam === "red" ? "active" : ""}`} onClick={() => selectTeam("red")}>Team Red</button>
            <button className={`team-btn blue ${myTeam === "blue" ? "active" : ""}`} onClick={() => selectTeam("blue")}>Team Blue</button>
          </div>
        )}
        <button className="leave-btn" onClick={leaveRoom}>Odadan Çık</button>
      </div>
    );
  }

  return (
    <div className="room-panel">
      <div className="room-tabs">
        <button className={tab === "lobby" ? "tab active" : "tab"} onClick={() => setTab("lobby")}>Lobiler</button>
        <button className={tab === "create" ? "tab active" : "tab"} onClick={() => setTab("create")}>Oluştur</button>
        <button className={tab === "join" ? "tab active" : "tab"} onClick={() => setTab("join")}>Katıl</button>
      </div>

      {error && <div className="room-error">{error}</div>}

      {tab === "lobby" && (
        <div className="room-list">
          {rooms.length === 0 ? (
            <div className="room-empty">Açık oda yok. Bir tane oluştur!</div>
          ) : (
            rooms.map((r) => {
              const mi = MAP_LIST.find((m) => m.id === r.map) ?? MAP_LIST[0];
              return (
                <div key={r.id} className="room-item" onClick={() => socket.emit("join_room", { roomId: r.id })}>
                  <span className="room-item-name">{r.name}</span>
                  <span className="room-item-info">
                    {r.playerCount}/{r.maxPlayers}
                    {r.vsMode && " · VS"}
                    {" · "}{mi.icon} {mi.name}
                  </span>
                  <span className="room-item-code">{r.id}</span>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "create" && (
        <div className="room-form">
          <input
            className="room-input"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Oda adı"
            maxLength={30}
          />
          <button className="room-btn" onClick={createRoom}>Oda Oluştur</button>
        </div>
      )}

      {tab === "join" && (
        <div className="room-form">
          <input
            className="room-input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ODA KODU (6 harf)"
            maxLength={6}
          />
          <button className="room-btn" onClick={joinRoom}>Katıl</button>
        </div>
      )}
    </div>
  );
}
