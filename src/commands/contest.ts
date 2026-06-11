import { parseUserIds } from '../format'
import { adminBtn, mdEscape, sendMarkdown } from '../qqrender'
import { CommandRuntime, requireAdmin } from './shared'

export function registerContestCommand(parent: any, runtime: CommandRuntime): void {
  const { api, prefix } = runtime
  const contest = parent.subcommand('.contest', '比赛房间管理（需要 adminToken）')

  contest.action(async ({ session }: any) => {
    const authError = requireAdmin(api)
    if (authError) {
      await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      return
    }

    await sendMarkdown(session, [
      '## 🏁 比赛房间菜单',
      `> · ${prefix} contest enable <房间ID> [用户ID...]：开启比赛模式`,
      `> · ${prefix} contest disable <房间ID>：关闭比赛模式`,
      `> · ${prefix} contest whitelist <房间ID> [用户ID...]：更新白名单`,
      `> · ${prefix} contest start <房间ID>：手动开始`,
      `> · ${prefix} contest forcestart <房间ID>：强制开始`,
    ].join('\n'), [
      adminBtn('🏠 管理员房间', `${prefix} admin room`),
      adminBtn('开启比赛', `${prefix} contest enable `, 0, false),
      adminBtn('更新白名单', `${prefix} contest whitelist `, 0, false),
      adminBtn('手动开始', `${prefix} contest start `, 0, false),
      adminBtn('强制开始', `${prefix} contest forcestart `, 0, false),
    ], runtime.qqMarkdown)
    return
  })

  contest
    .subcommand('.enable <roomId:string> [...userIds]', '开启比赛模式（可附带白名单用户 ID）')
    .action(async ({ session }: any, roomId?: string, ...userIds: unknown[]) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!roomId) await sendMarkdown(session, '## ⚠️ 请输入房间 ID 喵～', [], runtime.qqMarkdown)
      if (!roomId) return

      const whitelist = parseUserIds(userIds)
      try {
        await api.adminContestConfig(roomId, true, whitelist)
        const whitelistText = whitelist.length
          ? `白名单：${whitelist.join('、')}`
          : '未指定白名单，将使用服务端默认策略。'
        await sendMarkdown(session, `## ✅ 比赛模式已开启\n房间 **${mdEscape(roomId)}**\n\n${whitelistText}`, [
          adminBtn('查看房间', `${prefix} admin room ${roomId}`, 0),
          adminBtn('手动开始', `${prefix} contest start ${roomId}`),
          adminBtn('关闭比赛', `${prefix} contest disable ${roomId}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 操作失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  contest
    .subcommand('.disable <roomId:string>', '关闭比赛模式')
    .action(async ({ session }: any, roomId?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!roomId) await sendMarkdown(session, '## ⚠️ 请输入房间 ID 喵～', [], runtime.qqMarkdown)
      if (!roomId) return

      try {
        await api.adminContestConfig(roomId, false, [])
        await sendMarkdown(session, `## ✅ 比赛模式已关闭\n房间 **${mdEscape(roomId)}** 已恢复普通模式喵～`, [
          adminBtn('查看房间', `${prefix} admin room ${roomId}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 操作失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  contest
    .subcommand('.whitelist <roomId:string> [...userIds]', '更新比赛房间白名单')
    .action(async ({ session }: any, roomId?: string, ...userIds: unknown[]) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!roomId) await sendMarkdown(session, '## ⚠️ 请输入房间 ID 喵～', [], runtime.qqMarkdown)
      if (!roomId) return

      const ids = parseUserIds(userIds)
      if (!ids.length) await sendMarkdown(session, '## ⚠️ 请输入至少一个用户 ID 喵～', [], runtime.qqMarkdown)
      if (!ids.length) return

      try {
        await api.adminContestWhitelist(roomId, ids)
        await sendMarkdown(session, `## ✅ 白名单已更新\n房间 **${mdEscape(roomId)}** 共 **${ids.length}** 位用户\n\n${ids.join('、')}`, [
          adminBtn('查看房间', `${prefix} admin room ${roomId}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 操作失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  contest
    .subcommand('.start <roomId:string>', '手动开始比赛（全员 ready 时）')
    .action(async ({ session }: any, roomId?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!roomId) await sendMarkdown(session, '## ⚠️ 请输入房间 ID 喵～', [], runtime.qqMarkdown)
      if (!roomId) return

      try {
        await api.adminContestStart(roomId, false)
        await sendMarkdown(session, `## ✅ 比赛已开始\n房间 **${mdEscape(roomId)}** 比赛开始喵～`, [
          adminBtn('查看房间', `${prefix} admin room ${roomId}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 开始失败\n${(error as Error).message}`, [
          adminBtn('强制开始', `${prefix} contest forcestart ${roomId}`, 0),
        ], runtime.qqMarkdown)
        return
      }
    })

  contest
    .subcommand('.forcestart <roomId:string>', '强制开始比赛（忽略未准备玩家）')
    .action(async ({ session }: any, roomId?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!roomId) await sendMarkdown(session, '## ⚠️ 请输入房间 ID 喵～', [], runtime.qqMarkdown)
      if (!roomId) return

      try {
        await api.adminContestStart(roomId, true)
        await sendMarkdown(session, `## ✅ 已强制开始比赛\n房间 **${mdEscape(roomId)}** 喵～`, [
          adminBtn('查看房间', `${prefix} admin room ${roomId}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 操作失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })
}
