import { btn, mdCodeBlock, sendMarkdown } from '../qqrender'
import { CommandRuntime } from './shared'

export function registerStatusCommand(parent: any, runtime: CommandRuntime): void {
  const { api, prefix } = runtime

  parent
    .subcommand('.status', '查看服务器状态')
    .alias('状态')
    .action(async ({ session }: any) => {
      try {
        const [rooms, creation, replay] = await Promise.allSettled([
          api.getRooms(),
          api.getRoomCreationConfig(),
          api.getReplayConfig(),
        ])

        const roomCount = rooms.status === 'fulfilled' ? rooms.value.total : '获取失败'
        const creationStatus = creation.status === 'fulfilled'
          ? creation.value.enabled ? '✅ 开放' : '❌ 已关闭'
          : '获取失败'
        const replayStatus = replay.status === 'fulfilled'
          ? replay.value.enabled ? '✅ 录制中' : '⏹ 未录制'
          : '获取失败'

        const markdown = [
          '## 🖥 Phira 服务器状态',
          '**地址**',
          mdCodeBlock(runtime.displayServerUrl),
          `**当前房间数**　${roomCount}`,
          `**房间创建**　${creationStatus}`,
          `**回放录制**　${replayStatus}`,
          `**WebSocket**　${runtime.wsEnabled ? '✅ 已启用' : '⏹ 未启用'}`,
        ].join('\n')

        await sendMarkdown(session, markdown, [
          btn('🔄 刷新状态', `${prefix} status`),
          btn('🎵 房间列表', `${prefix} room`, 0),
        ], runtime.qqMarkdown)
        return
      } catch (error) {
        await sendMarkdown(session, `## ❌ 查询失败\n${(error as Error).message}`, [
          btn('重试', `${prefix} status`),
        ], runtime.qqMarkdown)
        return
      }
    })
}
