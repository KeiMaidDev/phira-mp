import { Bot, Command, Logger, Session } from 'koishi'
import { PhiraApiClient } from '../api'
import { PhiraWsClient } from '../ws'

export interface PushTarget {
  bot: Bot
  channelId: string
  guildId?: string
  key: string
  /**
   * 保留触发 watch/wsadmin 的会话。
   * QQ 官方/部分 Crack 适配器在 C2C/群聊中常需要原始 msg_id/msg_seq 才能发送被动消息；
   * bot.sendMessage() 没有这部分上下文，可能导致实时推送失败。
   */
  session?: Session
}

export interface RoomSubscription {
  client: PhiraWsClient
  targets: Map<string, PushTarget>
  /** 用于 room_update 去重，避免同一状态重复推送 */
  lastUpdateSignature?: string
}

export interface CommandRuntime {
  api: PhiraApiClient
  logger: Logger
  prefix: string
  pageSize: number
  serverUrl: string
  displayServerUrl: string
  qqMarkdown: boolean
  wsEnabled: boolean
  wsHeartbeat: number
  wsUrl: string
  adminToken?: string
  roomSubscriptions: Map<string, RoomSubscription>
  channelWatchMap: Map<string, string>
  adminTargets: Map<string, PushTarget>
  getAdminClient: () => PhiraWsClient
  stopAdminIfNoTargets: () => void
  removeRoomWatch: (channelKey: string) => string | null
  getTarget: (session: Session) => PushTarget | null
}

export type RegisterCommand = (parent: Command, runtime: CommandRuntime) => void

export function requireAdmin(api: PhiraApiClient): string | null {
  return api.hasAdminToken() ? null : '未配置管理员 Token，无法使用管理员功能喵～'
}

export function parseOnOff(action?: string): boolean | null {
  if (action === 'on' || action === '开' || action === '开启') return true
  if (action === 'off' || action === '关' || action === '关闭') return false
  return null
}

export async function sendPushTarget(target: PushTarget, content: any): Promise<void> {
  // 优先使用保存下来的 session.send()。这能让 QQ 适配器携带原消息上下文
  // （msg_id / msg_seq / event_id 等），避免 bot.sendMessage() 在 QQ C2C/群聊里
  // 因缺少被动回复上下文而发送失败。
  if (target.session) {
    await target.session.send(content)
    return
  }
  await target.bot.sendMessage(target.channelId, content, target.guildId)
}
