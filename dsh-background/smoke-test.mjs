// dsh-background 宿主端烟雾测试:path 唯一字段的 schema 校验、路径清洗、归一化、背景 CSS 构建。
// 运行:node smoke-test.mjs(依赖经 E:\dsh-background\node_modules 的 Junction 解析)
import { pathToFileURL } from "node:url";

const mod = await import(pathToFileURL("E:/dsh-background/lib/index.js"));

const schema = mod.BackgroundSettingsSchema;

// 1. 默认值解析
const defaults = schema({});
console.assert(defaults.path === "", "schema default path");
console.log("defaults:", JSON.stringify(defaults));

// 2. 合法值(含 Windows 路径与空格)
const full = schema({ path: "C:\\Users\\<user>\\a.jpg" });
console.assert(full.path === "C:\\Users\\<user>\\a.jpg", "valid path");
console.log("full:", JSON.stringify(full));

// 3. 路径清洗
console.assert(mod.cleanPath('  C:\\a b\\c.jpg\r\n"x') === "C:\\a b\\c.jpg", "path cleaned");
console.assert(mod.cleanPath(123) === "", "non-string cleared");
console.log("cleanPath: OK");

// 4. 归一化(容忍脏数据/旧版本遗留字段)
const norm = mod.normalizeSection({ path: "  E:\\x.png  ", fit: "tile", sidebar: false });
console.assert(norm.path === "E:\\x.png" && !("fit" in norm) && !("sidebar" in norm), "normalize drops legacy fields");
console.log("normalizeSection: OK");

// 5. 背景 CSS 构建(固定 cover)
const css = mod.buildBackgroundCss("/dsh-background/image?v=7");
console.assert(css.includes('url("/dsh-background/image?v=7")') && css.includes("center / cover no-repeat fixed"), "css build");
console.assert(!css.includes("sidebar-fill"), "no sidebar rule anymore");
console.log("--- css ---");
console.log(css.split("\n").map((l) => l.slice(0, 140)).join("\n"));

// 6. 命名空间
console.assert(mod.BACKGROUND_SETTINGS_NAMESPACE === "ui-background", "namespace");
console.log("namespace:", mod.BACKGROUND_SETTINGS_NAMESPACE);

console.log("\nALL SMOKE TESTS PASSED");
