// G3 角色细颗粒度看板 · 真实浏览器端到端回归（零 npm 依赖，基于 CDP 骨架）
// 运行: node scripts/e2e_role_board.mjs   （先执行 vite build）
// 覆盖: 打开 dist → 点「看板」→ 等自动 30 局计算完成 → 断言 UI/结论/缓存/无异常 → 截图
import http from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "dist");
const SERVE_PORT = Number(process.env.G3_PORT || 8901);
const CDP_PORT = Number(process.env.G3_CDP_PORT || 9447);
const CHROME =
  process.env.G3_CHROME ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SHOT = path.join(os.tmpdir(), "g3_role_board_e2e.png");
const BASE = `http://127.0.0.1:${SERVE_PORT}`;
const PROFILE = path.join(os.tmpdir(), "g3-role-board-profile");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const staticServer = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const fp = path.join(ROOT, rel);
  if (!fp.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  let st;
  try {
    st = statSync(fp);
  } catch {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  if (!st.isFile()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(fp)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(fp).pipe(res);
});
await new Promise((resolve, reject) => {
  staticServer.on("error", reject);
  staticServer.listen(SERVE_PORT, "127.0.0.1", () => resolve());
});

const cleanEnv = { ...process.env };
for (const k of Object.keys(cleanEnv)) if (/proxy/i.test(k)) delete cleanEnv[k];
cleanEnv.NO_PROXY = "127.0.0.1,localhost";
cleanEnv.no_proxy = "127.0.0.1,localhost";

mkdirSync(PROFILE, { recursive: true });
const chromeProc = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--no-first-run",
    "--disable-gpu",
    "--no-sandbox",
    "--no-proxy-server",
    "--proxy-bypass-list=<-loopback>",
    "about:blank",
  ],
  { stdio: "ignore", env: cleanEnv }
);

function httpGetJson(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { host: "127.0.0.1", port: CDP_PORT, path: pathname, timeout: 4000 },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error("bad json"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function getWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const j = await httpGetJson("/json/version");
      if (j.webSocketDebuggerUrl)
        return j.webSocketDebuggerUrl.replace("localhost", "127.0.0.1");
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("CDP 未就绪，端口 " + CDP_PORT);
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("timeout: " + method));
        }
      }, 30000);
    });
  }
}

console.log("=== G3 角色看板 · 浏览器端到端 ===\n");
const ws = new WebSocket(await getWsUrl());
await new Promise((res, rej) => {
  ws.addEventListener("open", res);
  ws.addEventListener("error", rej);
});
const cdp = new CDP(ws);
const { targetInfos } = await cdp.send("Target.getTargets");
let target = targetInfos.find((t) => t.type === "page");
if (!target)
  target = {
    targetId: (await cdp.send("Target.createTarget", { url: "about:blank" }))
      .targetId,
  };
const { sessionId: S } = await cdp.send("Target.attachToTarget", {
  targetId: target.targetId,
  flatten: true,
});
await cdp.send("Page.enable", {}, S);
await cdp.send("Runtime.enable", {}, S);
// 加大视口，让交付截图能同时看到版本、结论、综合胜率、对局表与角色表
await cdp.send(
  "Emulation.setDeviceMetricsOverride",
  { width: 1440, height: 1600, deviceScaleFactor: 1, mobile: false },
  S
);

const pageErrors = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === "Runtime.exceptionThrown") {
    pageErrors.push(
      m.params.exceptionDetails.exception?.description ||
        m.params.exceptionDetails.text
    );
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    pageErrors.push(
      "console.error: " +
        m.params.args.map((a) => a.value ?? a.description).join(" ")
    );
  }
});

async function evalJs(expression) {
  const r = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    S
  );
  if (r.exceptionDetails)
    throw new Error(
      r.exceptionDetails.exception?.description || r.exceptionDetails.text
    );
  return r.result.value;
}
async function goto(url) {
  await cdp.send("Page.navigate", { url }, S);
  for (let i = 0; i < 100; i++) {
    try {
      if ((await evalJs("document.readyState")) === "complete") break;
    } catch {
      /* navigating */
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  await new Promise((r) => setTimeout(r, 500));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0,
  fail = 0;
const failed = [];
function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failed.push(name + (extra ? " -> " + extra : ""));
    console.log(`  FAIL  ${name}${extra ? " -> " + extra : ""}`);
  }
}

const ver = await httpGetJson("/json/version");
console.log("  浏览器 :", ver.Browser, "\n");

await goto(`${BASE}/index.html`);
check(
  "应用已挂载（底部 tab 存在）",
  await evalJs(
    "document.body.innerText.includes('部署') && document.body.innerText.includes('看板')"
  )
);

// 清空缓存以确保走真实自动计算链路
await evalJs("localStorage.removeItem('g3_role_board_cache_v1'); true");
await goto(`${BASE}/index.html`);

const clicked = await evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '看板');
  if (!b) return false;
  b.click();
  return true;
})()`);
check("「看板」入口可点击", clicked === true);

await wait(600);
check(
  "看板标题已渲染",
  await evalJs("document.body.innerText.includes('角色细颗粒度看板')")
);

// 等自动 30 局计算完成：轮询「自动分析结论」出现，最长 120s
let ready = false;
for (let i = 0; i < 120; i++) {
  ready = await evalJs(
    "document.body.innerText.includes('自动分析结论') && document.body.innerText.includes('综合胜率')"
  );
  if (ready) break;
  await wait(1000);
}
check("自动计算完成并产出分析结论", ready, "120s 内未完成");

if (ready) {
  const info = await evalJs(`(() => {
    const trs = document.querySelectorAll('tbody tr').length;
    const txt = document.body.innerText;
    const cache = localStorage.getItem('g3_role_board_cache_v1');
    return JSON.stringify({
      trs,
      hasOver: txt.includes('疑似超模'),
      hasUnder: txt.includes('待加强'),
      hasInsight: txt.includes('种族格局') && txt.includes('引擎对称性'),
      cacheBytes: cache ? cache.length : 0,
      hasTable: txt.includes('10s综合'),
    });
  })()`);
  const d = JSON.parse(info);
  check("角色表格行数 > 40", d.trs > 40, String(d.trs));
  check("自动结论含超模/待加强", d.hasOver && d.hasUnder, JSON.stringify(d));
  check("自动结论含种族格局与对称性", d.hasInsight);
  check("结果已写入本地缓存", d.cacheBytes > 1000, String(d.cacheBytes));
  check("细颗粒度列可见", d.hasTable);
  check(
    "胜率对局表 28 行（21 对阵 + 7 镜像）",
    await evalJs(
      "(document.getElementById('g3-matchup-table')?.querySelectorAll('tbody tr').length || 0) >= 28"
    )
  );
}

const shot = await cdp.send(
  "Page.captureScreenshot",
  { format: "png", captureBeyondViewport: false },
  S
);
writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
console.log(`\n  截图: ${SHOT}`);

const uniq = [...new Set(pageErrors)];
check(
  "无非预期页面异常 / console.error",
  uniq.length === 0,
  uniq.slice(0, 3).join(" | ")
);

console.log("\n=== 结果 ===");
console.log(`断言：${pass} passed, ${fail} failed`);
if (failed.length) {
  console.log("失败项：");
  failed.forEach((f) => console.log("  - " + f));
}

ws.close();
try {
  chromeProc.kill();
} catch {
  /* ignore */
}
try {
  staticServer.close();
} catch {
  /* ignore */
}
process.exit(fail === 0 ? 0 : 1);
