import { AdminRoom, AdminRoomState, PublicRoom, RoomState } from './types'
import { mdCode, mdEscape } from './qqrender'

export function formatState(state: RoomState | AdminRoomState): string {
  const type = typeof state === 'string' ? state : state.type
  switch (type) {
    case 'select_chart': return '🎵 选歌中'
    case 'waiting_for_ready': return '⏳ 等待准备'
    case 'playing': return '🎮 游戏中'
    default: return mdEscape(type)
  }
}

export function roomLocked(room: PublicRoom): boolean {
  return Boolean(room.lock ?? room.locked)
}

export function formatPublicRoomCard(room: PublicRoom, index: number): string {
  const lock = roomLocked(room) ? '🔒' : '🔓'
  const cycle = room.cycle ? ' 🔁' : ''
  const chartName = room.chart ? mdEscape(room.chart.name) : '未选歌'
  return [
    `**${index}. ${lock}${cycle} ${mdEscape(room.roomid)}**`,
    `> 房主：${mdEscape(room.host.name)}　状态：${formatState(room.state)}`,
    `> 谱面：${chartName}　人数：${room.players?.length ?? 0}`,
  ].join('\n')
}

export function formatPublicRoomDetail(room: PublicRoom): string {
  const lock = roomLocked(room) ? '🔒 已锁定' : '🔓 未锁定'
  const cycle = room.cycle ? '🔁 循环' : '普通模式'
  const chartName = room.chart ? `${mdEscape(room.chart.name)}（ID: ${mdCode(room.chart.id)}）` : '未选歌'
  const players = room.players?.length
    ? room.players.map((p) => `> · ${mdEscape(p.name)}（ID: ${mdCode(p.id)}）`).join('\n')
    : '> 暂无玩家'

  return [
    `## 🎮 房间 ${mdEscape(room.roomid)}`,
    `**状态**　${formatState(room.state)}`,
    `**房主**　${mdEscape(room.host.name)}（ID: ${mdCode(room.host.id)}）`,
    `**谱面**　${chartName}`,
    `**模式**　${lock}　${cycle}`,
    `**玩家**（${room.players?.length ?? 0} 人）`,
    players,
  ].join('\n')
}

export function formatAdminRoomCard(room: AdminRoom, index: number): string {
  const lock = room.locked ? '🔒' : '🔓'
  const cycle = room.cycle ? ' 🔁' : ''
  const live = room.live ? ' 📡' : ''
  const chartName = room.chart ? mdEscape(room.chart.name) : '未选歌'
  const offlineCount = room.users.filter((u) => !u.connected).length
  const offlineStr = offlineCount ? `（${offlineCount} 离线）` : ''
  return [
    `**${index}. ${lock}${cycle}${live} ${mdEscape(room.roomid)}**`,
    `> 状态：${formatState(room.state)}　房主：${mdEscape(room.host.name)}`,
    `> 谱面：${chartName}　人数：${room.users.length}/${room.max_users}${offlineStr}`,
  ].join('\n')
}

export function formatAdminRoomDetail(room: AdminRoom): string {
  const lock = room.locked ? '🔒 已锁定' : '🔓 未锁定'
  const cycle = room.cycle ? '🔁 循环' : '普通'
  const live = room.live ? '　📡 直播中' : ''
  const chartName = room.chart ? `${mdEscape(room.chart.name)}（ID: ${mdCode(room.chart.id)}）` : '未选歌'
  let stateExtra = ''

  if (room.state.type === 'playing') {
    stateExtra = `　完成: ${room.state.results_count} | 中止: ${room.state.aborted_count}`
  } else if (room.state.type === 'waiting_for_ready') {
    stateExtra = `　已准备: ${room.state.ready_count ?? 0}/${room.users.length}`
  }

  const users = room.users.length
    ? room.users.map((u) => {
      const tags: string[] = []
      if (u.is_host) tags.push('房主')
      if (!u.connected) tags.push('离线')
      if (u.finished) tags.push('✅完成')
      if (u.aborted) tags.push('❌放弃')
      const tagText = tags.length ? ` [${tags.join('/')}]` : ''
      return `> · ${mdEscape(u.name)}（ID: ${mdCode(u.id)}）${mdEscape(tagText)}`
    }).join('\n')
    : '> 暂无玩家'

  const monitors = room.monitors.length
    ? ['**👁 观察者**', ...room.monitors.map((m) => `> · ${mdEscape(m.name)}（ID: ${mdCode(m.id)}）`)].join('\n')
    : ''

  const contest = room.contest
    ? [
      '**🏁 比赛模式**',
      `> 白名单人数：${room.contest.whitelist_count}`,
      `> 手动开始：${room.contest.manual_start ? '是' : '否'}　自动解散：${room.contest.auto_disband ? '是' : '否'}`,
    ].join('\n')
    : ''

  return [
    `## 🔐 房间 ${mdEscape(room.roomid)}${live}`,
    `**状态**　${formatState(room.state)}${stateExtra}`,
    `**房主**　${mdEscape(room.host.name)}（ID: ${mdCode(room.host.id)}）${room.host.connected === false ? ' [离线]' : ''}`,
    `**谱面**　${chartName}`,
    `**模式**　${lock}　${cycle}　上限 ${room.max_users} 人`,
    `**玩家**（${room.users.length} 人）`,
    users,
    monitors,
    contest,
  ].filter(Boolean).join('\n')
}

export function formatRecentLogs(logs: Array<{ message: string; timestamp: number }> = []): string {
  if (!logs.length) return ''
  const lines = logs.slice(-10).map((log) => `> ${formatTimestamp(log.timestamp)}　${mdEscape(log.message)}`)
  return ['**📝 最近日志**', ...lines].join('\n')
}

export function formatTimestamp(timestamp: number): string {
  const date = timestamp < 10_000_000_000 ? new Date(timestamp * 1000) : new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total,
    totalPages,
    page: safePage,
  }
}

export function isPageNum(value: string | undefined): boolean {
  return Boolean(value && /^\d+$/.test(value))
}

export function parseUserIds(values: unknown[]): number[] {
  return values
    .flatMap((value) => String(value ?? '').split(/[,，\s]+/))
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
}
