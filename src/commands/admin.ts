import { AdminRoom } from '../types'
import { formatAdminRoomCard, formatAdminRoomDetail, formatRecentLogs, formatTimestamp, isPageNum, paginate } from '../format'
import { adminBtn, adminPaginationBtns, mdCode, mdEscape, sendMarkdown } from '../qqrender'
import { CommandRuntime, parseOnOff, requireAdmin } from './shared'

export function registerAdminCommand(parent: any, runtime: CommandRuntime): void {
  const { api, prefix, pageSize } = runtime
  const admin = parent.subcommand('.admin', '管理员操作（需要 adminToken）')

  admin.action(async ({ session }: any) => {
    const authError = requireAdmin(api)
    if (authError) {
      await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      return
    }

    await sendMarkdown(session, [
      '## 🔐 Phira 管理员菜单',
      '**房间管理**',
      `> · ${prefix} admin room：管理员房间列表`,
      `> · ${prefix} admin user <用户ID>：查询用户`,
      `> · ${prefix} admin chat <房间ID> <消息>：房间消息`,
      '**用户操作**',
      `> · ${prefix} admin ban/unban/kick <用户ID>`,
      `> · ${prefix} admin move <用户ID> <房间ID>`,
      '**服务器开关**',
      `> · ${prefix} admin replay on|off`,
      `> · ${prefix} admin roomcreate on|off`,
      '**其他**',
      `> · ${prefix} admin ip list：查看 IP 黑名单`,
      `> · ${prefix} admin lograte：查看日志速率`,
    ].join('\n'), [
      adminBtn('🏠 房间管理', `${prefix} admin room`),
      adminBtn('👤 查用户', `${prefix} admin user `, 0, false),
      adminBtn('📢 广播', `${prefix} admin broadcast `, 0, false),
      adminBtn('🚫 IP 黑名单', `${prefix} admin ip list`, 0),
      adminBtn('🏁 比赛菜单', `${prefix} contest`, 0),
    ], runtime.qqMarkdown)
    return
  })

  admin
    .subcommand('.room [query:string]', '查看管理员房间列表或详情')
    .action(async ({ session }: any, query?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return

      try {
        const result = await api.adminGetRooms()
        const rooms: AdminRoom[] = result.rooms ?? []

        if (query && !isPageNum(query)) {
          const room = rooms.find((item) => item.roomid.toLowerCase() === query.toLowerCase())
          if (!room) {
            await sendMarkdown(session, `## ❌ 找不到房间\n房间 **${mdEscape(query)}** 不存在喵～`, [
              adminBtn('管理员房间列表', `${prefix} admin room`),
            ], runtime.qqMarkdown)
            return
          }

          const logs = formatRecentLogs(room.recent_logs)
          const markdown = [formatAdminRoomDetail(room), logs].filter(Boolean).join('\n\n')
          await sendMarkdown(session, markdown, [
            adminBtn('🔄 刷新', `${prefix} admin room ${room.roomid}`),
            adminBtn('💬 发消息', `${prefix} admin chat ${room.roomid} `, 0, false),
            adminBtn('👥 上限', `${prefix} admin maxusers ${room.roomid} `, 0, false),
            adminBtn('🧨 解散', `${prefix} admin disband ${room.roomid}`, 0),
            adminBtn('🏁 比赛', `${prefix} contest enable ${room.roomid}`, 0),
          ], runtime.qqMarkdown)
          return
        }

        if (!rooms.length) {
          await sendMarkdown(session, '## 🔐 管理员房间列表\n当前没有任何房间喵～', [
            adminBtn('🔄 刷新', `${prefix} admin room`),
          ], runtime.qqMarkdown)
          return
        }

        const page = isPageNum(query) ? Number(query) : 1
        const paged = paginate(rooms, page, pageSize)
        const cards = paged.items
          .map((room, index) => formatAdminRoomCard(room, (paged.page - 1) * pageSize + index + 1))
          .join('\n\n')
        const markdown = `## 🔐 管理员房间列表\n共 **${paged.total}** 个房间　第 **${paged.page}/${paged.totalPages}** 页\n\n${cards}`
        const roomButtons = paged.items.slice(0, 3).map((room) => adminBtn(`🔍 ${room.roomid}`, `${prefix} admin room ${room.roomid}`, 0))

        await sendMarkdown(session, markdown, [
          ...adminPaginationBtns(prefix, 'admin room', paged.page, paged.totalPages),
          adminBtn('🔄 刷新', `${prefix} admin room ${paged.page}`),
          adminBtn('📊 状态', `${prefix} status`, 0),
          ...roomButtons,
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 查询失败\n${(error as Error).message}`, [
          adminBtn('重试', `${prefix} admin room`),
        ], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.user <userId:posint>', '查询用户所在房间')
    .action(async ({ session }: any, userId?: number) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!userId) await sendMarkdown(session, '## ⚠️ 请输入用户 ID 喵～', [], runtime.qqMarkdown)
      if (!userId) return

      try {
        const result = await api.adminGetUser(userId)
        const user = result.user
        const markdown = [
          '## 👤 用户信息',
          `**ID**　${mdCode(user.id)}`,
          `**名称**　${mdEscape(user.name)}${user.monitor ? '（观察者）' : ''}`,
          `**状态**　${user.connected ? '🟢 在线' : '🔴 离线'}${user.banned ? '　⛔ 已封禁' : ''}`,
          `**所在房间**　${user.room ? mdEscape(user.room) : '无'}`,
        ].join('\n')
        const buttons = [adminBtn('🔄 刷新', `${prefix} admin user ${userId}`)]
        if (user.room) buttons.push(adminBtn('查看房间', `${prefix} admin room ${user.room}`, 0))
        buttons.push(adminBtn('踢出', `${prefix} admin kick ${userId}`, 0))
        buttons.push(adminBtn(user.banned ? '解封' : '封禁', `${prefix} admin ${user.banned ? 'unban' : 'ban'} ${userId}`, 0))
        await sendMarkdown(session, markdown, buttons, runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 查询失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.broadcast <message:text>', '全服广播消息')
    .alias('广播')
    .action(async ({ session }: any, message?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!message) await sendMarkdown(session, '## ⚠️ 请输入广播消息喵～', [], runtime.qqMarkdown)
      if (!message) return
      try {
        const result = await api.adminBroadcast(message)
        await sendMarkdown(session, `## ✅ 广播成功\n已发送到 **${result.rooms}** 个房间喵～\n\n> ${mdEscape(message)}`, [
          adminBtn('房间列表', `${prefix} admin room`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 广播失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.chat <roomId:string> <message:text>', '向指定房间发送消息')
    .action(async ({ session }: any, roomId?: string, message?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!roomId || !message) await sendMarkdown(session, '## ⚠️ 用法：`phira admin chat <房间ID> <消息>`', [], runtime.qqMarkdown)
      if (!roomId || !message) return
      try {
        await api.adminRoomChat(roomId, message)
        await sendMarkdown(session, `## ✅ 发送成功\n已向房间 **${mdEscape(roomId)}** 发送：\n\n> ${mdEscape(message)}`, [
          adminBtn('查看房间', `${prefix} admin room ${roomId}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 发送失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.ban <userId:posint>', '封禁玩家')
    .option('disconnect', '-d 同时强制断线')
    .action(async ({ session, options }: any, userId?: number) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!userId) await sendMarkdown(session, '## ⚠️ 请输入用户 ID 喵～', [], runtime.qqMarkdown)
      if (!userId) return
      try {
        await api.adminBanUser(userId, true, Boolean(options?.disconnect))
        await sendMarkdown(session, `## ✅ 已封禁用户\n用户 ID：${mdCode(userId)}${options?.disconnect ? '\n已同时强制断线。' : ''}`, [
          adminBtn('解封', `${prefix} admin unban ${userId}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 封禁失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.unban <userId:posint>', '解封玩家')
    .action(async ({ session }: any, userId?: number) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!userId) await sendMarkdown(session, '## ⚠️ 请输入用户 ID 喵～', [], runtime.qqMarkdown)
      if (!userId) return
      try {
        await api.adminBanUser(userId, false)
        await sendMarkdown(session, `## ✅ 已解封用户\n用户 ID：${mdCode(userId)}`, [
          adminBtn('查看用户', `${prefix} admin user ${userId}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 解封失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.kick <userId:posint>', '强制断线玩家')
    .action(async ({ session }: any, userId?: number) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!userId) await sendMarkdown(session, '## ⚠️ 请输入用户 ID 喵～', [], runtime.qqMarkdown)
      if (!userId) return
      try {
        await api.adminDisconnectUser(userId)
        await sendMarkdown(session, `## ✅ 已踢出用户\n用户 ID：${mdCode(userId)}`, [
          adminBtn('查看用户', `${prefix} admin user ${userId}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 操作失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.disband <roomId:string>', '解散指定房间')
    .action(async ({ session }: any, roomId?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!roomId) await sendMarkdown(session, '## ⚠️ 请输入房间 ID 喵～', [], runtime.qqMarkdown)
      if (!roomId) return
      try {
        await api.adminDisbandRoom(roomId)
        await sendMarkdown(session, `## ✅ 已解散房间\n房间 **${mdEscape(roomId)}** 已解散喵～`, [
          adminBtn('管理员房间列表', `${prefix} admin room`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 解散失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.maxusers <roomId:string> <maxUsers:posint>', '修改房间人数上限（1~64）')
    .action(async ({ session }: any, roomId?: string, maxUsers?: number) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!roomId || !maxUsers || maxUsers < 1 || maxUsers > 64) {
        await sendMarkdown(session, '## ⚠️ 用法：`phira admin maxusers <房间ID> <1~64>`', [], runtime.qqMarkdown)
        return
      }
      try {
        await api.adminSetMaxUsers(roomId, maxUsers)
        await sendMarkdown(session, `## ✅ 人数上限已更新\n房间 **${mdEscape(roomId)}** 上限：**${maxUsers}** 人`, [
          adminBtn('查看房间', `${prefix} admin room ${roomId}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 设置失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.replay <action:string>', '开启/关闭回放录制（on/off）')
    .action(async ({ session }: any, action?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      const enabled = parseOnOff(action)
      if (enabled === null) await sendMarkdown(session, '## ⚠️ 请输入 `on` 或 `off` 喵～', [], runtime.qqMarkdown)
      if (enabled === null) return
      try {
        const result = await api.adminSetReplay(enabled)
        await sendMarkdown(session, `## ✅ 回放录制已${result.enabled ? '开启' : '关闭'}`, [
          adminBtn(result.enabled ? '关闭录制' : '开启录制', `${prefix} admin replay ${result.enabled ? 'off' : 'on'}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 操作失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.roomcreate <action:string>', '开启/关闭房间创建（on/off）')
    .action(async ({ session }: any, action?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      const enabled = parseOnOff(action)
      if (enabled === null) await sendMarkdown(session, '## ⚠️ 请输入 `on` 或 `off` 喵～', [], runtime.qqMarkdown)
      if (enabled === null) return
      try {
        const result = await api.adminSetRoomCreation(enabled)
        await sendMarkdown(session, `## ✅ 房间创建已${result.enabled ? '开放' : '关闭'}`, [
          adminBtn(result.enabled ? '关闭创建' : '开放创建', `${prefix} admin roomcreate ${result.enabled ? 'off' : 'on'}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 操作失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.move <userId:posint> <roomId:string>', '将玩家转移到指定房间')
    .option('monitor', '-m 作为观察者加入')
    .action(async ({ session, options }: any, userId?: number, roomId?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!userId || !roomId) await sendMarkdown(session, '## ⚠️ 用法：`phira admin move <用户ID> <房间ID>`', [], runtime.qqMarkdown)
      if (!userId || !roomId) return
      try {
        await api.adminMoveUser(userId, roomId, Boolean(options?.monitor))
        await sendMarkdown(session, `## ✅ 已转移用户\n用户 ${mdCode(userId)} → 房间 **${mdEscape(roomId)}**${options?.monitor ? '（观察者）' : ''}`, [
          adminBtn('查看房间', `${prefix} admin room ${roomId}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 转移失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.banroom <userId:posint> <roomId:string>', '禁止玩家进入指定房间')
    .action(async ({ session }: any, userId?: number, roomId?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!userId || !roomId) await sendMarkdown(session, '## ⚠️ 用法：`phira admin banroom <用户ID> <房间ID>`', [], runtime.qqMarkdown)
      if (!userId || !roomId) return
      try {
        await api.adminBanRoom(userId, roomId, true)
        await sendMarkdown(session, `## ✅ 已设置房间禁入\n用户 ${mdCode(userId)} 不能进入房间 **${mdEscape(roomId)}**`, [
          adminBtn('解除禁入', `${prefix} admin unbanroom ${userId} ${roomId}`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 操作失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.unbanroom <userId:posint> <roomId:string>', '解除玩家对指定房间的禁入')
    .action(async ({ session }: any, userId?: number, roomId?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!userId || !roomId) await sendMarkdown(session, '## ⚠️ 用法：`phira admin unbanroom <用户ID> <房间ID>`', [], runtime.qqMarkdown)
      if (!userId || !roomId) return
      try {
        await api.adminBanRoom(userId, roomId, false)
        await sendMarkdown(session, `## ✅ 已解除房间禁入\n用户 ${mdCode(userId)} 可进入房间 **${mdEscape(roomId)}**`, [], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 操作失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  const ip = admin.subcommand('.ip', 'IP 黑名单管理')

  ip.subcommand('.list', '查看 IP 黑名单')
    .action(async ({ session }: any) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      try {
        const result = await api.adminGetIpBlacklist()
        if (!result.blacklist?.length) await sendMarkdown(session, '## 🚫 IP 黑名单\n当前为空喵～', [], runtime.qqMarkdown)
        if (!result.blacklist?.length) return
        const lines = result.blacklist.map((item) => `> · ${mdEscape(item.ip)}　剩余 ${Math.ceil(item.expiresIn / 60_000)} 分钟`)
        await sendMarkdown(session, ['## 🚫 IP 黑名单', ...lines].join('\n'), [
          adminBtn('清空黑名单', `${prefix} admin ip clear`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 查询失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  ip.subcommand('.remove <ip:string>', '移除指定 IP 黑名单')
    .action(async ({ session }: any, ipAddress?: string) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      if (!ipAddress) await sendMarkdown(session, '## ⚠️ 请输入 IP 地址喵～', [], runtime.qqMarkdown)
      if (!ipAddress) return
      try {
        await api.adminRemoveIpBlacklist(ipAddress)
        await sendMarkdown(session, `## ✅ 已移除 IP 黑名单\n${mdEscape(ipAddress)}`, [
          adminBtn('查看黑名单', `${prefix} admin ip list`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 操作失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  ip.subcommand('.clear', '清空 IP 黑名单')
    .action(async ({ session }: any) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      try {
        await api.adminClearIpBlacklist()
        await sendMarkdown(session, '## ✅ 已清空 IP 黑名单', [], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 操作失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })

  admin
    .subcommand('.lograte', '查看当前日志速率')
    .action(async ({ session }: any) => {
      const authError = requireAdmin(api)
      if (authError) await sendMarkdown(session, `## ❌ 权限不足\n${authError}`, [], runtime.qqMarkdown)
      if (authError) return
      try {
        const result = await api.adminGetLogRate()
        await sendMarkdown(session, `## 📊 日志速率\n当前最高日志速率：**${result.rate.toFixed(2)}** 条/秒\n\n更新时间：${formatTimestamp(Date.now())}`, [], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 查询失败\n${(error as Error).message}`, [], runtime.qqMarkdown)
        return
      }
    })
}
