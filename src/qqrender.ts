import { h, Session } from 'koishi'
import { QQButton, QQKeyboard, QQRow } from './types'

export function mdEscape(value: unknown): string {
  return String(value ?? '').replace(/([\\`*_{}\[\]()#+\-!|>~])/g, '\\$1')
}

export function mdCode(value: unknown): string {
  return `\`${String(value ?? '').replace(/`/g, '\\`')}\``
}

export function mdCodeBlock(value: unknown, title = 'server'): string {
  const text = String(value ?? '').replace(/```/g, '`​``')
  const safeTitle = String(title ?? '').replace(/[\r\n`]/g, '').trim()
  return `\`\`\`${safeTitle}
${text}
\`\`\``
}

export function btn(
  label: string,
  data: string,
  style: 0 | 1 = 1,
  enter = true,
  permissionType: 0 | 1 | 2 | 3 = 2,
): QQButton {
  return {
    render_data: {
      label,
      visited_label: label,
      style,
    },
    action: {
      type: 2,
      permission: { type: permissionType },
      data,
      enter,
    },
  }
}

/**
 * QQ 按钮权限：permission.type = 1 表示仅 QQ 群管理员可点击。
 * 注意：这是 QQ 按钮层面的点击限制；用户手动输入命令时仍由 Koishi/插件权限逻辑处理。
 */
export function adminBtn(label: string, data: string, style: 0 | 1 = 1, enter = true): QQButton {
  return btn(label, data, style, enter, 1)
}

export function buildKeyboard(buttons: QQButton[] = []): QQKeyboard {
  const rows: QQRow[] = []
  for (let i = 0; i < buttons.length && rows.length < 5; i += 2) {
    rows.push({ buttons: buttons.slice(i, i + 2) })
  }
  return { content: { rows } }
}

export function qqMsg(markdown: string, buttons: QQButton[] = []) {
  return h('qq:rawmarkdown', {
    markdown: { content: markdown },
    keyboard: buildKeyboard(buttons),
  })
}

export async function sendMarkdown(
  session: Session | undefined,
  markdown: string,
  buttons: QQButton[] = [],
  qqMarkdown = true,
): Promise<void> {
  if (!session) return

  // 注意：session.send() 会返回消息 ID。
  // 命令 action 里大量使用 `return sendMarkdown(...)`，
  // 如果这里把 session.send() 的返回值继续 return，Koishi 会把消息 ID
  // 例如 `ROBOT1.0_xxx` 当作命令返回文本再发送出去。
  // 因此这里必须只负责发送，不向上返回任何内容。
  if (qqMarkdown) {
    await session.send(qqMsg(markdown, buttons))
    return
  }

  await session.send(markdown.replace(/^#{1,6}\s*/gm, '').replace(/\*\*/g, ''))
}

export function paginationBtns(
  prefix: string,
  subCmd: string,
  currentPage: number,
  totalPages: number,
  permissionType: 0 | 1 | 2 | 3 = 2,
): QQButton[] {
  const buttons: QQButton[] = []
  if (currentPage > 1) buttons.push(btn('⬅️ 上一页', `${prefix} ${subCmd} ${currentPage - 1}`, 0, true, permissionType))
  if (currentPage < totalPages) buttons.push(btn('➡️ 下一页', `${prefix} ${subCmd} ${currentPage + 1}`, 0, true, permissionType))
  return buttons
}

export function adminPaginationBtns(prefix: string, subCmd: string, currentPage: number, totalPages: number): QQButton[] {
  return paginationBtns(prefix, subCmd, currentPage, totalPages, 1)
}
