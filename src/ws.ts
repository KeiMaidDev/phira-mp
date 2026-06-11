import WebSocket from 'ws'
import { Logger } from 'koishi'
import { WsServerMessage } from './types'

export interface PhiraWsClientOptions {
  wsUrl: string
  adminToken?: string
  heartbeatMs?: number
  logger: Logger
  onRoomLog?: (roomId: string, message: string, timestamp: number) => void
  onRoomUpdate?: (roomId: string, data: Extract<WsServerMessage, { type: 'room_update' }>['data']) => void
  onAdminUpdate?: (data: Extract<WsServerMessage, { type: 'admin_update' }>['data']) => void
  onErrorMessage?: (message: string) => void
}

type SubscribeMode =
  | { type: 'none' }
  | { type: 'room'; roomId: string; userId?: number }
  | { type: 'admin' }

export class PhiraWsClient {
  private readonly wsUrl: string
  private readonly adminToken?: string
  private readonly heartbeatMs: number
  private readonly logger: Logger
  private readonly onRoomLog?: PhiraWsClientOptions['onRoomLog']
  private readonly onRoomUpdate?: PhiraWsClientOptions['onRoomUpdate']
  private readonly onAdminUpdate?: PhiraWsClientOptions['onAdminUpdate']
  private readonly onErrorMessage?: PhiraWsClientOptions['onErrorMessage']

  private ws: WebSocket | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false
  private mode: SubscribeMode = { type: 'none' }

  constructor(options: PhiraWsClientOptions) {
    this.wsUrl = options.wsUrl
    this.adminToken = options.adminToken
    this.heartbeatMs = options.heartbeatMs ?? 25_000
    this.logger = options.logger
    this.onRoomLog = options.onRoomLog
    this.onRoomUpdate = options.onRoomUpdate
    this.onAdminUpdate = options.onAdminUpdate
    this.onErrorMessage = options.onErrorMessage
  }

  connect(): void {
    if (this.destroyed || this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return

    try {
      this.ws = new WebSocket(this.wsUrl)
    } catch (error) {
      this.logger.warn('[Phira WS] 创建连接失败：%s', (error as Error).message)
      this.scheduleReconnect()
      return
    }

    this.ws.on('open', () => {
      this.logger.debug('[Phira WS] 已连接：%s', this.describeMode())
      this.startHeartbeat()
      this.restoreSubscription()
    })

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        this.handleMessage(JSON.parse(raw.toString()) as WsServerMessage)
      } catch (error) {
        this.logger.warn('[Phira WS] 消息解析失败：%s', (error as Error).message)
      }
    })

    this.ws.on('error', (error: Error) => {
      this.logger.warn('[Phira WS] 连接错误：%s', error.message)
    })

    this.ws.on('close', () => {
      this.logger.debug('[Phira WS] 已断开：%s', this.describeMode())
      this.stopHeartbeat()
      this.ws = null
      if (!this.destroyed) this.scheduleReconnect()
    })
  }

  subscribeRoom(roomId: string, userId?: number): void {
    this.mode = { type: 'room', roomId, userId }
    this.connect()
    this.restoreSubscription()
  }

  subscribeAdmin(): void {
    this.mode = { type: 'admin' }
    this.connect()
    this.restoreSubscription()
  }

  unsubscribe(): void {
    const previous = this.mode
    this.mode = { type: 'none' }
    if (previous.type === 'admin') this.send({ type: 'admin_unsubscribe' })
    if (previous.type === 'room') this.send({ type: 'unsubscribe' })
  }

  destroy(): void {
    this.destroyed = true
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private restoreSubscription(): void {
    if (!this.isConnected()) return
    if (this.mode.type === 'room') {
      this.send({
        type: 'subscribe',
        roomId: this.mode.roomId,
        ...(this.mode.userId ? { userId: this.mode.userId } : {}),
      })
    } else if (this.mode.type === 'admin') {
      if (!this.adminToken) {
        this.onErrorMessage?.('未配置管理员 Token，无法开启 WS 管理员订阅')
        return
      }
      this.send({ type: 'admin_subscribe', token: this.adminToken })
    }
  }

  private handleMessage(message: WsServerMessage): void {
    switch (message.type) {
      case 'pong':
        return
      case 'subscribed':
        this.logger.info('[Phira WS] 已订阅房间：%s', message.roomId)
        return
      case 'unsubscribed':
        this.logger.info('[Phira WS] 已取消房间订阅')
        return
      case 'admin_subscribed':
        this.logger.info('[Phira WS] 已开启管理员订阅')
        return
      case 'admin_unsubscribed':
        this.logger.info('[Phira WS] 已取消管理员订阅')
        return
      case 'room_log':
        if (this.mode.type === 'room') {
          this.onRoomLog?.(this.mode.roomId, message.data.message, message.data.timestamp)
        }
        return
      case 'room_update':
        this.onRoomUpdate?.(message.data.roomid, message.data)
        return
      case 'admin_update':
        this.onAdminUpdate?.(message.data)
        return
      case 'error':
        this.logger.warn('[Phira WS] 服务端错误：%s', message.message)
        this.onErrorMessage?.(message.message)
        return
    }
  }

  private send(payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => this.send({ type: 'ping' }), this.heartbeatMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(delayMs = 5_000): void {
    if (this.destroyed || this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delayMs)
  }

  private describeMode(): string {
    if (this.mode.type === 'room') return `room:${this.mode.roomId}`
    return this.mode.type
  }
}
