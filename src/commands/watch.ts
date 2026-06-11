import { formatTimestamp } from '../format'
import { adminBtn, btn, mdEscape, qqMsg, sendMarkdown } from '../qqrender'
import { PhiraWsClient } from '../ws'
import { CommandRuntime, PushTarget, RoomSubscription, sendPushTarget } from './shared'

async function pushToTargets(runtime: CommandRuntime, targets: Iterable<PushTarget>, markdown: string, buttons = [] as ReturnType<typeof btn>[]): Promise<void> {
  const content = runtime.qqMarkdown ? qqMsg(markdown, buttons) : markdown.replace(/^#{1,6}\s*/gm, '').replace(/\*\*/g, '')
  const targetList = Array.from(targets)
  const results = await Promise.allSettled(targetList.map((target) => sendPushTarget(target, content)))
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const target = targetList[index]
      runtime.logger.warn('[Phira WS] 推送到 %s 失败：%s', target.key, result.reason?.message ?? result.reason)
    }
  })
}

function ensureRoomSubscription(runtime: CommandRuntime, roomId: string): RoomSubscription {
  const existed = runtime.roomSubscriptions.get(roomId)
  if (existed) return existed

  const subscription: RoomSubscription = {
    targets: new Map(),
    client: new PhiraWsClient({
      wsUrl: runtime.wsUrl,
      adminToken: runtime.adminToken,
      heartbeatMs: runtime.wsHeartbeat,
      logger: runtime.logger,
      onRoomLog: async (id, message, timestamp) => {
        const markdown = [
          `## 📡 房间日志 ${mdEscape(id)}`,
          `**时间**　${formatTimestamp(timestamp)}`,
          `> ${mdEscape(message)}`,
        ].join('\n')
        await pushToTargets(runtime, subscription.targets.values(), markdown, [
          btn('退出订阅', `${runtime.prefix} unwatch`, 0),
          btn('查看房间', `${runtime.prefix} room ${id}`),
        ])
      },
      onRoomUpdate: undefined,
      onErrorMessage: (message) => {
        runtime.logger.warn('[Phira WS] 房间 %s 推送错误：%s', roomId, message)
      },
    }),
  }

  subscription.client.subscribeRoom(roomId)
  runtime.roomSubscriptions.set(roomId, subscription)
  return subscription
}

export function registerWatchCommand(parent: any, runtime: CommandRuntime): void {
  const { prefix } = runtime

  parent
    .subcommand('.watch <roomId:string>', '订阅房间实时日志到当前频道')
    .alias('订阅')
    .action(async ({ session }: any, roomId?: string) => {
      if (!runtime.wsEnabled) {
        await sendMarkdown(session, '## ⚠️ WebSocket 未启用\n请先在插件配置中开启 `wsEnabled` 喵～', [], runtime.qqMarkdown)
        return
      }
      if (!roomId) await sendMarkdown(session, '## ⚠️ 请输入房间 ID 喵～', [], runtime.qqMarkdown)
      if (!roomId) return

      const target = session ? runtime.getTarget(session) : null
      if (!target) await sendMarkdown(session, '## ❌ 无法识别当前频道\n请在群聊或频道内使用此命令喵～', [], runtime.qqMarkdown)
      if (!target) return

      const oldRoomId = runtime.removeRoomWatch(target.key)
      const subscription = ensureRoomSubscription(runtime, roomId)
      subscription.targets.set(target.key, target)
      runtime.channelWatchMap.set(target.key, roomId)

      const replaced = oldRoomId && oldRoomId !== roomId ? `\n已自动取消原房间 **${mdEscape(oldRoomId)}** 的订阅。` : ''
      await sendMarkdown(session, `## ✅ 已订阅房间日志\n当前频道将接收房间 **${mdEscape(roomId)}** 的实时日志喵～${replaced}`, [
        btn('取消订阅', `${prefix} unwatch`, 0),
        btn('查看房间', `${prefix} room ${roomId}`),
      ], runtime.qqMarkdown)
      return
    })

  parent
    .subcommand('.unwatch', '取消当前频道的房间/管理员实时订阅')
    .alias('取消订阅')
    .action(async ({ session }: any) => {
      const target = session ? runtime.getTarget(session) : null
      if (!target) await sendMarkdown(session, '## ❌ 无法识别当前频道喵～', [], runtime.qqMarkdown)
      if (!target) return

      const roomId = runtime.removeRoomWatch(target.key)
      const hadAdmin = runtime.adminTargets.delete(target.key)
      runtime.stopAdminIfNoTargets()

      if (!roomId && !hadAdmin) {
        await sendMarkdown(session, '## ℹ️ 当前频道没有订阅任何实时推送喵～', [
          btn('查看房间列表', `${prefix} room`, 0),
        ], runtime.qqMarkdown)
        return
      }

      const lines = ['## ✅ 已取消订阅']
      if (roomId) lines.push(`房间日志：**${mdEscape(roomId)}**`)
      if (hadAdmin) lines.push('管理员全房间监控')
      await sendMarkdown(session, lines.join('\n'), [
        btn('查看房间列表', `${prefix} room`, 0),
      ], runtime.qqMarkdown)
      return
    })

  parent
    .subcommand('.wsadmin', '开启 WebSocket 管理员全房间监控（需要 adminToken）')
    .action(async ({ session }: any) => {
      if (!runtime.api.hasAdminToken()) {
        await sendMarkdown(session, '## ❌ 权限不足\n未配置管理员 Token，无法使用管理员 WS 监控喵～', [], runtime.qqMarkdown)
        return
      }
      if (!runtime.wsEnabled) {
        await sendMarkdown(session, '## ⚠️ WebSocket 未启用\n请先在插件配置中开启 `wsEnabled` 喵～', [], runtime.qqMarkdown)
        return
      }

      const target = session ? runtime.getTarget(session) : null
      if (!target) await sendMarkdown(session, '## ❌ 无法识别当前频道喵～', [], runtime.qqMarkdown)
      if (!target) return

      runtime.adminTargets.set(target.key, target)
      runtime.getAdminClient().subscribeAdmin()
      await sendMarkdown(session, '## ✅ 管理员监控已开启\n当前频道将接收全房间管理更新喵～', [
        adminBtn('取消监控', `${prefix} unwatch`, 0),
        adminBtn('管理员房间列表', `${prefix} admin room`),
      ], runtime.qqMarkdown)
      return
    })
}
