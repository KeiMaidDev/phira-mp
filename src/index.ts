import { Context, Schema, Session } from 'koishi'
import { PhiraApiClient } from './api'
import { registerAdminCommand } from './commands/admin'
import { registerContestCommand } from './commands/contest'
import { registerRoomsCommand } from './commands/rooms'
import { CommandRuntime, PushTarget, RoomSubscription, sendPushTarget } from './commands/shared'
import { registerStatusCommand } from './commands/status'
import { registerWatchCommand } from './commands/watch'
import { formatTimestamp } from './format'
import { adminBtn, btn, mdCodeBlock, mdEscape, qqMsg, sendMarkdown } from './qqrender'
import { PhiraMpConfig } from './types'
import { PhiraWsClient } from './ws'

export const name = 'phira-mp'

export const usage = `
## Phira 联机服务器管理插件

支持 QQ 官方适配器的 Markdown 与按钮消息。

### 公共命令
- \`phira room\`：查看房间列表
- \`phira room <页码>\`：查看指定页
- \`phira room <房间ID>\`：查看房间详情
- \`phira status\`：查看服务器状态

### WebSocket 推送
- \`phira watch <房间ID>\`：当前频道订阅指定房间日志
- \`phira unwatch\`：取消当前频道订阅
- \`phira wsadmin\`：当前频道订阅管理员全房间更新

### 管理员命令
- \`phira admin room [页码/房间ID]\`
- \`phira admin user <用户ID>\`
- \`phira admin broadcast <消息>\`
- \`phira admin chat <房间ID> <消息>\`
- \`phira admin ban/unban/kick <用户ID>\`
- \`phira admin disband <房间ID>\`
- \`phira admin maxusers <房间ID> <人数>\`
- \`phira admin replay on|off\`
- \`phira admin roomcreate on|off\`
- \`phira admin move <用户ID> <房间ID>\`
- \`phira admin banroom/unbanroom <用户ID> <房间ID>\`
- \`phira admin ip list/remove/clear\`
- \`phira admin lograte\`

### 比赛命令
- \`phira contest enable <房间ID> [用户ID...]\`
- \`phira contest disable <房间ID>\`
- \`phira contest whitelist <房间ID> [用户ID...]\`
- \`phira contest start <房间ID>\`
- \`phira contest forcestart <房间ID>\`
`

export const Config: Schema<PhiraMpConfig> = Schema.object({
  serverUrl: Schema.string()
    .required()
    .description('Phira 服务器 HTTP 地址，如 http://localhost:12347；用于 API 请求'),
  displayServerUrl: Schema.string()
    .description('状态信息中展示给用户看的服务器地址；不填则显示 serverUrl'),
  adminToken: Schema.string()
    .role('secret')
    .description('管理员 Token；不填则只启用公共查询功能'),
  commandPrefix: Schema.string()
    .default('phira')
    .description('主命令名称'),
  pageSize: Schema.number()
    .default(5)
    .min(1)
    .max(20)
    .description('列表每页显示数量'),
  wsEnabled: Schema.boolean()
    .default(false)
    .description('是否启用 WebSocket 实时推送'),
  wsHeartbeat: Schema.number()
    .default(25000)
    .min(5000)
    .description('WebSocket 心跳间隔，单位毫秒'),
  qqMarkdown: Schema.boolean()
    .default(true)
    .description('是否使用 QQ rawmarkdown + 按钮；关闭后退化为普通文本'),
})

export function apply(ctx: Context, config: PhiraMpConfig): void {
  const logger = ctx.logger('phira-mp')
  const api = new PhiraApiClient(config)
  const prefix = config.commandPrefix || 'phira'
  const pageSize = config.pageSize ?? 5
  const qqMarkdown = config.qqMarkdown ?? true
  const wsEnabled = config.wsEnabled ?? false
  const displayServerUrl = config.displayServerUrl?.trim() || config.serverUrl
  const wsHeartbeat = config.wsHeartbeat ?? 25_000

  const roomSubscriptions = new Map<string, RoomSubscription>()
  const channelWatchMap = new Map<string, string>()
  const adminTargets = new Map<string, PushTarget>()
  let adminClient: PhiraWsClient | null = null

  function getTarget(session: Session): PushTarget | null {
    if (!session.channelId || !session.bot) return null
    const key = [session.platform, session.guildId ?? '', session.channelId].join(':')
    return {
      bot: session.bot,
      guildId: session.guildId,
      channelId: session.channelId,
      key,
      session,
    }
  }

  function removeRoomWatch(channelKey: string): string | null {
    const roomId = channelWatchMap.get(channelKey)
    if (!roomId) return null

    channelWatchMap.delete(channelKey)
    const subscription = roomSubscriptions.get(roomId)
    if (subscription) {
      subscription.targets.delete(channelKey)
      if (!subscription.targets.size) {
        subscription.client.unsubscribe()
        subscription.client.destroy()
        roomSubscriptions.delete(roomId)
      }
    }
    return roomId
  }

  function stopAdminIfNoTargets(): void {
    if (!adminTargets.size && adminClient) {
      adminClient.unsubscribe()
      adminClient.destroy()
      adminClient = null
    }
  }

  function getAdminClient(): PhiraWsClient {
    if (adminClient) return adminClient

    adminClient = new PhiraWsClient({
      wsUrl: api.getWsUrl(),
      adminToken: config.adminToken,
      heartbeatMs: wsHeartbeat,
      logger,
      onAdminUpdate: async (data) => {
        if (!adminTargets.size) return
        const rooms = data.changes.rooms ?? []
        const markdown = [
          '## 🔐 Phira 管理员更新',
          `**时间**　${formatTimestamp(data.timestamp)}`,
          `**房间总数**　${data.changes.total_rooms}`,
          ...rooms.slice(0, 5).map((room) => `> · ${mdEscape(room.roomid)}　${mdEscape(room.state.type)}　${room.users.length}/${room.max_users}`),
        ].join('\n')
        const content = qqMarkdown ? qqMsg(markdown) : markdown.replace(/^#{1,6}\s*/gm, '').replace(/\*\*/g, '')
        const results = await Promise.allSettled(Array.from(adminTargets.values()).map((target) => sendPushTarget(target, content)))
        results.forEach((result, index) => {
          if (result.status === 'rejected') logger.warn('[Phira WS] 管理员推送失败 #%d：%s', index + 1, result.reason?.message ?? result.reason)
        })
      },
      onErrorMessage: async (message) => {
        if (!adminTargets.size) return
        const markdown = `## ⚠️ 管理员 WS 错误\n${mdEscape(message)}`
        const content = qqMarkdown ? qqMsg(markdown) : markdown.replace(/^#{1,6}\s*/gm, '').replace(/\*\*/g, '')
        const results = await Promise.allSettled(Array.from(adminTargets.values()).map((target) => sendPushTarget(target, content)))
        results.forEach((result, index) => {
          if (result.status === 'rejected') logger.warn('[Phira WS] 管理员推送失败 #%d：%s', index + 1, result.reason?.message ?? result.reason)
        })
      },
    })
    return adminClient
  }

  const runtime: CommandRuntime = {
    api,
    logger,
    prefix,
    pageSize,
    serverUrl: config.serverUrl,
    displayServerUrl,
    qqMarkdown,
    wsEnabled,
    wsHeartbeat,
    wsUrl: api.getWsUrl(),
    adminToken: config.adminToken,
    roomSubscriptions,
    channelWatchMap,
    adminTargets,
    getAdminClient,
    stopAdminIfNoTargets,
    removeRoomWatch,
    getTarget,
  }

  const root = ctx.command(prefix, 'Phira 联机服务器管理')
    .action(async ({ session }: any) => {
      await sendMarkdown(session, [
        '## 🎵 Phira 联机服务器',
        '**服务器地址**',
        mdCodeBlock(displayServerUrl),
        '**公共功能**',
        `> · ${prefix} room：查看房间列表/详情`,
        `> · ${prefix} status：查看服务器状态`,
        '**实时推送**',
        `> · ${prefix} watch <房间ID>：订阅房间日志`,
        `> · ${prefix} unwatch：取消当前频道订阅`,
        '**管理员功能**',
        `> · ${prefix} admin：打开管理员菜单`,
        `> · ${prefix} contest：打开比赛房间菜单`,
      ].join('\n'), [
        btn('🎵 房间列表', `${prefix} room`),
        btn('📊 状态', `${prefix} status`, 0),
        adminBtn('🔐 管理员菜单', `${prefix} admin`, 0),
        adminBtn('🏁 比赛菜单', `${prefix} contest`, 0),
      ], qqMarkdown)
      return
    })
  registerRoomsCommand(root, runtime)
  registerStatusCommand(root, runtime)
  registerWatchCommand(root, runtime)
  registerAdminCommand(root, runtime)
  registerContestCommand(root, runtime)

  ctx.on('dispose', () => {
    for (const subscription of roomSubscriptions.values()) subscription.client.destroy()
    roomSubscriptions.clear()
    channelWatchMap.clear()
    adminClient?.destroy()
    adminClient = null
    adminTargets.clear()
  })
}
