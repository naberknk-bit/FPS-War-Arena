import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

interface VoiceChatProps {
  socket: Socket;
  roomId: string | null;
  username: string;
}

export default function VoiceChat({ socket, roomId, username }: VoiceChatProps) {
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const peerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<Map<string, any>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (!roomId) return;

    let peer: any;

    const initPeer = async () => {
      try {
        const { Peer } = await import("peerjs");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamRef.current = stream;

        peer = new Peer(undefined as any, {
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
            ],
          },
        });
        peerRef.current = peer;

        peer.on("open", (id: string) => {
          setConnected(true);
          socket.emit("peer_id", { peerId: id, roomId });
        });

        peer.on("call", (call: any) => {
          call.answer(stream);
          call.on("stream", (remoteStream: MediaStream) => {
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.autoplay = true;
            audioRefs.current.set(call.peer, audio);
            setPeerCount((p) => p + 1);
          });
          call.on("close", () => {
            audioRefs.current.get(call.peer)?.remove();
            audioRefs.current.delete(call.peer);
            setPeerCount((p) => Math.max(0, p - 1));
          });
          callsRef.current.set(call.peer, call);
        });

        peer.on("error", (err: Error) => {
          setError("Bağlantı hatası: " + err.message);
        });

      } catch (err: any) {
        if (err?.name === "NotAllowedError") {
          setError("Mikrofon izni reddedildi.");
        } else {
          setError("Sesli chat başlatılamadı.");
        }
      }
    };

    initPeer();

    const handlePeerJoined = ({ peerId }: { peerId: string }) => {
      if (!peerRef.current || !streamRef.current) return;
      const call = peerRef.current.call(peerId, streamRef.current);
      if (!call) return;
      call.on("stream", (remoteStream: MediaStream) => {
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        audioRefs.current.set(peerId, audio);
        setPeerCount((p) => p + 1);
      });
      call.on("close", () => {
        audioRefs.current.get(peerId)?.remove();
        audioRefs.current.delete(peerId);
        setPeerCount((p) => Math.max(0, p - 1));
      });
      callsRef.current.set(peerId, call);
    };

    socket.on("peer_joined", handlePeerJoined);

    return () => {
      socket.off("peer_joined", handlePeerJoined);
      callsRef.current.forEach((call) => call.close());
      callsRef.current.clear();
      audioRefs.current.forEach((a) => { a.srcObject = null; });
      audioRefs.current.clear();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      peer?.destroy();
      peerRef.current = null;
      setConnected(false);
      setPeerCount(0);
    };
  }, [roomId, socket]);

  const toggleMute = () => {
    if (!streamRef.current) return;
    const newMuted = !muted;
    streamRef.current.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
    setMuted(newMuted);
  };

  if (!roomId) return null;

  return (
    <div className="voice-chat-panel">
      <div className="voice-status">
        {error ? (
          <span className="voice-error">{error}</span>
        ) : connected ? (
          <>
            <span className="voice-dot" style={{ background: muted ? "#888" : "#4caf50" }} />
            <span className="voice-label">
              {muted ? "Susturuldu" : `Sesli — ${peerCount} bağlı`}
            </span>
          </>
        ) : (
          <span className="voice-label">Bağlanıyor...</span>
        )}
      </div>
      {connected && !error && (
        <button className="mute-btn" onClick={toggleMute} title="Mikrofon aç/kapat">
          {muted ? "🔇" : "🎙️"}
        </button>
      )}
    </div>
  );
}
