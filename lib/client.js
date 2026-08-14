window.__ModuleLoader__.load({
	id: "dsh-background",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");

		/**
		 * dsh-background — 客户端一半:
		 * 1. 在「设置 → 通用设置 → 外观」注册「背景图片」行:本地图片路径输入、
		 *    蒙层强度滑块、清除按钮,以及 180×88 的实时预览(尺寸参照默认
		 *    「外观」主题立方体);
		 * 2. 通过宿主端自定义 RPC 通道 `/dsh-background/config` 读写配置
		 *    (当前版本的 settings 网关只开放硬编码白名单,第三方命名空间
		 *    会被 `settings-not-exposed` 拒绝,因此不走 settingsScope);
		 * 3. 把背景应用到页面:覆盖 body 上的 `--dsw-alias-bg-base` 令牌
		 *    (cover 填充 + 可读性蒙层),图片从宿主端的 `/dsh-background/image`
		 *    路由加载(浏览器无法直接加载本地文件路径)。
		 */

		// ── 行样式(静态,模块加载时注入一次) ────────────────────────────────
		const css = ".dshbg-group{border-bottom:1px solid var(--dsw-alias-border-l2);flex-direction:column;gap:12px;padding:16px 0;display:flex}.dshbg-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.dshbg-main{flex-wrap:wrap;align-items:stretch;gap:12px;display:flex}.dshbg-preview{box-sizing:border-box;flex:0 0 180px;height:88px;border:1px solid var(--dsw-alias-border-l2);border-radius:16px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.dshbg-previewImage{position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat}.dshbg-controls{flex:1 1 280px;min-width:240px;flex-direction:column;gap:8px;display:flex}.dshbg-input{box-sizing:border-box;width:100%;height:32px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;outline:none}.dshbg-input::placeholder{color:var(--dsw-alias-label-secondary)}.dshbg-input:focus{border-color:var(--dsw-static-neutral-bluish-400)}.dshbg-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.dshbg-hint.dshbg-error{color:var(--dsw-alias-state-error-primary)}.dshbg-veilRow{display:flex;align-items:center;gap:10px}.dshbg-veilLabel{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;flex:none}.dshbg-veilValue{color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;flex:none;min-width:34px;text-align:right}.dshbg-range{flex:1;min-width:120px;accent-color:var(--dsw-static-neutral-bluish-400);height:16px;margin:0}.dshbg-actions{display:flex;align-items:center;gap:8px}.dshbg-clear{border:1px solid var(--dsw-alias-border-l2);font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border-radius:10px;padding:4px 10px;font-size:12px;line-height:18px;display:inline-flex;align-items:center;gap:4px}.dshbg-clear:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dshbg-clear:disabled{opacity:.45;cursor:default}";
		const tagId = "dsh-background/styles.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-background";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		// ── 工具:背景样式构建(与宿主端 boot 注入保持一致) ──────────────────
		// 图片之上按主题叠加半透明蒙层(浅色白蒙层 / 深色深蒙层,强度由 veil
		// 百分比控制),保证任意亮度图片上应用文字可读;作用域限定
		// html[data-dsh-background],不影响默认外观。
		// 另修复输入框停靠区遮罩(composerSeat):其渐变色消费 color-mix(bg-base),
		// 变量带 url 时失效变透明导致滚动文字透到输入框下方——恢复不透明渐隐遮罩。
		function buildBackgroundCss(imageUrl, veil) {
			const image = `url(${JSON.stringify(imageUrl)})`;
			const pct = typeof veil === "number" && Number.isFinite(veil) ? Math.min(100, Math.max(0, Math.round(veil))) : 70;
			const alpha = (pct / 100).toFixed(2);
			const veilLight = `linear-gradient(rgba(255, 255, 255, ${alpha}), rgba(255, 255, 255, ${alpha}))`;
			const veilDark = `linear-gradient(rgba(9, 11, 15, ${alpha}), rgba(9, 11, 15, ${alpha}))`;
			const stack = (veilLayer) => `${veilLayer}, ${image} center / cover no-repeat fixed`;
			return [
				`html[data-dsh-background] body{--dsw-alias-bg-base:${stack(veilLight)}, var(--dsw-static-neutral-bluish-00);}`,
				`html[data-dsh-background] body[data-ds-dark-theme]{--dsw-alias-bg-base:${stack(veilDark)}, var(--dsw-static-neutral-bluish-950)}`,
				`html[data-dsh-background] body [data-phase=active] .wSkVaW_composerSeat{background:linear-gradient(180deg, transparent 0px, var(--dsw-static-neutral-bluish-00) 36px)}`,
				`html[data-dsh-background] body[data-ds-dark-theme] [data-phase=active] .wSkVaW_composerSeat{background:linear-gradient(180deg, transparent 0px, var(--dsw-static-neutral-bluish-950) 36px)}`
			].join("\n");
		}

		// ── 客户端运行时:RPC 读写 + DOM 应用 ───────────────────────────────
		class BackgroundClient {
			constructor(ctx) {
				this.ctx = ctx;
				// 图片缓存破绽参数:仅当路径变化时递增。蒙层强度调整只改渐变,
				// 复用已加载的图片,避免每次写入都重新拉图导致背景闪动。
				this.imageRev = 0;
				this.currentPath = null;
				this.styleEl = null;
			}

			/** 从宿主读取当前配置并应用。 */
			async load() {
				const result = await this.ctx.connection.rpc.call("/dsh-background", "config", { op: "get" });
				if (!result.ok) throw new Error(result.error?.message ?? "config read failed");
				return this.adopt(result.value);
			}

			/** 写配置(宿主进程内持久化到 settings.yaml)。 */
			async write(patch) {
				const result = await this.ctx.connection.rpc.call("/dsh-background", "config", { op: "set", ...patch });
				if (!result.ok) throw new Error(result.error?.message ?? "config write failed");
				return this.adopt(result.value);
			}

			/** 应用一份配置片段到页面。 */
			adopt(section) {
				const path = typeof section?.path === "string" ? section.path : "";
				const veil = typeof section?.veil === "number" ? section.veil : 70;
				if (path !== this.currentPath) {
					this.currentPath = path;
					this.imageRev += 1;
				}
				if (path === "") {
					this.clear();
				} else {
					this.ensureStyleEl();
					this.styleEl.textContent = buildBackgroundCss(`/dsh-background/image?v=${this.imageRev}`, veil);
					document.documentElement.setAttribute("data-dsh-background", "");
				}
				return { path, veil, rev: this.imageRev };
			}

			clear() {
				this.currentPath = null;
				if (this.styleEl !== null) this.styleEl.textContent = "";
				document.documentElement.removeAttribute("data-dsh-background");
			}

			ensureStyleEl() {
				if (this.styleEl !== null && this.styleEl.isConnected) return;
				this.styleEl = document.createElement("style");
				this.styleEl.dataset.plugin = "dsh-background";
				this.styleEl.dataset.pluginCss = "dsh-background/background.css";
				document.head.appendChild(this.styleEl);
			}

			dispose() {
				this.clear();
				if (this.styleEl !== null) this.styleEl.remove();
				this.styleEl = null;
			}
		}

		// ── 设置行 store(镜像当前配置) ─────────────────────────────────────
		function createBackgroundRowStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					path: "",
					veil: 70,
					rev: 0,
					status: "loading"
				}),
				actions: {
					sync: (d, next) => {
						if (d.path === next.path && d.veil === next.veil && d.rev === next.rev && d.status === next.status) return;
						d.path = next.path;
						d.veil = next.veil;
						d.rev = next.rev;
						d.status = next.status;
					},
					fail: (d, message) => {
						d.status = "error";
						d.errorMessage = message;
					}
				}
			});
		}

		// ── 「背景图片」行组件(预览尺寸参照默认「外观」主题立方体:180px 宽) ─
		function cleanPathInput(value) {
			if (typeof value !== "string") return "";
			return value.trim().replace(/[\r\n"'<>]/g, "");
		}

		function BackgroundRow({ t, useStore, setPath, setVeil, clear }) {
			const state = useStore((s) => s);
			const [draft, setDraft] = react.useState(state.path);
			const [focused, setFocused] = react.useState(false);
			const [missing, setMissing] = react.useState(false);
			// 蒙层滑块:本地草稿即时跟随拖动,松手/键盘释放时提交,避免受控值
			// 直绑持久化状态导致拖动被异步写回重置(表现为滑块拖不动)。
			const [veilDraft, setVeilDraft] = react.useState(state.veil);
			const [veilActive, setVeilActive] = react.useState(false);
			react.useEffect(() => {
				if (!focused) setDraft(state.path);
			}, [state.path, focused]);
			react.useEffect(() => {
				if (!veilActive) setVeilDraft(state.veil);
			}, [state.veil, veilActive]);
			// 探测当前配置的图片文件是否存在(隐藏 img 加载宿主图片路由)
			react.useEffect(() => {
				if (state.status !== "ready" || state.path === "") {
					setMissing(false);
					return;
				}
				const image = new Image();
				let alive = true;
				image.onload = () => {
					if (alive) setMissing(false);
				};
				image.onerror = () => {
					if (alive) setMissing(true);
				};
				image.src = `/dsh-background/image?v=${state.rev}`;
				return () => {
					alive = false;
				};
			}, [state.path, state.rev, state.status]);
			const commit = () => {
				const value = cleanPathInput(draft);
				if (value === state.path) return;
				setPath(value);
			};
			const previewPath = focused ? cleanPathInput(draft) : state.path;
			const previewUrl = previewPath !== "" ? `/dsh-background/image?v=${state.rev}` : "";
			const clampVeil = (value) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
			const commitVeil = () => {
				setVeilActive(false);
				if (veilDraft === state.veil) return;
				setVeil(clampVeil(veilDraft));
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "dshbg-group",
				children: [
					(0, react_jsx_runtime.jsx)("div", { className: "dshbg-title", children: t("background.title") }),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dshbg-main",
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: "dshbg-preview",
								children: previewUrl !== "" ? (0, react_jsx_runtime.jsx)("div", {
									className: "dshbg-previewImage",
									style: { backgroundImage: `url(${JSON.stringify(previewUrl)})` }
								}) : (0, react_jsx_runtime.jsx)("span", { children: t("background.previewEmpty") })
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dshbg-controls",
								children: [
									(0, react_jsx_runtime.jsx)("input", {
										className: "dshbg-input",
										type: "text",
										value: draft,
										placeholder: t("background.pathPlaceholder"),
										disabled: state.status === "error",
										onFocus: () => setFocused(true),
										onBlur: () => {
											setFocused(false);
											commit();
										},
										onChange: (e) => setDraft(e.target.value),
										onKeyDown: (e) => {
											if (e.key === "Enter") {
												commit();
												e.currentTarget.blur();
											}
										}
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										className: "dshbg-veilRow",
										children: [
											(0, react_jsx_runtime.jsx)("span", {
												className: "dshbg-veilLabel",
												children: t("background.veil")
											}),
											(0, react_jsx_runtime.jsx)("input", {
												className: "dshbg-range",
												type: "range",
												min: 0,
												max: 100,
												step: 5,
												value: veilDraft,
												disabled: state.status === "error",
												"aria-label": t("background.veil"),
												onPointerDown: () => setVeilActive(true),
												onChange: (e) => setVeilDraft(clampVeil(e.target.value)),
												onPointerUp: () => commitVeil(),
												onKeyUp: () => commitVeil(),
												onBlur: () => commitVeil()
											}),
											(0, react_jsx_runtime.jsx)("span", {
												className: "dshbg-veilValue",
												children: `${veilDraft}%`
											})
										]
									}),
									state.status === "error" ? (0, react_jsx_runtime.jsx)("div", {
										className: "dshbg-hint dshbg-error",
										children: t("background.unavailable")
									}) : missing ? (0, react_jsx_runtime.jsx)("div", {
										className: "dshbg-hint dshbg-error",
										children: t("background.fileMissing")
									}) : null,
									(0, react_jsx_runtime.jsx)("div", {
										className: "dshbg-actions",
										children: (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dshbg-clear",
											disabled: state.status === "error" || state.path === "",
											onClick: () => clear(),
											children: t("background.clear")
										})
									})
								]
							})
						]
					})
				]
			});
		}

		// ── 词典 ───────────────────────────────────────────────────────────
		const zh = {
			"background.title": "背景图片",
			"background.previewEmpty": "暂无背景",
			"background.pathPlaceholder": "粘贴本地图片路径,如 C:\\图片\\bg.jpg",
			"background.veil": "蒙层强度",
			"background.clear": "清除背景",
			"background.fileMissing": "文件不存在或无法读取",
			"background.unavailable": "无法连接背景服务,请重启 dsh web 后重试"
		};
		const en = {
			"background.title": "Background Image",
			"background.previewEmpty": "No background",
			"background.pathPlaceholder": "Paste a local image path, e.g. C:\\images\\bg.jpg",
			"background.veil": "Veil Strength",
			"background.clear": "Clear",
			"background.fileMissing": "File not found or unreadable",
			"background.unavailable": "Background service unavailable, restart dsh web"
		};

		// ── 插件体 ─────────────────────────────────────────────────────────
		/** 设置行词典命名空间。 */
		const SETTINGS_NS = "settings.background";
		/** 需要的内核服务。 */
		const inject = ["slots", "locale", "connection"];

		function apply(ctx) {
			const client = new BackgroundClient(ctx);
			const store = createBackgroundRowStore();
			let bound;

			const push = (next, status) => {
				bound?.sync({ ...next, status });
			};

			ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en }), "dsh-background: settings row dictionaries");
			ctx.effect(() => () => {
				client.dispose();
			}, "dsh-background: runtime disposal");
			ctx.effect(() => {
				client.load().then(
					(next) => {
						push(next, "ready");
					},
					(error) => {
						console.warn("dsh-background: config load failed", error);
						bound?.fail(error instanceof Error ? error.message : String(error));
					}
				);
			}, "dsh-background: initial config load");

			const injected = (actions) => {
				bound = actions;
				return {
					setPath: (value) => {
						client.write({ path: value }).then(
							(next) => push(next, "ready"),
							(error) => console.warn("dsh-background: setPath failed", error)
						);
					},
					setVeil: (value) => {
						client.write({ veil: value }).then(
							(next) => push(next, "ready"),
							(error) => console.warn("dsh-background: setVeil failed", error)
						);
					},
					clear: () => {
						client.write({ path: "" }).then(
							(next) => push(next, "ready"),
							(error) => console.warn("dsh-background: clear failed", error)
						);
					}
				};
			};

			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "background",
				order: 20,
				store,
				locale: SETTINGS_NS,
				inject: injected
			}, BackgroundRow));
		}

		exports.SETTINGS_NS = SETTINGS_NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
