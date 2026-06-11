import { PublicRoom } from '../types'
import { btn, paginationBtns, sendMarkdown } from '../qqrender'
import { formatPublicRoomCard, formatPublicRoomDetail, isPageNum, paginate } from '../format'
import { CommandRuntime } from './shared'

export function registerRoomsCommand(parent: any, runtime: CommandRuntime): void {
  const { api, prefix, pageSize } = runtime

  parent
    .subcommand('.room [query:string]', '查看房间列表或指定房间详情')
    .alias('房间', '房间列表')
    .usage([
      `${prefix} room           查看房间列表`,
      `${prefix} room 2         查看第 2 页`,
      `${prefix} room ABC123    查看房间详情`,
    ].join('\n'))
    .action(async ({ session }: any, query?: string) => {
      try {
        const result = await api.getRooms()
        const rooms: PublicRoom[] = result.rooms ?? []

        if (query && !isPageNum(query)) {
          const room = rooms.find((item) => item.roomid.toLowerCase() === query.toLowerCase())
          if (!room) {
            await sendMarkdown(session, `## ❌ 找不到房间\n房间 **${query}** 不存在喵～`, [
              btn('查看列表', `${prefix} room`),
              btn('重试', `${prefix} room ${query}`, 0),
            ], runtime.qqMarkdown)
            return
          }

          const buttons = [
            btn('🔄 刷新', `${prefix} room ${room.roomid}`),
            btn('📋 返回列表', `${prefix} room`, 0),
          ]
          if (runtime.wsEnabled) buttons.push(btn('📡 订阅日志', `${prefix} watch ${room.roomid}`, 0))

          await sendMarkdown(session, formatPublicRoomDetail(room), buttons, runtime.qqMarkdown)
          return
        }

        if (!rooms.length) {
          await sendMarkdown(session, '## 🎵 Phira 房间列表\n当前没有任何房间喵～', [
            btn('🔄 刷新', `${prefix} room`),
            btn('📊 状态', `${prefix} status`, 0),
          ], runtime.qqMarkdown)
          return
        }

        const page = isPageNum(query) ? Number(query) : 1
        const paged = paginate(rooms, page, pageSize)
        const cards = paged.items
          .map((room, index) => formatPublicRoomCard(room, (paged.page - 1) * pageSize + index + 1))
          .join('\n\n')

        const markdown = `## 🎵 Phira 房间列表\n共 **${paged.total}** 个房间　第 **${paged.page}/${paged.totalPages}** 页\n\n${cards}`
        const roomButtons = paged.items.slice(0, 3).map((room) => btn(`🔍 ${room.roomid}`, `${prefix} room ${room.roomid}`, 0))

        await sendMarkdown(session, markdown, [
          ...paginationBtns(prefix, 'room', paged.page, paged.totalPages),
          btn('🔄 刷新', `${prefix} room ${paged.page}`),
          btn('📊 状态', `${prefix} status`, 0),
          ...roomButtons,
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 查询失败\n${(error as Error).message}`, [
          btn('重试', `${prefix} room`),
        ], runtime.qqMarkdown)
        return
      }
    })
}