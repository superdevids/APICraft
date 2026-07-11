import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ws, WebSocketEngine, WebSocketRoomManager, type WebSocketHandler, type WebSocketContext, WS_METADATA_KEY } from '../../packages/core/src/websocket/index.js'

describe('@ws decorator', () => {
  it('stores path metadata', () => {
    @ws('/chat')
    class ChatHandler implements WebSocketHandler {}

    const meta: { path: string } | undefined = Reflect.getOwnMetadata(WS_METADATA_KEY, ChatHandler)
    expect(meta).toBeDefined()
    expect(meta!.path).toBe('/chat')
  })

  it('stores complex path pattern', () => {
    @ws('/ws/:roomId')
    class RoomHandler implements WebSocketHandler {}

    const meta = Reflect.getOwnMetadata(WS_METADATA_KEY, RoomHandler)
    expect(meta!.path).toBe('/ws/:roomId')
  })
})

describe('WebSocketRoomManager', () => {
  let roomManager: WebSocketRoomManager
  let mockWs1: any
  let mockWs2: any

  beforeEach(() => {
    roomManager = new WebSocketRoomManager()
    mockWs1 = { readyState: 1, send: vi.fn() }
    mockWs2 = { readyState: 1, send: vi.fn() }
  })

  it('join adds connection to room', () => {
    roomManager.join('conn1', mockWs1, 'general')
    const rooms = roomManager.getConnectionRooms('conn1')
    expect(rooms.has('general')).toBe(true)
  })

  it('leave removes connection from room', () => {
    roomManager.join('conn1', mockWs1, 'general')
    roomManager.leave('conn1', 'general')
    const rooms = roomManager.getConnectionRooms('conn1')
    expect(rooms.has('general')).toBe(false)
  })

  it('broadcast sends to all members in room', () => {
    roomManager.join('conn1', mockWs1, 'general')
    roomManager.join('conn2', mockWs2, 'general')
    roomManager.broadcast('general', { type: 'message', text: 'hello' })
    expect(mockWs1.send).toHaveBeenCalled()
    expect(mockWs2.send).toHaveBeenCalled()
  })

  it('broadcast excludes sender when specified', () => {
    roomManager.join('conn1', mockWs1, 'general')
    roomManager.join('conn2', mockWs2, 'general')
    roomManager.broadcast('general', { type: 'message' }, 'conn1')
    expect(mockWs1.send).not.toHaveBeenCalled()
    expect(mockWs2.send).toHaveBeenCalled()
  })

  it('room isolation: messages only go to correct room', () => {
    roomManager.join('conn1', mockWs1, 'room-alpha')
    roomManager.join('conn2', mockWs2, 'room-beta')
    roomManager.broadcast('room-alpha', { text: 'alpha-only' })
    expect(mockWs1.send).toHaveBeenCalled()
    expect(mockWs2.send).not.toHaveBeenCalled()
  })

  it('removeConnection cleans up all rooms', () => {
    roomManager.join('conn1', mockWs1, 'general')
    roomManager.join('conn1', mockWs1, 'random')
    roomManager.removeConnection('conn1')
    expect(roomManager.getConnectionRooms('conn1').size).toBe(0)
  })

  it('getConnections returns connections in room', () => {
    roomManager.join('conn1', mockWs1, 'general')
    const conns = roomManager.getConnections('general')
    expect(conns).toHaveLength(1)
    expect(conns[0]).toBe(mockWs1)
  })

  it('getConnections returns empty for non-existent room', () => {
    const conns = roomManager.getConnections('nonexistent')
    expect(conns).toEqual([])
  })

  it('deletes room when last member leaves', () => {
    roomManager.join('conn1', mockWs1, 'temp')
    roomManager.leave('conn1', 'temp')
    expect(roomManager.getConnections('temp')).toEqual([])
  })
})

describe('WebSocketEngine', () => {
  let engine: WebSocketEngine

  beforeEach(() => {
    engine = new WebSocketEngine()
  })

  it('register adds handler for pattern', () => {
    const handler: WebSocketHandler = {
      onConnect: vi.fn(),
      onMessage: vi.fn(),
      onDisconnect: vi.fn(),
    }
    engine.register('/chat', handler)
    expect(engine.hasHandler('/chat')).toBe(true)
  })

  it('register throws for duplicate pattern', () => {
    engine.register('/chat', {})
    expect(() => engine.register('/chat', {})).toThrow(/already registered/)
  })

  it('getPatterns returns registered patterns', () => {
    engine.register('/chat', {})
    engine.register('/ws', {})
    const patterns = engine.getPatterns()
    expect(patterns).toContain('/chat')
    expect(patterns).toContain('/ws')
  })

  it('handleConnection calls onConnect', () => {
    const onConnect = vi.fn()
    engine.register('/test', { onConnect })
    const mockWs = { on: vi.fn(), close: vi.fn(), readyState: 1, send: vi.fn() }
    const mockReq = { url: '/test', headers: { host: 'localhost' } }
    engine.handleConnection(mockWs, mockReq, '/test', {})
    expect(onConnect).toHaveBeenCalled()
  })

  it('handleConnection passes path params', () => {
    const onConnect = vi.fn()
    engine.register('/ws/:id', { onConnect })
    const mockWs = { on: vi.fn(), close: vi.fn(), readyState: 1, send: vi.fn() }
    const mockReq = { url: '/ws/123', headers: { host: 'localhost' } }
    engine.handleConnection(mockWs, mockReq, '/ws/:id', { id: '123' })
    expect(onConnect).toHaveBeenCalled()
    const ctx: WebSocketContext = onConnect.mock.calls[0][0]
    expect(ctx.params.id).toBe('123')
  })

  it('closes connection when no handler registered', () => {
    const mockWs = { close: vi.fn(), on: vi.fn(), readyState: 1, send: vi.fn() }
    const mockReq = { url: '/test', headers: { host: 'localhost' } }
    engine.handleConnection(mockWs, mockReq, '/test', {})
    expect(mockWs.close).toHaveBeenCalledWith(4000, 'No handler registered for this pattern')
  })

  it('getRoomManager returns the room manager', () => {
    const rm = engine.getRoomManager()
    expect(rm).toBeInstanceOf(WebSocketRoomManager)
  })
})
