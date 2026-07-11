import "reflect-metadata";

export const WS_METADATA_KEY = "apicraft:ws";

/**
 * Class decorator that marks a class as a WebSocket endpoint handler.
 * The class should implement the {@link WebSocketHandler} interface.
 *
 * @param path - The URL path for the WebSocket endpoint (e.g. "/chat", "/ws/:roomId")
 *
 * @example
 * ```typescript
 * @ws("/chat")
 * class ChatHandler implements WebSocketHandler {
 *   async onConnect(ctx: WebSocketContext) {
 *     console.log(`Client ${ctx.id} connected`);
 *     ctx.join("general");
 *   }
 *
 *   async onMessage(ctx: WebSocketContext, message: any) {
 *     ctx.broadcast({ user: ctx.id, text: message.text });
 *   }
 *
 *   async onDisconnect(ctx: WebSocketContext) {
 *     console.log(`Client ${ctx.id} disconnected`);
 *   }
 * }
 * ```
 */
export function ws(path: string): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(WS_METADATA_KEY, { path }, target);
  };
}

/**
 * Context object provided to every WebSocket lifecycle hook.
 * Contains connection details, room management, and send utilities.
 */
export interface WebSocketContext {
  /** Unique connection identifier */
  id: string;
  /** Raw WebSocket connection instance (platform-specific) */
  connection: any;
  /** Parsed URL of the upgrade request */
  url: URL;
  /** URL path parameters extracted from the pattern */
  params: Record<string, string>;
  /** URL query parameters */
  query: Record<string, string>;
  /** Request headers from the initial upgrade */
  headers: Record<string, string>;
  /** Authenticated user if authentication was performed */
  user?: any;
  /** Current room the connection is in (last joined) */
  room?: string;
  /** Mutable state map scoped to this connection's lifetime */
  state: Map<string, unknown>;

  /** Send JSON-serializable data to this connection */
  send(data: any): void;
  /** Join a named room (creates it if it does not exist) */
  join(room: string): void;
  /** Leave a named room */
  leave(room: string): void;
  /**
   * Return a sender scoped to a specific room.
   * The returned object has a single `send` method.
   */
  to(room: string): { send: (data: any) => void };
  /** Send data to every connection that shares at least one room with this one */
  broadcast(data: any): void;
}

/**
 * Interface that WebSocket handler classes should implement.
 * All hooks are optional.
 */
export interface WebSocketHandler {
  /** Called when a new WebSocket connection is established */
  onConnect?(ctx: WebSocketContext): void | Promise<void>;
  /** Called when a WebSocket connection is closed */
  onDisconnect?(ctx: WebSocketContext): void | Promise<void>;
  /** Called when a message is received from the connected client */
  onMessage?(ctx: WebSocketContext, message: any): void | Promise<void>;
}

/**
 * Manages named rooms and their member connections.
 * Rooms enable broadcasting messages to subsets of connected clients.
 */
export class WebSocketRoomManager {
  private rooms = new Map<string, Set<string>>();
  private connections = new Map<string, { connection: any; rooms: Set<string> }>();

  /**
   * Add a connection to a room.
   * Creates the room if it does not exist.
   */
  join(connectionId: string, connection: any, room: string): void {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(connectionId);

    let conn = this.connections.get(connectionId);
    if (!conn) {
      conn = { connection, rooms: new Set() };
      this.connections.set(connectionId, conn);
    }
    conn.rooms.add(room);
  }

  /**
   * Remove a connection from a room.
   * Deletes empty rooms automatically.
   */
  leave(connectionId: string, room: string): void {
    const roomSet = this.rooms.get(room);
    if (roomSet) {
      roomSet.delete(connectionId);
      if (roomSet.size === 0) {
        this.rooms.delete(room);
      }
    }
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.rooms.delete(room);
    }
  }

  /**
   * Send data to every connection in a room, optionally excluding one.
   */
  broadcast(room: string, data: any, excludeConnectionId?: string): void {
    const members = this.rooms.get(room);
    if (!members) return;
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    for (const connId of members) {
      if (connId === excludeConnectionId) continue;
      const conn = this.connections.get(connId);
      if (conn?.connection.readyState === 1) {
        try {
          conn.connection.send(payload);
        } catch {
          // Ignore individual send failures
        }
      }
    }
  }

  /** Get all connection instances in a room. */
  getConnections(room: string): any[] {
    const members = this.rooms.get(room);
    if (!members) return [];
    const result: any[] = [];
    for (const connId of members) {
      const conn = this.connections.get(connId);
      if (conn) result.push(conn.connection);
    }
    return result;
  }

  /** Remove a connection from all rooms and clean up. */
  removeConnection(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    for (const room of conn.rooms) {
      const roomSet = this.rooms.get(room);
      if (roomSet) {
        roomSet.delete(connectionId);
        if (roomSet.size === 0) {
          this.rooms.delete(room);
        }
      }
    }
    this.connections.delete(connectionId);
  }

  /** Get the set of rooms a connection belongs to. */
  getConnectionRooms(connectionId: string): Set<string> {
    return this.connections.get(connectionId)?.rooms ?? new Set();
  }
}

/**
 * Core WebSocket engine that manages handler registration and connection lifecycle.
 * Used by adapters to handle WebSocket upgrade requests.
 */
export class WebSocketEngine {
  private handlers = new Map<string, WebSocketHandler>();
  private roomManager = new WebSocketRoomManager();
  private connectionCounter = 0;

  /** Access the underlying room manager. */
  getRoomManager(): WebSocketRoomManager {
    return this.roomManager;
  }

  /**
   * Register a WebSocket handler for a URL path pattern.
   *
   * @param pattern - The URL path (e.g. "/chat", "/ws/:roomId")
   * @param handler - Object implementing one or more WebSocketHandler hooks
   */
  register(pattern: string, handler: WebSocketHandler): void {
    if (this.handlers.has(pattern)) {
      throw new Error(`WebSocket handler already registered for pattern "${pattern}"`);
    }
    this.handlers.set(pattern, handler);
  }

  /** Check if a handler is registered for the given path. */
  hasHandler(pattern: string): boolean {
    return this.handlers.has(pattern);
  }

  /** Get all registered handler patterns. */
  getPatterns(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Handle a new WebSocket connection.
   * Called by adapters after a successful HTTP upgrade.
   *
   * @param ws - The WebSocket connection instance
   * @param req - The original HTTP upgrade request
   * @param pattern - The matched handler pattern
   * @param params - Extracted path parameters
   */
  handleConnection(ws: any, req: any, pattern: string, params: Record<string, string>): void {
    const handler = this.handlers.get(pattern);
    if (!handler) {
      try {
        ws.close(4000, "No handler registered for this pattern");
      } catch {
        // Connection may already be closed
      }
      return;
    }

    const connectionId = `conn_${++this.connectionCounter}_${Date.now()}`;
    const url = new URL(req.url ?? "/", `http://${req.headers?.host ?? "localhost"}`);

    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    const headers: Record<string, string> = {};
    if (req.headers) {
      for (const [key, value] of Object.entries(req.headers as Record<string, unknown>)) {
        headers[key] = Array.isArray(value) ? (value as string[]).join(", ") : String(value ?? "");
      }
    }

    const ctx: WebSocketContext = {
      id: connectionId,
      connection: ws,
      url,
      params,
      query,
      headers,
      state: new Map(),

      send: (data: any) => {
        if (ws.readyState === 1) {
          ws.send(typeof data === "string" ? data : JSON.stringify(data));
        }
      },

      join: (room: string) => {
        this.roomManager.join(connectionId, ws, room);
        ctx.room = room;
      },

      leave: (room: string) => {
        this.roomManager.leave(connectionId, room);
        if (ctx.room === room) {
          delete (ctx as any).room;
        }
      },

      to: (room: string) => ({
        send: (data: any) => {
          this.roomManager.broadcast(room, data, connectionId);
        },
      }),

      broadcast: (data: any) => {
        const rooms = this.roomManager.getConnectionRooms(connectionId);
        for (const room of rooms) {
          this.roomManager.broadcast(room, data, connectionId);
        }
      },
    };

    ws.on("message", async (raw: any) => {
      try {
        let message: any;
        try {
          message = JSON.parse(raw.toString());
        } catch {
          message = raw.toString();
        }
        await handler.onMessage?.(ctx, message);
      } catch (err) {
        console.error(`[WebSocket] Message handler error (${connectionId}):`, err);
      }
    });

    ws.on("close", async () => {
      try {
        await handler.onDisconnect?.(ctx);
      } catch (err) {
        console.error(`[WebSocket] onDisconnect error (${connectionId}):`, err);
      }
      this.roomManager.removeConnection(connectionId);
    });

    ws.on("error", (err: Error) => {
      console.error(`[WebSocket] Connection error (${connectionId}):`, err);
      this.roomManager.removeConnection(connectionId);
    });

    try {
      const result = handler.onConnect?.(ctx);
      if (result instanceof Promise) {
        result.catch((err) => {
          console.error(`[WebSocket] onConnect error (${connectionId}):`, err);
          try { ws.close(1011, "Internal error"); } catch { /* ignore */ }
        });
      }
    } catch (err) {
      console.error(`[WebSocket] onConnect error (${connectionId}):`, err);
      try { ws.close(1011, "Internal error"); } catch { /* ignore */ }
    }
  }
}
