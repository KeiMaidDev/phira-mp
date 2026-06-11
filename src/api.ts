import { AdminRoomsResponse, AdminUserInfoResponse, PhiraMpConfig, RoomListResponse } from './types'

export class PhiraApiClient {
  private readonly baseUrl: string
  private readonly adminToken?: string

  constructor(config: PhiraMpConfig) {
    this.baseUrl = config.serverUrl.replace(/\/$/, '')
    this.adminToken = config.adminToken?.trim() || undefined
  }

  hasAdminToken(): boolean {
    return Boolean(this.adminToken)
  }

  getWsUrl(): string {
    return this.baseUrl.replace(/^http/i, 'ws') + '/ws'
  }

  private async request<T>(method: string, path: string, body?: unknown, requireAdmin = false): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    if (requireAdmin) {
      if (!this.adminToken) throw new Error('未配置管理员 Token，无法使用管理员功能')
      headers['X-Admin-Token'] = this.adminToken
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    let data: unknown
    const text = await response.text()
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { error: text }
    }

    if (!response.ok) {
      const error = typeof data === 'object' && data && 'error' in data
        ? String((data as { error?: unknown }).error ?? '')
        : ''
      throw new Error(this.translateError(error) || `HTTP ${response.status}`)
    }

    return data as T
  }

  private translateError(error?: string): string {
    const map: Record<string, string> = {
      'admin-disabled': '管理员 API 已禁用（未配置 Token）',
      unauthorized: '未授权，Token 无效或缺失',
      'room-not-found': '房间不存在',
      'bad-room-id': '房间 ID 格式错误',
      'bad-message': '消息内容为空',
      'message-too-long': '消息超过 200 字符限制',
      'bad-user-id': '用户 ID 格式错误',
      'user-not-found': '用户不存在',
      'user-not-connected': '该用户当前不在线',
      'bad-max-users': '人数限制值不合法（需为 1~64）',
      'bad-enabled': '参数 enabled 缺失或格式错误',
      'otp-disabled-when-token-configured': '已配置永久 Token，OTP 功能已禁用',
      'invalid-or-expired-otp': 'OTP 无效或已过期',
      'token-expired': 'Token 已过期或 IP 不匹配',
    }
    return map[error ?? ''] ?? error ?? '未知错误'
  }

  getRooms(): Promise<RoomListResponse> {
    return this.request<RoomListResponse>('GET', '/room')
  }

  getRoomCreationConfig(): Promise<{ ok: boolean; enabled: boolean }> {
    return this.request('GET', '/room-creation/config')
  }

  getReplayConfig(): Promise<{ ok: boolean; enabled: boolean }> {
    return this.request('GET', '/replay/config')
  }

  adminGetRooms(): Promise<AdminRoomsResponse> {
    return this.request<AdminRoomsResponse>('GET', '/admin/rooms', undefined, true)
  }

  adminGetUser(userId: number): Promise<AdminUserInfoResponse> {
    return this.request<AdminUserInfoResponse>('GET', `/admin/users/${userId}`, undefined, true)
  }

  adminBroadcast(message: string): Promise<{ ok: boolean; rooms: number }> {
    return this.request('POST', '/admin/broadcast', { message }, true)
  }

  adminRoomChat(roomId: string, message: string): Promise<{ ok: boolean }> {
    return this.request('POST', `/admin/rooms/${encodeURIComponent(roomId)}/chat`, { message }, true)
  }

  adminBanUser(userId: number, banned: boolean, disconnect = false): Promise<{ ok: boolean }> {
    return this.request('POST', '/admin/ban/user', { userId, banned, disconnect }, true)
  }

  adminBanRoom(userId: number, roomId: string, banned: boolean): Promise<{ ok: boolean }> {
    return this.request('POST', '/admin/ban/room', { userId, roomId, banned }, true)
  }

  adminDisconnectUser(userId: number): Promise<{ ok: boolean }> {
    return this.request('POST', `/admin/users/${userId}/disconnect`, undefined, true)
  }

  adminDisbandRoom(roomId: string): Promise<{ ok: boolean }> {
    return this.request('POST', `/admin/rooms/${encodeURIComponent(roomId)}/disband`, undefined, true)
  }

  adminSetMaxUsers(roomId: string, maxUsers: number): Promise<{ ok: boolean }> {
    return this.request('POST', `/admin/rooms/${encodeURIComponent(roomId)}/max_users`, { maxUsers }, true)
  }

  adminSetReplay(enabled: boolean): Promise<{ ok: boolean; enabled: boolean }> {
    return this.request('POST', '/admin/replay/config', { enabled }, true)
  }

  adminGetReplayConfig(): Promise<{ ok: boolean; enabled: boolean }> {
    return this.request('GET', '/admin/replay/config', undefined, true)
  }

  adminSetRoomCreation(enabled: boolean): Promise<{ ok: boolean; enabled: boolean }> {
    return this.request('POST', '/admin/room-creation/config', { enabled }, true)
  }

  adminGetRoomCreationConfig(): Promise<{ ok: boolean; enabled: boolean }> {
    return this.request('GET', '/admin/room-creation/config', undefined, true)
  }

  adminMoveUser(userId: number, roomId: string, monitor = false): Promise<{ ok: boolean }> {
    return this.request('POST', `/admin/users/${userId}/move`, { roomId, monitor }, true)
  }

  adminContestConfig(roomId: string, enabled: boolean, whitelist: number[]): Promise<{ ok: boolean }> {
    return this.request('POST', `/admin/contest/rooms/${encodeURIComponent(roomId)}/config`, { enabled, whitelist }, true)
  }

  adminContestWhitelist(roomId: string, userIds: number[]): Promise<{ ok: boolean }> {
    return this.request('POST', `/admin/contest/rooms/${encodeURIComponent(roomId)}/whitelist`, { userIds }, true)
  }

  adminContestStart(roomId: string, force = false): Promise<{ ok: boolean }> {
    return this.request('POST', `/admin/contest/rooms/${encodeURIComponent(roomId)}/start`, { force }, true)
  }

  adminGetIpBlacklist(): Promise<{ ok: boolean; blacklist: Array<{ ip: string; expiresIn: number }> }> {
    return this.request('GET', '/admin/ip-blacklist', undefined, true)
  }

  adminRemoveIpBlacklist(ip: string): Promise<{ ok: boolean }> {
    return this.request('POST', '/admin/ip-blacklist/remove', { ip }, true)
  }

  adminClearIpBlacklist(): Promise<{ ok: boolean }> {
    return this.request('POST', '/admin/ip-blacklist/clear', undefined, true)
  }

  adminGetLogRate(): Promise<{ ok: boolean; rate: number }> {
    return this.request('GET', '/admin/log-rate', undefined, true)
  }
}
