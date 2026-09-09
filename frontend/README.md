# 前端源码运行

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 9000
```

前端默认请求 `http://127.0.0.1:9001/api/v1`。后端位于其他地址时，在启动前设置：

```bash
VITE_API_BASE_URL=http://backend.example.internal:9001/api/v1 pnpm dev
```

构建静态资源：

```bash
pnpm build
```
