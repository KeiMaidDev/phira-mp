# koishi-plugin-phira-mp

[![npm](https://img.shields.io/npm/v/koishi-plugin-phira-mp?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-phira-mp)

Phira 联机服务器的 Koishi 插件，支持房间查询、实时监听与管理员操作。

## 指令一览

### 公开指令（无需 Token）

| 指令 | 说明 |
|------|------|
| `phira.rooms` | 查看所有活跃房间列表 |
| `phira.creation` | 查询房间创建开关状态 |
| `phira.watch <roomId>` | 订阅指定房间实时事件（需启用 wsEnabled） |
| `phira.unwatch` | 取消当前频道的房间监听 |

### 管理员指令（需配置 adminToken）

| 指令 | 说明 |
|------|------|
| `phira.room <roomId>` | 查看指定房间详细信息 |
| `phira.rooms.admin` | 查看所有房间详细信息（含日志） |
| `phira.user <userId>` | 查询玩家所在房间 |
| `phira.ban.user <userId> [-k]` | 封禁玩家，`-k` 同时踢出在线连接 |
| `phira.unban.user <userId>` | 解封玩家 |
| `phira.ban.room <userId> <roomId>` | 禁止玩家进入指定房间 |
| `phira.unban.room <userId> <roomId>` | 解除房间禁令 |
| `phira.kick <userId>` | 踢出玩家 |
| `phira.disband <roomId>` | 解散房间 |
| `phira.broadcast <message>` | 全服广播消息 |
| `phira.chat <roomId> <message>` | 向指定房间发送系统消息 |
| `phira.creation.on` | 开启房间创建功能 |
| `phira.creation.off` | 关闭房间创建功能 |
| `phira.maxusers <roomId> <n>` | 修改房间最大人数（1~64） |
| `phira.move <userId> <roomId> [-m]` | 转移断线玩家到指定房间，`-m` 以观战者身份 |
| `phira.ipblacklist` | 查看 IP 黑名单 |
| `phira.ipblacklist.remove <ip>` | 移除指定 IP 的黑名单 |
| `phira.ipblacklist.clear` | 清空 IP 黑名单 |

## WebSocket 实时监听

开启 `wsEnabled: true` 后，可在频道中使用 `phira.watch <roomId>` 订阅房间事件，机器人会实时推送：

- 📡 房间状态更新（玩家加入/离开、选歌、开始/结束）
- 💬 房间内聊天消息及系统事件日志

一个频道同时只能订阅一个房间，`phira.unwatch` 取消订阅。

## 服务器 API 说明

本插件对接 [tphira-mp](https://github.com/Pimeng/tphira-mp/) 提供的 HTTP/WebSocket API，
服务器需开启 `HTTP_SERVICE=true`，管理功能需配置 `ADMIN_TOKEN`。

