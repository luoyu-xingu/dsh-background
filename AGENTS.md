# AGENTS.md

本仓库是 **dsh-background** —— 一个 DeepSeek Harness (dsh) Web 插件:
在 Web 界面「设置 → 通用设置 → 外观」中提供「背景图片」行,填写本地图片
文件的绝对路径即可把该图片设为网页背景(cover 填充),并提供 180×88 的
实时预览。本文件是给在此仓库工作的编码代理的指令与背景知识。

## 仓库结构

```
.
├── AGENTS.md                  # 本文件
├── .gitignore
├── LICENSE                    # MIT
├── package.json               # dsh.bundle.patch + dsh.client 清单
├── cordis.patch.yml           # 向配置树插入 background 条目
├── lib\
│   ├── index.js               # 宿主端(Node):settings 注册 + 图片路由 + 配置 RPC + 启动注入
│   └── client.js              # 客户端(浏览器):外观设置行 + 预览 + 背景应用
├── smoke-test.mjs             # 宿主端烟雾测试
├── client-smoke.mjs           # 客户端 bundle 结构测试
└── README.md                  # 用户文档
```

## 常用命令

```bash
# 语法检查与单元级测试(在仓库根目录执行)
node --check lib/index.js
node --check lib/client.js
node smoke-test.mjs
node client-smoke.mjs

# 安装 / 重装到 web profile(修改插件源码后必须重装,file: 安装是快照)
dsh plugin --profile web remove dsh-background
dsh plugin --profile web add file:.

# 端到端验证:另起一个诊断端口(勿动用户正在运行的实例)
dsh web --port 3091

# 配置树组合检查
dsh --profile web --dump-config
```

## 架构要点(改代码前必读)

- **双端结构**:宿主端 `lib/index.js` 导出 `apply(ctx)`(cordis 插件),客户端
  `lib/client.js` 是浏览器 bundle,必须以
  `window.__ModuleLoader__.load({ id: "dsh-background", factory: (require) => … })`
  的格式编写,模块 id **必须等于包名**;客户端可 `require` 的内置种子:
  `react`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-runtime/client` 等。
- **设置通道**:当前 dsh 版本 (0.1.0-rc.6) 的 settings 网关只对硬编码白名单
  (api-proxy 的 `WEB_SETTINGS_NAMESPACES`) 开放,第三方命名空间读写会被
  `settings-not-exposed` 拒绝。因此**不要**用 `ctx.settingsScope` 给浏览器端
  读写本插件配置;正确做法是宿主端 `ctx.connection.rpc.handle("/dsh-background",
  handler, {})` 注册自定义通道 + 进程内 `scope.replace({path})` 持久化
  (settings.yaml 的 `ui-background` 段),客户端 `ctx.connection.rpc.call` 调用。
  注意:`rpc.handle` 的第三个参数 options **必须传**(至少 `{}`),否则运行时报
  `Cannot read properties of undefined (reading 'authority')`。
- **图片加载**:浏览器无法直接加载本地文件路径。宿主端用
  `ctx.inject(["webServer"])` 注册前缀路由 `/dsh-background/image`,按当前
  配置 stat + 流式读取本地文件,以扩展名映射 content-type、`cache-control: no-store`
  返回;支持 jpg/jpeg/png/gif/webp/avif/svg/bmp/ico,单文件上限 25MB。
- **背景应用**:用覆盖 body 上别名令牌的方式实现——
  `--dsw-alias-bg-base` 指向 `url("/dsh-background/image?v=<rev>") center / cover
  no-repeat fixed` 加明暗主题兜底色,应用框架的背景读这个令牌,因此与主题系统
  天然兼容。客户端修改 style 元素文本 + 设置 `html[data-dsh-background]` 属性;
  宿主端 `webServer.tapIndex` 在 index.html `<head>` 注入同样的样式,保证刷新
  首帧无默认背景闪烁。**两侧的 CSS 构建逻辑必须保持一致**。
- **产品决定(用户明确要求,勿恢复)**:没有拖拽换背景;没有"背景覆盖侧边栏"
  开关;填充方式固定 cover,无 contain/tile 选项。
- **插件装配**:`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`
  (插入 `- id: background / name: dsh-background` 条目);`dsh.client` 声明
  `platform: "web"`、`immediately: true` 及模块注入列表。宿主端依赖
  (`@deepseek-ai/dsh-settings`、`@deepseek-ai/schemastery` 等)声明为
  peerDependencies,运行时经 `$DSH_HOME/profiles/node_modules` 的 healed 链接
  解析,无需随包安装。

## 修改流程

1. 修改 `lib/*`;运行上述 `node --check` 与两个烟雾测试。
2. `dsh plugin --profile web remove dsh-background` 后重新 `add file:...`
   (file: 安装是快照,remove+add 才能刷新副本)。
3. 起 `dsh web --port 3091` 诊断实例,用以下协议做端到端验证:
   - `POST /dsh-background/config`,`{"type":"client-request","rpcId":"x","method":"config","payload":{"op":"get"|"set"}}`;
   - `GET /dsh-background/image`(200 + 正确 content-type 与字节);
   - `GET /`(index.html `<head>` 里有 `data-plugin="dsh-background"` 的启动样式);
   - `GET /plugins/dsh-background/client.js`(200)。
4. 验证完成后杀掉诊断实例;**不要动用户正在运行的实例**;提醒用户
   重启 `dsh web` 使插件生效(插件清单在进程启动时扫描,进程级缓存)。

## 环境注意事项

- 本机 `node_modules/` 下指向 dsh 安装目录的 Junction(供烟雾测试解析
  `@deepseek-ai/dsh-settings`、`@deepseek-ai/schemastery` 依赖)仅存在于
  本地,已被 .gitignore 排除,不要提交。
- 诊断实例与用户实例共享同一份 `$DSH_HOME/settings.yaml`,测试写入后
  注意把 `ui-background` 段恢复为未配置状态(无默认背景)。

