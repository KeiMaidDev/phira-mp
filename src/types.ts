export type RoomState = 'select_chart' | 'waiting_for_ready' | 'playing'

export interface RoomChart {
  name: string
  id: number | string
}

export interface RoomHost {
  id: number | string
  name: string
}

export interface RoomPlayer {
  id: number | string
  name: string
  is_ready?: boolean
}

export interface RoomMonitor {
  id: number | string
  name: string
}

export interface PublicRoom {
  roomid: string
  cycle: boolean
  lock?: boolean
  locked?: boolean
  host: RoomHost
  state: RoomState
  chart: RoomChart | null
  players: RoomPlayer[]
}

export interface RoomListResponse {
  rooms: PublicRoom[]
  total: number
}

export interface AdminUser {
  id: number
  name: string
  connected: boolean
  is_host: boolean
  game_time: number | null
  language: string
  finished?: boolean
  aborted?: boolean
  record_id?: number
}

export interface AdminMonitor {
  id: number
  name: string
  connected: boolean
  language: string
}

export interface AdminRoomStateBase {
  type: RoomState
}

export interface AdminRoomStatePlaying extends AdminRoomStateBase {
  type: 'playing'
  results_count: number
  aborted_count: number
  finished_users: number[]
  aborted_users: number[]
}

export interface AdminRoomStateWaiting extends AdminRoomStateBase {
  type: 'waiting_for_ready'
  ready_users?: number[]
  ready_count?: number
}

export interface AdminRoomStateSelect extends AdminRoomStateBase {
  type: 'select_chart'
}

export type AdminRoomState = AdminRoomStateSelect | AdminRoomStateWaiting | AdminRoomStatePlaying

export interface RecentLog {
  message: string
  timestamp: number
}

export interface AdminRoom {
  roomid: string
  max_users: number
  live: boolean
  locked: boolean
  cycle: boolean
  host: { id: number; name: string; connected?: boolean }
  state: AdminRoomState
  chart: { id: number; name: string } | null
  users: AdminUser[]
  monitors: AdminMonitor[]
  recent_logs?: RecentLog[]
  replay_eligible?: boolean
  contest?: {
    whitelist_count: number
    whitelist: number[]
    manual_start: boolean
    auto_disband: boolean
  }
}

export interface AdminRoomsResponse {
  ok: boolean
  total_rooms: number
  rooms: AdminRoom[]
}

export interface AdminUserInfoResponse {
  ok: boolean
  user: {
    id: number
    name: string
    monitor: boolean
    connected: boolean
    room: string
    banned: boolean
  }
}

export interface WsRoomUpdateData {
  roomid: string
  state: RoomState
  locked: boolean
  cycle: boolean
  live: boolean
  chart: { name: string; id: number } | null
  host: { id: number; name: string }
  users: Array<{ id: number; name: string; is_ready: boolean }>
  monitors: Array<{ id: number; name: string }>
}

export interface WsRoomLogData {
  message: string
  timestamp: number
}

export type WsServerMessage =
  | { type: 'subscribed'; roomId: string }
  | { type: 'unsubscribed' }
  | { type: 'pong' }
  | { type: 'room_update'; data: WsRoomUpdateData }
  | { type: 'room_log'; data: WsRoomLogData }
  | { type: 'error'; message: string }
  | { type: 'admin_subscribed' }
  | { type: 'admin_unsubscribed' }
  | { type: 'admin_update'; data: { timestamp: number; changes: { rooms: AdminRoom[]; total_rooms: number } } }

export interface PhiraMpConfig {
  /** Phira 服务器 HTTP 地址，如 http://localhost:12347，用于 API 请求 */
  serverUrl: string
  /** 状态信息中展示给用户看的服务器地址；为空则显示 serverUrl */
  displayServerUrl?: string
  /** 管理员 Token，不填则只启用公共查询命令 */
  adminToken?: string
  /** 主命令名称 */
  commandPrefix?: string
  /** 房间列表每页数量 */
  pageSize?: number
  /** 是否启用 WebSocket 实时推送 */
  wsEnabled?: boolean
  /** WebSocket 心跳间隔，单位毫秒 */
  wsHeartbeat?: number
  /** 是否优先使用 QQ rawmarkdown；关闭后发送普通文本，便于非 QQ 适配器调试 */
  qqMarkdown?: boolean
}

export interface QQButton {
  render_data: {
    label: string
    visited_label?: string
    style?: 0 | 1
  }
  action: {
    /** 1=跳转，2=回调命令 */
    type: 1 | 2
    /** QQ 按钮权限：1=仅 QQ 群管理员，2=所有人可用 */
    permission: { type: 0 | 1 | 2 | 3 }
    data: string
    enter?: boolean
    reply?: boolean
  }
}

export interface QQRow {
  buttons: QQButton[]
}

export interface QQKeyboard {
  content: {
    rows: QQRow[]
  }
}
