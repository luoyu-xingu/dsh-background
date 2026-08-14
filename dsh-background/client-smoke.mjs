// dsh-background 客户端 bundle 结构测试:模拟 ModuleLoader 环境,
// 验证工厂执行、导出形状、以及 apply 的插槽注册路径(带 rpc 桩)。
// 运行:node dsh-background/client-smoke.mjs
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./lib/client.js", import.meta.url), "utf8");

let registered = null;
globalThis.window = {
  __ModuleLoader__: {
    load(entry) {
      registered = entry;
    }
  }
};
// 最小 DOM 桩(模块级 CSS 注入与运行时 DOM 操作需要)
globalThis.document = {
  documentElement: { setAttribute() {}, removeAttribute() {} },
  createElement: () => ({ dataset: {}, remove() {}, set textContent(_v) {}, append() {}, appendChild() {} }),
  head: { appendChild() {} },
  querySelector: () => null
};

await import(new URL("./lib/client.js", import.meta.url) + "?t=" + Date.now());

if (registered === null) throw new Error("bundle did not register with __ModuleLoader__.load");
console.assert(registered.id === "dsh-background", "module id must equal package name");
console.log("module id:", registered.id);

const fakeReact = {
  useState: (v) => [v, () => {}],
  useEffect: () => {}
};
const fakeJsxRuntime = {
  jsx: (type, props, key) => ({ type, props, key }),
  jsxs: (type, props, key) => ({ type, props, key })
};
const fakeDefineStore = (decl) => ({ spec: decl, kind: "store-handle" });
const stubs = {
  "react": fakeReact,
  "react/jsx-runtime": fakeJsxRuntime,
  "@deepseek-ai/dsh-client-runtime/client": { defineStore: fakeDefineStore }
};
const requireStub = (id) => {
  if (!(id in stubs)) throw new Error("unexpected require: " + id);
  return stubs[id];
};

const exportsOf = registered.factory(requireStub);
console.assert(typeof exportsOf.apply === "function", "apply export");
console.assert(Array.isArray(exportsOf.inject), "inject export");
console.assert(exportsOf.inject.includes("connection"), "inject needs connection");
console.assert(!exportsOf.inject.includes("settingsScope"), "no settingsScope dependency");
console.log("inject:", JSON.stringify(exportsOf.inject));

// 模拟 apply:验证 RPC 调用路径与插槽注册
const rpcCalls = [];
const fakeRpc = {
  call: async (channel, endpoint, payload) => {
    rpcCalls.push({ channel, endpoint, payload });
    if (payload.op === "get") return { ok: true, value: { path: "" } };
    return { ok: true, value: { path: payload.path ?? "" } };
  }
};
const calls = [];
const fakeCtx = {
  connection: { rpc: fakeRpc },
  locale: { register: () => {}, getLocale: () => ({ active: "zh" }) },
  slots: { inject: (name, fn) => calls.push(["slots.inject", name]), register: () => calls.push(["slots.register"]) },
  effect: (fn) => {
    const cleanup = fn();
    return () => typeof cleanup === "function" && cleanup();
  },
  on: () => () => {}
};
exportsOf.apply(fakeCtx);
console.assert(calls.some((c) => c[0] === "slots.inject" && c[1] === "settings.general.item"), "registers into general settings item slot");
// 等微任务:初始 config load 的 rpc 调用
await new Promise((r) => setTimeout(r, 50));
console.assert(rpcCalls.some((c) => c.channel === "/dsh-background" && c.endpoint === "config" && c.payload.op === "get"), "initial config load via rpc channel");
console.log("apply calls:", JSON.stringify(calls));
console.log("rpc calls:", JSON.stringify(rpcCalls));

console.log("\nCLIENT BUNDLE SMOKE TESTS PASSED");
