# dsh-background

DeepSeek Harness Web 背景图片插件:在 **设置 → 通用设置 → 外观** 的
「背景图片」行填写**本地图片文件的绝对路径**(如
`C:\Users\<user>\Desktop\example.jpg`),即可把该图片设为网页背景,
并提供与默认「外观」控件同尺寸(180 × 88,圆角 16px)的实时预览。

## 功能

- **本地路径**:输入本地图片文件的绝对路径(支持空格等特殊字符),
  回车或失焦生效。图片由宿主端通过 `/dsh-background/image` 路由提供给
  浏览器——浏览器本身无法直接加载 `file://` 或裸路径。
- **填充方式**:填充(cover)/ 适应(contain)/ 平铺(tile),即时切换。
- **背景覆盖侧边栏**:开关控制侧边栏是否透明,让图片整体可见。
- **实时预览**:预览框尺寸参照默认外观主题立方体(180 × 88);输入框
  聚焦时预览跟随输入实时变化;文件不存在或无法读取时显示提示。
- **持久化**:配置保存到用户设置文档(`$DSH_HOME/settings.yaml` 的
  `ui-background` 段),刷新、重启后自动恢复;启动期由宿主端在
  index.html 中先行注入,无默认背景闪烁。
- **跟随明暗主题**:背景图不变,兜底色自动跟随浅色/深色静态色板。
- **支持格式**:jpg / jpeg / png / gif / webp / avif / svg / bmp / ico,
  单个文件上限 25MB。

## 实现原理

- 宿主端(`lib/index.js`):
  - 通过 `ctx.settings.register` 注册 `ui-background` 命名空间
    (path / fit / sidebar),作为进程内持久化通道;
  - `webServer.register` 注册图片路由 `/dsh-background/image`,按当前
    配置读取本地文件并以正确的 content-type 提供;
  - `webServer.tapIndex` 注入启动期背景样式与 `data-dsh-background`
    属性,页面首帧即是自定义背景;
  - `connection.rpc.handle` 注册配置通道 `/dsh-background/config`
    (get / set),供浏览器端读写。
- 客户端(`lib/client.js`):
  - 向 `settings.general.item` 插槽注册外观行(参照内置 ui-theme 的
    AppearanceRow 模式);
  - 通过 `ctx.connection.rpc.call` 读写配置;
  - 用覆盖 body 上 `--dsw-alias-bg-base` / `--dsw-specific-sidebar-fill`
    别名令牌的方式应用背景——与主题系统、明暗模式天然兼容。

> 为什么不直接用 settingsScope?当前版本(dsh 0.1.0-rc.6)的 settings
> 网关只对硬编码白名单内的命名空间开放浏览器读写,第三方插件注册的
> 命名空间会收到 `settings-not-exposed` 拒绝;自定义 RPC 通道是官方
> 开放给插件的等价通道。

## 安装

```bash
# 本地目录安装
dsh plugin --profile web add file:E:\dsh-background

# 若发布到 npm:
dsh plugin --profile web add dsh-background
```

安装完成后**重启 `dsh web`**,刷新页面即可在「设置 → 通用设置 → 外观」
看到「背景图片」行。

修改插件源码后需重新安装并重启:

```bash
dsh plugin --profile web add file:E:\dsh-background
```

## 使用

1. 打开 **设置 → 通用设置**,在外观下方找到「背景图片」;
2. 在输入框粘贴本地图片路径(例如
   `C:\Users\<user>\Desktop\example.jpg`),
   按回车或点击其它位置生效;
3. 选择填充方式、开关侧边栏覆盖,预览框实时反映;
4. 点击「清除背景」恢复默认外观。

## 卸载

```bash
dsh plugin --profile web remove dsh-background
```

并在 `settings.yaml` 中删除 `ui-background` 段即可清空背景设置。

## 测试

```bash
node smoke-test.mjs      # 宿主端:schema / 路径清洗 / 背景 CSS 构建
node client-smoke.mjs    # 客户端 bundle:模块注册 / 插槽注入 / RPC 调用路径
```
