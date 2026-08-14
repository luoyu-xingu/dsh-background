import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import z from "@deepseek-ai/schemastery";

/**
 * dsh-background — 宿主端一半:
 * 1. 在用户设置文档中注册 `ui-background` 命名空间(仅 path),
 *    作为进程内持久化通道(settings.yaml 的 `ui-background` 段);
 * 2. 注册图片路由 `/dsh-background/image`,把配置的本地图片文件以
 *    正确的 content-type 提供给浏览器(浏览器无法直接加载本地路径);
 * 3. 注册配置 RPC 通道 `/dsh-background`(endpoint `config`),供客户端
 *    插件读写背景配置。这里走 connection 服务的自定义通道,而不是
 *    settings 网关——当前版本的 settings 网关只对硬编码白名单内的
 *    命名空间开放,第三方插件的命名空间会被 `settings-not-exposed` 拒绝;
 * 4. 在 index.html 响应中注入启动期背景样式与属性,让背景在客户端插件
 *    激活前就完成绘制(避免刷新页面时闪现默认背景)。
 */

/** 设置命名空间(小写 kebab-case)。 */
const BACKGROUND_SETTINGS_NAMESPACE = settingsNamespace("ui-background");

/** 插件显示名(诊断信息中标识插件;与 cordis 教程及内置插件的惯例一致)。 */
export const name = "dsh-background";

/** 持久化背景设置:仅本地图片路径,空串表示无背景。 */
const BackgroundSettingsSchema = z.object({
  /** 本地图片文件的绝对路径。 */
  path: z.string().default("")
});

/** 图片路由支持的扩展名 → content-type。 */
const IMAGE_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon"
};

/** 图片文件大小上限(25MB),防止误配大文件拖垮服务器。 */
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/** 规范化用户输入的路径:去掉会破坏 YAML/CSS 的字符。 */
function cleanPath(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[\r\n"'<>]/g, "");
}

/** 归一化一份设置片段(容忍手改设置文档产生的脏数据)。 */
function normalizeSection(section) {
  return { path: cleanPath(section?.path ?? "") };
}

/**
 * 构建与客户端插件一致的背景样式文本:
 * 通过覆盖 body 上的别名令牌,把背景图(cover 填充)叠加进应用框架背景
 * (`background: var(--dsw-alias-bg-base)`)。图片之上按主题叠加一层半透明
 * 蒙层(浅色主题白蒙层 / 深色主题深蒙层),保证任意亮度的图片上应用文字
 * 依然可读——与社区皮肤插件修复 tooltip 可读性时"按主题配对覆盖"的思路
 * 一致,作用域限定在 `html[data-dsh-background]`,不影响默认外观。
 * 图片地址使用本插件的图片路由,浏览器由此加载本地文件。
 */
export function buildBackgroundCss(imageUrl) {
  const image = `url(${JSON.stringify(imageUrl)})`;
  const veilLight = "linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.6))";
  const veilDark = "linear-gradient(rgba(9, 11, 15, 0.58), rgba(9, 11, 15, 0.58))";
  const stack = (veil) => `${veil}, ${image} center / cover no-repeat fixed`;
  return [
    `html[data-dsh-background] body{--dsw-alias-bg-base:${stack(veilLight)}, var(--dsw-static-neutral-bluish-00);}`,
    `html[data-dsh-background] body[data-ds-dark-theme]{--dsw-alias-bg-base:${stack(veilDark)}, var(--dsw-static-neutral-bluish-950)}`
  ].join("\n");
}

/**
 * 把启动期背景注入到 index.html 的 <head>:
 * 一段静态 <style> 加一段设置 html[data-dsh-background] 属性的内联脚本,
 * 都在 body 解析之前生效,所以页面首帧即是自定义背景。
 */
function injectBootBackground(html, section) {
  const { path } = normalizeSection(section);
  if (path === "") return html;
  const css = buildBackgroundCss("/dsh-background/image").replaceAll("<", "\\u003c");
  const fragment = `<style data-plugin="dsh-background">${css}</style><script>document.documentElement.setAttribute('data-dsh-background','')<\/script>`;
  const head = html.indexOf("<head>");
  if (head !== -1) return `${html.slice(0, head + 6)}${fragment}${html.slice(head + 6)}`;
  return `${fragment}${html}`;
}

/** 图片路由处理器:按当前配置读取本地文件并以正确的 content-type 返回。 */
async function serveImage(section, req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  const { path } = normalizeSection(section);
  if (path === "") {
    res.writeHead(404);
    res.end("no background configured");
    return;
  }
  let info;
  try {
    info = await stat(path);
  } catch {
    res.writeHead(404);
    res.end("file not found");
    return;
  }
  if (!info.isFile()) {
    res.writeHead(404);
    res.end("not a file");
    return;
  }
  if (info.size > MAX_IMAGE_BYTES) {
    res.writeHead(413);
    res.end("image too large");
    return;
  }
  const type = IMAGE_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(200, {
    "content-type": type,
    "cache-control": "no-store",
    "content-length": String(info.size)
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = createReadStream(path);
  stream.on("error", () => {
    res.destroy();
  });
  stream.pipe(res);
}

/** RPC 错误响应的构造。 */
function rpcError(code, message) {
  return { ok: false, error: { code, message, details: {} } };
}

/**
 * 宿主插件体:
 * - 注册持久化设置命名空间(可选注入 settings);
 * - 注册图片路由与启动期注入(可选注入 webServer);
 * - 注册配置 RPC 通道 `/dsh-background/config`(可选注入 connection)。
 */
export function apply(ctx) {
  let scope;

  ctx.inject(["settings"], (settingsCtx) => {
    scope = settingsCtx.settings.register(BACKGROUND_SETTINGS_NAMESPACE, BackgroundSettingsSchema);
  });

  ctx.inject(["webServer"], (httpCtx) => {
    httpCtx.effect(() => httpCtx.webServer.register({
      kind: "prefix",
      path: "/dsh-background/image",
      handler: (req, res) => serveImage(scope?.get(), req, res)
    }), "dsh-background: image route");
    httpCtx.effect(() => httpCtx.webServer.tapIndex((html) => injectBootBackground(html, scope?.get())), "dsh-background: initial background bootstrap");
  });

  ctx.inject(["connection"], (connCtx) => {
    connCtx.effect(() => connCtx.connection.rpc.handle("/dsh-background", async (endpoint, payload) => {
      if (endpoint !== "config") return rpcError("not-found", `dsh-background: unknown endpoint "${endpoint}"`);
      if (scope === void 0) return rpcError("service-unavailable", "dsh-background: settings service is not mounted");
      if (payload?.op === "get") return { ok: true, value: normalizeSection(scope.get()) };
      if (payload?.op === "set") {
        if (typeof payload.path !== "string") return rpcError("bad-request", "dsh-background: set needs a path string");
        const path = cleanPath(payload.path);
        try {
          // 整体替换用户段,顺带清掉旧版本遗留的 fit/sidebar 字段
          await scope.replace({ path });
        } catch (error) {
          return rpcError("rejected", error instanceof Error ? error.message : String(error));
        }
        return { ok: true, value: normalizeSection(scope.get()) };
      }
      return rpcError("bad-request", "dsh-background: op must be \"get\" or \"set\"");
    }, {}), "dsh-background: config rpc channel");
  });
}

export { BACKGROUND_SETTINGS_NAMESPACE, BackgroundSettingsSchema, cleanPath, normalizeSection, serveImage };
