# 项目结构说明

## 目录结构

```
frontend/
├── public/                  # 静态资源目录
│   └── vite.svg            # Vite 图标
│
├── src/                     # 源代码目录
│   ├── components/          # React 组件
│   │   ├── ComplianceReport.tsx  # 合规报告组件
│   │   ├── Header.tsx           # 头部导航组件
│   │   ├── Sidebar.tsx          # 侧边栏组件
│   │   └── UploadZone.tsx       # 文件上传组件
│   │
│   ├── constants/           # 常量定义
│   │   └── index.tsx        # 导出所有常量（STATUS_LABELS, MOCK_CHECKLIST 等）
│   │
│   ├── types/               # 类型定义
│   │   └── index.ts         # 导出所有类型（CheckStatus, InspectionReport 等）
│   │
│   ├── hooks/               # 自定义 React Hooks（待扩展）
│   │
│   ├── utils/               # 工具函数（待扩展）
│   │
│   ├── pages/               # 页面组件（待扩展）
│   │
│   ├── assets/              # 静态资源（图片、字体等，待扩展）
│   │
│   ├── App.tsx              # 主应用组件
│   └── main.tsx             # 应用入口文件
│
├── index.html               # HTML 模板文件
├── package.json             # NPM 包配置
├── tsconfig.json            # TypeScript 配置
├── vite.config.ts           # Vite 构建工具配置
└── pnpm-lock.yaml           # PNPM 锁文件
```

## 架构改进

### 1. 清晰的目录分层
- **src/**: 所有源代码统一管理
- **components/**: 可复用的 UI 组件
- **constants/**: 常量数据集中管理
- **types/**: TypeScript 类型定义统一管理
- **public/**: 静态资源目录

### 2. 导入路径优化
- 使用相对路径或别名路径（@/*）导入
- 所有模块都有明确的入口文件（index.ts）

### 3. 符合主流开源项目标准
- React + Vite 标准结构
- TypeScript 严格模式
- 组件化开发
- 关注点分离

## 核心文件说明

### src/main.tsx
应用的入口文件，负责：
- 引入 React 和 ReactDOM
- 渲染 App 组件到 DOM
- 启用 React.StrictMode

### src/App.tsx
主应用组件，包含：
- 状态管理（phase, darkMode, analysisLogs 等）
- 业务逻辑（handleStartAnalysis, reset 等）
- UI 渲染（NavBar, Footer, 主要内容区域）

### src/components/
可复用的 UI 组件：
- UploadZone: 文件上传交互
- ComplianceReport: 审计报告展示
- Header: 导航栏
- Sidebar: 侧边栏

### src/constants/index.tsx
常量数据，包括：
- STATUS_LABELS: 状态标签
- STATUS_ICONS: 状态图标
- CATEGORY_ICONS: 分类图标
- MOCK_CHECKLIST: 模拟检查清单
- MOCK_FILES: 模拟文件结构

### src/types/index.ts
TypeScript 类型定义：
- CheckStatus: 检查状态枚举
- FirmwareType: 固件类型枚举
- CheckItem: 检查项接口
- InspectionReport: 审计报告接口
- AnalysisSummary: 分析摘要接口

## 配置更新

### vite.config.ts
- 配置服务器端口为 3000
- 设置路径别名为 `@` 指向 `src/` 目录
- 配置环境变量（GEMINI_API_KEY）

### tsconfig.json
- TypeScript 编译配置
- 路径映射 `@/*` 映射到 `src/*`
- 支持 JSX 和最新 ES 特性

## 下一步扩展建议

1. **hooks/**: 添加自定义 React Hooks，如 useLocalStorage, useDarkMode 等
2. **utils/**: 添加工具函数，如 formatDate, validateFile 等
3. **pages/**: 如果需要多页面架构，可以创建页面组件
4. **assets/**: 添加图片、字体等静态资源

## 开发命令

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 预览生产版本
pnpm preview
```

## 优势

1. **更好的可维护性**: 代码分类清晰，易于定位和修改
2. **更好的可扩展性**: 新增功能时知道应该放在哪里
3. **更好的团队协作**: 统一的代码结构规范
4. **更好的开发体验**: IDE 自动补全和路径提示
5. **符合行业标准**: 遵循主流开源项目最佳实践