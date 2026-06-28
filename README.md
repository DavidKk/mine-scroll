# 扫雷 Web 游戏

经典 Windows 风格扫雷 MVP（9×9 / 10 雷）。

包管理器：**pnpm**（见 `package.json` 的 `packageManager` 字段）。

## 开发

```bash
pnpm install
pnpm dev
```

## 文档

- `docs/PROJECT.md` — 迭代进度与 Current Task
- `docs/SPEC.md` — 游戏规则
- `docs/ARCHITECTURE.md` — 技术架构

## 构建

```bash
pnpm build
pnpm start
pnpm test
```

## Admin 认证

`/admin/*`（Asset Lab、UI Lab、Responsive Matrix）需要登录。

| 环境     | 方式                                                     |
| -------- | -------------------------------------------------------- |
| 生产     | Signet（`SIGNET_SDK_URL`）                               |
| 本地 dev | 可选 Signet + 可选 `ACCESS_USERNAME` / `ACCESS_PASSWORD` |

必需：`JWT_SECRET`、`JWT_EXPIRES_IN`。部署时在认证中心注册回调：

`https://<域名>/auth/vercel-2fa/callback`

详见 `.env.example`。
