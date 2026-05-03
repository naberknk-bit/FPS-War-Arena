import { io, Socket } from "socket.io-client";

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    _socket = io({
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return _socket;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
