import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";

export type RealtimeEvent = {
  topic: string;
  type: string;
  payload: unknown;
};

export class RealtimeHub {
  #server?: WebSocketServer;
  #subscriptions = new Map<WebSocket, Set<string>>();
  #authorize: (token: string | null, apiKey: string | null) => boolean;

  constructor(options: { authorize?: (token: string | null, apiKey: string | null) => boolean } = {}) {
    this.#authorize = options.authorize ?? (() => true);
  }

  attach(server: Server): void {
    this.#server = new WebSocketServer({ server, path: "/realtime" });

    this.#server.on("connection", (socket, request) => {
      const url = new URL(request.url ?? "/realtime", "http://localhost");
      const token = url.searchParams.get("token");
      const apiKey = url.searchParams.get("apiKey");
      if (!this.#authorize(token, apiKey)) {
        socket.close(1008, "Realtime authorization required");
        return;
      }

      this.#subscriptions.set(socket, new Set());

      socket.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as { action?: string; topic?: string };
        if (message.action === "watch" && message.topic) {
          this.#subscriptions.get(socket)?.add(message.topic);
        }
      });

      socket.on("close", () => {
        this.#subscriptions.delete(socket);
      });
    });
  }

  publish(event: RealtimeEvent): void {
    const encoded = JSON.stringify(event);

    for (const [socket, topics] of this.#subscriptions.entries()) {
      if (socket.readyState === WebSocket.OPEN && topics.has(event.topic)) {
        socket.send(encoded);
      }
    }
  }
}
