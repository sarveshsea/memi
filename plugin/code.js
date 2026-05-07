var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
(function() {
  "use strict";
  function arrayIncludes(values, target) {
    for (let index = 0; index < values.length; index += 1) {
      if (values[index] === target) {
        return true;
      }
    }
    return false;
  }
  const WIDGET_V2_CHANNEL = "memoire.widget.v2";
  function createRunId(prefix = "run") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function createChangeBuffer(options) {
    if (!Number.isInteger(options.capacity) || options.capacity <= 0) {
      throw new Error(`ChangeBuffer capacity must be a positive integer, got ${options.capacity}`);
    }
    const cap = options.capacity;
    const onDrop = options.onDrop;
    let entries = [];
    function evict(needed) {
      if (needed <= 0) return;
      const dropped = entries.slice(0, needed);
      entries = entries.slice(needed);
      if (onDrop && dropped.length > 0) {
        onDrop({
          droppedCount: dropped.length,
          firstDroppedAt: dropped[0].timestamp,
          lastDroppedAt: dropped[dropped.length - 1].timestamp,
          remaining: entries.length,
          capacity: cap
        });
      }
    }
    return {
      push(entry) {
        entries.push(entry);
        if (entries.length > cap) evict(entries.length - cap);
      },
      pushMany(incoming) {
        if (incoming.length === 0) return;
        for (const entry of incoming) entries.push(entry);
        if (entries.length > cap) evict(entries.length - cap);
      },
      drain() {
        const out = entries;
        entries = [];
        return out;
      },
      peek() {
        return entries;
      },
      size() {
        return entries.length;
      },
      capacity() {
        return cap;
      },
      clear() {
        entries = [];
      }
    };
  }
  function getCrypto() {
    const g = globalThis;
    return g.crypto ? g.crypto : null;
  }
  function byteHex(byte) {
    const text = (byte & 255).toString(16);
    return text.length >= 2 ? text : "0" + text;
  }
  function uuidv4() {
    const c = getCrypto();
    if (c && c.randomUUID) return c.randomUUID();
    const bytes = new Uint8Array(16);
    if (c && c.getRandomValues) {
      c.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = bytes[6] & 15 | 64;
    bytes[8] = bytes[8] & 63 | 128;
    let out = "";
    for (let i = 0; i < 16; i += 1) {
      out += byteHex(bytes[i]);
      if (i === 3 || i === 5 || i === 7 || i === 9) out += "-";
    }
    return out;
  }
  function createJobsStore(options = {}) {
    var _a, _b;
    const jobs = /* @__PURE__ */ new Map();
    const runStack = [];
    const emit = (_a = options.onEmit) != null ? _a : (() => {
    });
    const now = (_b = options.now) != null ? _b : (() => Date.now());
    function put(job) {
      jobs.set(job.id, job);
      emit(job);
      return job;
    }
    function errorToString(error) {
      if (typeof error === "string") return error;
      try {
        return JSON.stringify({
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          detail: error.detail
        });
      } catch (e) {
        return error.message;
      }
    }
    return {
      start({ id, command, kind, label }) {
        const t = now();
        const runId = uuidv4();
        const job = {
          id,
          runId,
          kind,
          label,
          command,
          status: "running",
          startedAt: t,
          updatedAt: t,
          progressText: "Running"
        };
        runStack.push(runId);
        return put(job);
      },
      finishCompleted(jobId, summary) {
        const existing = jobs.get(jobId);
        if (!existing) return null;
        const t = now();
        const next = __spreadProps(__spreadValues({}, existing), {
          status: "completed",
          updatedAt: t,
          finishedAt: t,
          progressText: "Done",
          summary,
          error: void 0
        });
        popRun(existing.runId);
        return put(next);
      },
      finishFailed(jobId, error) {
        const existing = jobs.get(jobId);
        if (!existing) return null;
        const t = now();
        const next = __spreadProps(__spreadValues({}, existing), {
          status: "failed",
          updatedAt: t,
          finishedAt: t,
          progressText: "Failed",
          error: errorToString(error)
        });
        popRun(existing.runId);
        return put(next);
      },
      markDisconnected(jobId) {
        const existing = jobs.get(jobId);
        if (!existing) return null;
        if (existing.status !== "running") return existing;
        const t = now();
        const next = __spreadProps(__spreadValues({}, existing), {
          status: "disconnected",
          updatedAt: t,
          finishedAt: t,
          progressText: "Disconnected"
        });
        popRun(existing.runId);
        return put(next);
      },
      get(jobId) {
        return jobs.get(jobId);
      },
      all() {
        return Array.from(jobs.values());
      },
      activeRunId() {
        return runStack.length > 0 ? runStack[runStack.length - 1] : null;
      },
      size() {
        return jobs.size;
      }
    };
    function popRun(runId) {
      const idx = runStack.lastIndexOf(runId);
      if (idx >= 0) runStack.splice(idx, 1);
    }
  }
  function makeError(code, message, options = {}) {
    const err2 = {
      code,
      message,
      retryable: options.retryable === void 0 ? isRetryableByDefault(code) : options.retryable
    };
    if (options.detail) err2.detail = options.detail;
    if (options.cause) err2.cause = normalizeCause(options.cause);
    return err2;
  }
  function isRetryableByDefault(code) {
    switch (code) {
      case "E_TIMEOUT":
      case "E_BRIDGE_DISCONNECTED":
      case "E_BRIDGE_UNREACHABLE":
      case "E_BRIDGE_SEND_FAILED":
      case "E_QUEUE_FULL":
        return true;
      default:
        return false;
    }
  }
  function normalizeCause(value) {
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    if (value && typeof value === "object") {
      const v = value;
      return {
        name: typeof v.name === "string" ? v.name : void 0,
        message: typeof v.message === "string" ? v.message : void 0,
        stack: typeof v.stack === "string" ? v.stack : void 0
      };
    }
    return { message: typeof value === "string" ? value : void 0 };
  }
  const FIGMA_EXPORT_FORMATS = ["PNG", "JPG", "SVG", "PDF"];
  const SCREENSHOT_MIN_SCALE = 0.1;
  const SCREENSHOT_MAX_SCALE = 4;
  function validateScreenshotParams(raw) {
    const format = normalizeFormat(raw.format);
    if (!arrayIncludes(FIGMA_EXPORT_FORMATS, format)) {
      return {
        ok: false,
        error: makeError(
          "E_FIGMA_FORMAT_UNSUPPORTED",
          "Unsupported export format: " + String(raw.format),
          { detail: { allowed: FIGMA_EXPORT_FORMATS } }
        )
      };
    }
    const scaleRaw = raw.scale === void 0 || raw.scale === null ? 2 : Number(raw.scale);
    if (!Number.isFinite(scaleRaw)) {
      return {
        ok: false,
        error: makeError("E_PARAM_INVALID", "scale must be a finite number", {
          detail: { received: raw.scale }
        })
      };
    }
    if (scaleRaw < SCREENSHOT_MIN_SCALE || scaleRaw > SCREENSHOT_MAX_SCALE) {
      return {
        ok: false,
        error: makeError(
          "E_FIGMA_SCALE_OUT_OF_RANGE",
          "scale out of range [" + SCREENSHOT_MIN_SCALE + ", " + SCREENSHOT_MAX_SCALE + "]",
          { detail: { received: scaleRaw } }
        )
      };
    }
    return { ok: true, value: { format, scale: scaleRaw } };
  }
  function normalizeFormat(raw) {
    if (raw === void 0 || raw === null || raw === "") return "PNG";
    const text = String(raw).toUpperCase();
    if (text === "JPEG") return "JPG";
    return text;
  }
  function parseColorValue(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.charAt(0) === "#") return parseHexColor(trimmed);
    const rgbMatch = trimmed.match(
      /^rgba?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*(-?\d+(?:\.\d+)?)\s*)?\)$/i
    );
    if (rgbMatch) {
      const r = clamp01(Number(rgbMatch[1]) / 255);
      const g = clamp01(Number(rgbMatch[2]) / 255);
      const b = clamp01(Number(rgbMatch[3]) / 255);
      const a = rgbMatch[4] === void 0 ? 1 : clamp01(Number(rgbMatch[4]));
      return { r, g, b, a };
    }
    return null;
  }
  function parseHexColor(hex) {
    const body = hex.substring(1);
    if (!/^[0-9a-f]+$/i.test(body)) return null;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 1;
    if (body.length === 3) {
      r = parseInt(body.charAt(0) + body.charAt(0), 16) / 255;
      g = parseInt(body.charAt(1) + body.charAt(1), 16) / 255;
      b = parseInt(body.charAt(2) + body.charAt(2), 16) / 255;
    } else if (body.length === 4) {
      r = parseInt(body.charAt(0) + body.charAt(0), 16) / 255;
      g = parseInt(body.charAt(1) + body.charAt(1), 16) / 255;
      b = parseInt(body.charAt(2) + body.charAt(2), 16) / 255;
      a = parseInt(body.charAt(3) + body.charAt(3), 16) / 255;
    } else if (body.length === 6) {
      r = parseInt(body.substring(0, 2), 16) / 255;
      g = parseInt(body.substring(2, 4), 16) / 255;
      b = parseInt(body.substring(4, 6), 16) / 255;
    } else if (body.length === 8) {
      r = parseInt(body.substring(0, 2), 16) / 255;
      g = parseInt(body.substring(2, 4), 16) / 255;
      b = parseInt(body.substring(4, 6), 16) / 255;
      a = parseInt(body.substring(6, 8), 16) / 255;
    } else {
      return null;
    }
    return { r, g, b, a };
  }
  function clamp01(n) {
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }
  function optionalFiniteNumber(value) {
    if (value === void 0 || value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function nodeFingerprint(node) {
    var _a, _b, _c, _d;
    if (!node || typeof node !== "object") return "none";
    const n = node;
    const parts = [];
    parts.push("t=" + String((_a = n.type) != null ? _a : ""));
    parts.push("n=" + String((_b = n.name) != null ? _b : ""));
    if ("x" in n) parts.push("x=" + String(n.x));
    if ("y" in n) parts.push("y=" + String(n.y));
    if ("width" in n) parts.push("w=" + String(n.width));
    if ("height" in n) parts.push("h=" + String(n.height));
    if ("visible" in n) parts.push("v=" + String(n.visible));
    if ("opacity" in n) parts.push("o=" + String(n.opacity));
    if ("rotation" in n) parts.push("r=" + String(n.rotation));
    if ("characters" in n) parts.push("c=" + String((_d = (_c = n.characters) == null ? void 0 : _c.length) != null ? _d : 0));
    if ("fills" in n && Array.isArray(n.fills)) {
      parts.push("fl=" + String(n.fills.length));
    }
    const raw = parts.join("|");
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i += 1) {
      hash ^= raw.charCodeAt(i);
      hash = hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
    }
    return "v1-" + hash.toString(16);
  }
  function createMetricsRegistry(now = Date.now) {
    const startedAt = now();
    const cmd_total = /* @__PURE__ */ Object.create(null);
    let change_buffer_drops = 0;
    let reconnects = 0;
    const queue_depth = /* @__PURE__ */ Object.create(null);
    const exec_rejects = /* @__PURE__ */ Object.create(null);
    let selection_throttled = 0;
    let bridge_send_failed = 0;
    function bumpLabeled(map, key, delta) {
      const current = map[key];
      map[key] = (current === void 0 ? 0 : current) + delta;
    }
    return {
      inc(name, labelKey, delta = 1) {
        switch (name) {
          case "cmd_total":
            bumpLabeled(cmd_total, labelKey != null ? labelKey : "unknown", delta);
            return;
          case "change_buffer_drops":
            change_buffer_drops += delta;
            return;
          case "reconnects":
            reconnects += delta;
            return;
          case "queue_depth":
            bumpLabeled(queue_depth, labelKey != null ? labelKey : "pending", delta);
            return;
          case "exec_rejects":
            bumpLabeled(exec_rejects, labelKey != null ? labelKey : "unknown", delta);
            return;
          case "selection_throttled":
            selection_throttled += delta;
            return;
          case "bridge_send_failed":
            bridge_send_failed += delta;
            return;
        }
      },
      set(name, labelKey, value) {
        switch (name) {
          case "queue_depth":
            queue_depth[labelKey] = value;
            return;
          case "cmd_total":
            cmd_total[labelKey] = value;
            return;
          case "exec_rejects":
            exec_rejects[labelKey] = value;
            return;
          default:
            return;
        }
      },
      snapshot() {
        return {
          cmd_total: __spreadValues({}, cmd_total),
          change_buffer_drops,
          reconnects,
          queue_depth: __spreadValues({}, queue_depth),
          exec_rejects: __spreadValues({}, exec_rejects),
          selection_throttled,
          bridge_send_failed,
          startedAt,
          sampledAt: now()
        };
      },
      reset() {
        for (const k of Object.keys(cmd_total)) delete cmd_total[k];
        for (const k of Object.keys(queue_depth)) delete queue_depth[k];
        for (const k of Object.keys(exec_rejects)) delete exec_rejects[k];
        change_buffer_drops = 0;
        reconnects = 0;
        selection_throttled = 0;
        bridge_send_failed = 0;
      }
    };
  }
  function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout: ${label} after ${ms}ms`)), ms);
      })
    ]).finally(() => clearTimeout(timer));
  }
  async function safeLoadFont(fontName, options = {}) {
    try {
      await withTimeout(
        figma.loadFontAsync(fontName),
        FONT_TIMEOUT_MS,
        `loadFont ${fontName.family}/${fontName.style}`
      );
    } catch (cause) {
      const err = makeError(
        "E_FIGMA_FONT_FAILED",
        `Failed to load font ${fontName.family}/${fontName.style}`,
        { detail: { family: fontName.family, style: fontName.style }, cause }
      );
      if (options.swallow) return;
      throw new Error(JSON.stringify({ code: err.code, message: err.message, detail: err.detail }));
    }
  }
  const FONT_TIMEOUT_MS = 5e3;
  const state = {
    sessionId: createRunId("widget"),
    bootedAt: Date.now(),
    metrics: createMetricsRegistry(),
    jobs: createJobsStore({
      onEmit: (job) => post({
        channel: WIDGET_V2_CHANNEL,
        source: "main",
        type: "job",
        job
      })
    }),
    selectionListenerActive: true,
    lastSelectionUpdate: 0,
    selectionThrottleMs: 180,
    changeBuffer: createChangeBuffer({
      capacity: 300,
      onDrop: emitChangeBufferDrop
    }),
    connection: {
      stage: "offline",
      port: null,
      name: "Mémoire Control Plane",
      latencyMs: null,
      fileName: "",
      fileKey: null,
      pageName: "",
      pageId: null,
      editorType: "",
      connectedAt: null,
      reconnectDelayMs: null
    }
  };
  function emitChangeBufferDrop(event) {
    state.metrics.inc("change_buffer_drops", void 0, event.droppedCount);
    post({
      channel: WIDGET_V2_CHANNEL,
      source: "main",
      type: "changes-dropped",
      droppedCount: event.droppedCount,
      firstDroppedAt: event.firstDroppedAt,
      lastDroppedAt: event.lastDroppedAt,
      remaining: event.remaining,
      capacity: event.capacity,
      sessionId: state.sessionId,
      updatedAt: Date.now()
    });
  }
  function buildOperatorSnapshot() {
    return {
      protocol: WIDGET_V2_CHANNEL,
      system: {
        sessionId: state.sessionId,
        connection: state.connection,
        metrics: state.metrics.snapshot(),
        changeBuffer: {
          size: state.changeBuffer.size(),
          capacity: state.changeBuffer.capacity()
        },
        bootedAt: state.bootedAt
      },
      selection: createSelectionSnapshot(),
      jobs: snapshotJobs(),
      logs: []
    };
  }
  function emitGranularChange(type, change, timestamp) {
    if (type === "variable-changed") {
      post({
        channel: WIDGET_V2_CHANNEL,
        source: "main",
        type: "granular-change",
        granularType: "variable-changed",
        data: {
          name: change.id,
          collection: "",
          values: {},
          updatedAt: timestamp
        }
      });
    } else if (type === "component-changed") {
      var node = change.node;
      post({
        channel: WIDGET_V2_CHANNEL,
        source: "main",
        type: "granular-change",
        granularType: "component-changed",
        data: {
          name: node ? node.name : "unknown",
          key: node && node.key ? node.key : change.id,
          figmaNodeId: change.id,
          updatedAt: timestamp
        }
      });
    }
  }
  figma.showUI(__html__, {
    width: 480,
    height: 600,
    title: "Mémoire Control Plane",
    themeColors: true
  });
  void bootstrap();
  let allPagesLoaded = false;
  async function bootstrap() {
    refreshConnectionState();
    post({
      channel: WIDGET_V2_CHANNEL,
      source: "main",
      type: "bootstrap",
      connection: state.connection,
      selection: createSelectionSnapshot(),
      initialJobs: snapshotJobs()
    });
    let pendingTrailingEmit = null;
    const emitSelection = () => {
      state.lastSelectionUpdate = Date.now();
      post({
        channel: WIDGET_V2_CHANNEL,
        source: "main",
        type: "selection",
        selection: createSelectionSnapshot()
      });
    };
    figma.on("selectionchange", () => {
      const now = Date.now();
      const elapsed = now - state.lastSelectionUpdate;
      if (elapsed >= state.selectionThrottleMs) {
        if (pendingTrailingEmit) {
          clearTimeout(pendingTrailingEmit);
          pendingTrailingEmit = null;
        }
        emitSelection();
        return;
      }
      if (pendingTrailingEmit) return;
      pendingTrailingEmit = setTimeout(() => {
        pendingTrailingEmit = null;
        emitSelection();
      }, state.selectionThrottleMs - elapsed);
      return;
    });
    figma.on("currentpagechange", () => {
      refreshConnectionState();
      const page = figma.currentPage;
      post({
        channel: WIDGET_V2_CHANNEL,
        source: "main",
        type: "page",
        pageName: page ? page.name : "",
        pageId: page ? page.id : null,
        updatedAt: Date.now()
      });
      post({
        channel: WIDGET_V2_CHANNEL,
        source: "main",
        type: "connection",
        connection: state.connection
      });
    });
    figma.on("documentchange", (event) => {
      var _a, _b, _c;
      const now = Date.now();
      const changes = (_a = event == null ? void 0 : event.documentChanges) != null ? _a : [];
      const pageId = (_c = (_b = figma.currentPage) == null ? void 0 : _b.id) != null ? _c : null;
      const batch = changes.map((change) => {
        var _a2;
        return {
          type: change.type,
          id: change.id,
          origin: (_a2 = change.origin) != null ? _a2 : null,
          sessionId: state.sessionId,
          runId: state.jobs.activeRunId(),
          pageId,
          timestamp: now
        };
      });
      state.changeBuffer.pushMany(batch);
      for (const change of changes) {
        if (change.type === "STYLE_CREATE" || change.type === "STYLE_DELETE" || change.type === "STYLE_CHANGE") {
          emitGranularChange("variable-changed", change, now);
        }
        if (change.type === "PROPERTY_CHANGE" && change.node) {
          var nodeType = change.node.type;
          if (nodeType === "COMPONENT" || nodeType === "COMPONENT_SET") {
            emitGranularChange("component-changed", change, now);
          }
        }
      }
      post({
        channel: WIDGET_V2_CHANNEL,
        source: "main",
        type: "changes",
        count: changes.length,
        buffered: state.changeBuffer.size(),
        sessionId: state.sessionId,
        runId: state.jobs.activeRunId(),
        updatedAt: now
      });
    });
  }
  async function ensureAllPagesLoaded() {
    if (allPagesLoaded) return;
    await figma.loadAllPagesAsync();
    allPagesLoaded = true;
    refreshConnectionState();
  }
  figma.ui.onmessage = async (message) => {
    var _a, _b, _c;
    if (!message || message.channel !== WIDGET_V2_CHANNEL) {
      return;
    }
    if (message.type === "ping") {
      refreshConnectionState();
      post({
        channel: WIDGET_V2_CHANNEL,
        source: "main",
        type: "pong",
        connection: state.connection
      });
      return;
    }
    if (message.type !== "run-command") {
      return;
    }
    const job = message.action ? state.jobs.start({
      id: message.requestId,
      command: message.command,
      kind: message.action.kind,
      label: message.action.label
    }) : null;
    try {
      const result = await handleCommand(message.command, (_a = message.params) != null ? _a : {});
      if (job) {
        state.jobs.finishCompleted(job.id, summarizeCommandResult(message.command, result));
      }
      state.metrics.inc("cmd_total", "ok:" + message.command);
      post({
        channel: WIDGET_V2_CHANNEL,
        source: "main",
        type: "command-result",
        requestId: message.requestId,
        command: message.command,
        ok: true,
        sessionId: state.sessionId,
        runId: (_b = job == null ? void 0 : job.runId) != null ? _b : null,
        result
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      if (job) {
        state.jobs.finishFailed(job.id, messageText);
      }
      state.metrics.inc("cmd_total", "err:" + message.command);
      if (message.command === "execute" && messageText.charAt(0) === "{") {
        try {
          const parsed = JSON.parse(messageText);
          if (parsed.code && parsed.code.indexOf("E_EXEC_") === 0) {
            state.metrics.inc("exec_rejects", parsed.code);
          }
        } catch (e) {
        }
      }
      post({
        channel: WIDGET_V2_CHANNEL,
        source: "main",
        type: "command-result",
        requestId: message.requestId,
        command: message.command,
        ok: false,
        sessionId: state.sessionId,
        runId: (_c = job == null ? void 0 : job.runId) != null ? _c : null,
        error: messageText
      });
    }
  };
  function refreshConnectionState() {
    var _a, _b, _c;
    state.connection = __spreadProps(__spreadValues({}, state.connection), {
      stage: "connected",
      fileName: figma.root.name || "",
      fileKey: figma.fileKey || null,
      pageName: ((_a = figma.currentPage) == null ? void 0 : _a.name) || "",
      pageId: ((_b = figma.currentPage) == null ? void 0 : _b.id) || null,
      editorType: figma.editorType || "figma",
      connectedAt: (_c = state.connection.connectedAt) != null ? _c : Date.now()
    });
  }
  function post(message) {
    figma.ui.postMessage(message);
  }
  function snapshotJobs() {
    return state.jobs.all().sort((left, right) => right.updatedAt - left.updatedAt);
  }
  async function handleCommand(command, params) {
    var _a, _b, _c, _d, _e, _f, _g;
    switch (command) {
      case "execute":
        return executeCode(String((_a = params.code) != null ? _a : ""));
      case "getSelection":
        return createSelectionSnapshot();
      case "getFileData":
        return getFileData(Number((_b = params.depth) != null ? _b : 3));
      case "getVariables":
        return getVariables();
      case "getComponents":
        return getComponents();
      case "getStyles":
        return getStyles();
      case "getStickies":
        return getStickies();
      case "getChanges": {
        return state.changeBuffer.drain();
      }
      case "getComponentImage":
        return getComponentImage(String((_c = params.nodeId) != null ? _c : ""), String((_d = params.format) != null ? _d : "png"));
      case "createNode":
        return createNode(params);
      case "updateNode":
        return updateNode(params);
      case "deleteNode":
        return deleteNode(String((_e = params.nodeId) != null ? _e : ""));
      case "setSelection":
        return setSelection(Array.isArray(params.nodeIds) ? params.nodeIds.map(String) : []);
      case "navigateTo":
        return navigateTo(String((_f = params.nodeId) != null ? _f : ""));
      case "getPageList":
        await ensureAllPagesLoaded();
        return figma.root.children.map((page) => ({ id: page.id, name: page.name }));
      case "getPageTree":
        return getPageTree(Number((_g = params.depth) != null ? _g : 2));
      case "captureScreenshot":
        return captureScreenshot(params);
      case "pushTokens":
        return pushTokens(params);
      case "widgetSnapshot":
        return buildOperatorSnapshot();
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }
  function summarizeCommandResult(command, result) {
    if (command === "getSelection" && result && typeof result === "object" && "count" in result) {
      return `${String(result.count)} selected`;
    }
    if (command === "getChanges" && Array.isArray(result)) {
      return `${result.length} changes`;
    }
    if (command === "getVariables" && result && typeof result === "object" && "collections" in result) {
      return `${(result.collections || []).length} collections`;
    }
    if (command === "getComponents" && Array.isArray(result)) {
      return `${result.length} components`;
    }
    if (command === "getStyles" && Array.isArray(result)) {
      return `${result.length} styles`;
    }
    return command;
  }
  function createSelectionSnapshot() {
    refreshConnectionState();
    return {
      count: figma.currentPage.selection.length,
      pageName: figma.currentPage.name,
      pageId: figma.currentPage.id,
      sessionId: state.sessionId,
      nodes: figma.currentPage.selection.map((node) => serializeSelectionNode(node)),
      updatedAt: Date.now()
    };
  }
  function serializeSelectionNode(node) {
    const snapshot = {
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible !== false,
      pageName: figma.currentPage.name
    };
    if ("x" in node) snapshot.x = node.x;
    if ("y" in node) snapshot.y = node.y;
    if ("width" in node) snapshot.width = node.width;
    if ("height" in node) snapshot.height = node.height;
    if ("characters" in node) snapshot.characters = node.characters;
    if ("opacity" in node) snapshot.opacity = node.opacity;
    if ("rotation" in node) snapshot.rotation = node.rotation;
    if ("cornerRadius" in node) snapshot.cornerRadius = node.cornerRadius;
    if ("children" in node && Array.isArray(node.children)) snapshot.childCount = node.children.length;
    if ("fillStyleId" in node) snapshot.fillStyleId = node.fillStyleId || null;
    if ("strokeStyleId" in node) snapshot.strokeStyleId = node.strokeStyleId || null;
    if ("textStyleId" in node) snapshot.textStyleId = node.textStyleId || null;
    if ("boundVariables" in node) snapshot.boundVariables = node.boundVariables || {};
    if ("fills" in node && Array.isArray(node.fills)) {
      snapshot.fills = node.fills.map((fill) => ({
        type: fill.type,
        color: fill.color ? {
          r: fill.color.r,
          g: fill.color.g,
          b: fill.color.b,
          a: fill.opacity !== void 0 ? fill.opacity : 1
        } : null
      }));
    }
    snapshot.layout = readLayout(node);
    snapshot.component = readComponent(node);
    return snapshot;
  }
  function readLayout(node) {
    var _a, _b, _c, _d, _e;
    return {
      layoutMode: "layoutMode" in node ? node.layoutMode || null : null,
      itemSpacing: "itemSpacing" in node ? (_a = node.itemSpacing) != null ? _a : null : null,
      paddingLeft: "paddingLeft" in node ? (_b = node.paddingLeft) != null ? _b : null : null,
      paddingRight: "paddingRight" in node ? (_c = node.paddingRight) != null ? _c : null : null,
      paddingTop: "paddingTop" in node ? (_d = node.paddingTop) != null ? _d : null : null,
      paddingBottom: "paddingBottom" in node ? (_e = node.paddingBottom) != null ? _e : null : null
    };
  }
  function readComponent(node) {
    var _a, _b;
    const isVariant = node.type === "COMPONENT" && ((_a = node.parent) == null ? void 0 : _a.type) === "COMPONENT_SET";
    const variantProperties = {};
    if (typeof node.variantProperties === "object" && node.variantProperties) {
      for (const [key, value] of Object.entries(node.variantProperties)) {
        variantProperties[key] = String((_b = value == null ? void 0 : value.value) != null ? _b : value);
      }
    }
    const componentProperties = "componentPropertyDefinitions" in node && node.componentPropertyDefinitions ? node.componentPropertyDefinitions : {};
    if (!("key" in node) && !("description" in node) && !Object.keys(componentProperties).length && !Object.keys(variantProperties).length) {
      return void 0;
    }
    return {
      key: "key" in node ? node.key || null : null,
      description: "description" in node ? node.description || null : null,
      isVariant,
      variantProperties,
      componentProperties
    };
  }
  function serializeVariable(variable) {
    return {
      id: variable.id,
      name: variable.name,
      key: variable.key,
      resolvedType: variable.resolvedType,
      valuesByMode: variable.valuesByMode,
      variableCollectionId: variable.variableCollectionId,
      scopes: variable.scopes,
      codeSyntax: variable.codeSyntax || {},
      description: variable.description,
      hiddenFromPublishing: variable.hiddenFromPublishing
    };
  }
  async function executeCode(code) {
    if (typeof code !== "string" || code.trim().length === 0) {
      throw new Error(
        JSON.stringify({ code: "E_PARAM_INVALID", message: "Code must be a non-empty string", retryable: false })
      );
    }
    throw new Error(
      JSON.stringify({
        code: "E_EXEC_DISABLED",
        message: "Raw Figma JavaScript execution is disabled in the default Mémoire package. Use typed Figma actions instead.",
        retryable: false
      })
    );
  }
  async function getPageTree(maxDepth) {
    await ensureAllPagesLoaded();
    function walkChildren(node, depth) {
      if (depth > maxDepth) return null;
      const data = { id: node.id, name: node.name, type: node.type, visible: node.visible !== false };
      if ("children" in node && node.children) {
        data.children = node.children.map((child) => walkChildren(child, depth + 1)).filter(Boolean);
      }
      return data;
    }
    return {
      fileKey: figma.fileKey,
      fileName: figma.root.name,
      pages: figma.root.children.map((page) => ({
        id: page.id,
        name: page.name,
        children: page.children.map((child) => walkChildren(child, 1)).filter(Boolean)
      }))
    };
  }
  function getFileData(maxDepth) {
    function walk(node, depth) {
      if (depth > maxDepth) {
        return { id: node.id, name: node.name, type: node.type };
      }
      const data = {
        id: node.id,
        name: node.name,
        type: node.type,
        visible: node.visible !== false
      };
      if ("children" in node && node.children) {
        data.children = node.children.map((child) => walk(child, depth + 1));
      }
      return data;
    }
    return walk(figma.currentPage, 0);
  }
  async function getVariables() {
    if (!figma.variables || figma.editorType === "figjam" || figma.editorType === "slides") {
      return { collections: [] };
    }
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const result = [];
    for (const collection of collections) {
      const variables = [];
      for (const variableId of collection.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable) continue;
        variables.push(serializeVariable(variable));
      }
      result.push({
        id: collection.id,
        name: collection.name,
        modes: collection.modes,
        variables
      });
    }
    return { collections: result };
  }
  async function getComponents() {
    await ensureAllPagesLoaded();
    const components = figma.root.findAll((node) => node.type === "COMPONENT" || node.type === "COMPONENT_SET");
    return components.map((component) => ({
      id: component.id,
      name: component.name,
      type: component.type,
      description: component.description || "",
      key: component.type === "COMPONENT" ? component.key : void 0,
      variants: component.type === "COMPONENT_SET" && component.children ? component.children.map((variant) => ({ id: variant.id, name: variant.name, key: variant.key })) : [],
      componentProperties: "componentPropertyDefinitions" in component ? component.componentPropertyDefinitions : {}
    }));
  }
  function getStyles() {
    const styles = [];
    for (const style of figma.getLocalPaintStyles()) {
      styles.push({
        id: style.id,
        name: style.name,
        type: style.type,
        styleType: "FILL",
        description: style.description,
        value: style.paints
      });
    }
    for (const style of figma.getLocalTextStyles()) {
      styles.push({
        id: style.id,
        name: style.name,
        type: style.type,
        styleType: "TEXT",
        description: style.description,
        value: {
          fontName: style.fontName,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing
        }
      });
    }
    for (const style of figma.getLocalEffectStyles()) {
      styles.push({
        id: style.id,
        name: style.name,
        type: style.type,
        styleType: "EFFECT",
        description: style.description,
        value: style.effects
      });
    }
    return styles;
  }
  function getStickies() {
    return figma.currentPage.findAll((node) => node.type === "STICKY").map((sticky) => ({
      id: sticky.id,
      text: sticky.text ? sticky.text.characters : "",
      authorName: sticky.authorName || null,
      fills: sticky.fills,
      x: sticky.x,
      y: sticky.y,
      width: sticky.width,
      height: sticky.height
    }));
  }
  async function getComponentImage(nodeId, format) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    const validated = validateScreenshotParams({ format, scale: 2 });
    if (!validated.ok) {
      throw new Error(validated.error.message);
    }
    if (!("exportAsync" in node)) {
      throw new Error(`Node ${nodeId} does not support export`);
    }
    const bytes = await node.exportAsync({
      format: validated.value.format,
      constraint: { type: "SCALE", value: validated.value.scale }
    });
    return {
      base64: figma.base64Encode(bytes),
      format: validated.value.format
    };
  }
  async function createNode(params) {
    const { type, name, x, y, width, height, parentId } = params;
    let node;
    switch (type) {
      case "FRAME":
        node = figma.createFrame();
        break;
      case "RECTANGLE":
        node = figma.createRectangle();
        break;
      case "TEXT":
        node = figma.createText();
        await safeLoadFont({ family: "Inter", style: "Regular" });
        node.characters = String(params.text || "");
        break;
      case "ELLIPSE":
        node = figma.createEllipse();
        break;
      case "LINE":
        node = figma.createLine();
        break;
      default:
        throw new Error(`Unsupported node type: ${String(type)}`);
    }
    if (name) node.name = String(name);
    const xNum = optionalFiniteNumber(x);
    const yNum = optionalFiniteNumber(y);
    if (xNum !== null) node.x = xNum;
    if (yNum !== null) node.y = yNum;
    const wNum = optionalFiniteNumber(width);
    const hNum = optionalFiniteNumber(height);
    if (wNum !== null && hNum !== null && "resize" in node) node.resize(wNum, hNum);
    if (params.fills && "fills" in node) node.fills = params.fills;
    if (parentId) {
      const parent = await figma.getNodeByIdAsync(String(parentId));
      if (parent && "appendChild" in parent) {
        parent.appendChild(node);
      }
    }
    return serializeSelectionNode(node);
  }
  async function updateNode(params) {
    const node = await figma.getNodeByIdAsync(String(params.nodeId || ""));
    if (!node) {
      throw new Error(
        JSON.stringify({ code: "E_NODE_NOT_FOUND", message: "Node not found: " + String(params.nodeId), retryable: false })
      );
    }
    const serializedBefore = serializeSelectionNode(node);
    const currentVersion = nodeFingerprint(serializedBefore);
    const expectedVersion = typeof params.expectedVersion === "string" ? params.expectedVersion : null;
    if (expectedVersion !== null && expectedVersion !== currentVersion) {
      throw new Error(
        JSON.stringify({
          code: "E_NODE_VERSION_CONFLICT",
          message: "updateNode: node changed since last read",
          detail: { expected: expectedVersion, current: currentVersion, nodeId: node.id },
          retryable: true
        })
      );
    }
    const properties = params.properties || {};
    for (const [key, value] of Object.entries(properties)) {
      switch (key) {
        case "name":
          node.name = String(value);
          break;
        case "x": {
          const n = optionalFiniteNumber(value);
          if (n !== null && "x" in node) node.x = n;
          break;
        }
        case "y": {
          const n = optionalFiniteNumber(value);
          if (n !== null && "y" in node) node.y = n;
          break;
        }
        case "width": {
          const n = optionalFiniteNumber(value);
          if (n !== null && "resize" in node) {
            const lm = node;
            lm.resize(n, lm.height);
          }
          break;
        }
        case "height": {
          const n = optionalFiniteNumber(value);
          if (n !== null && "resize" in node) {
            const lm = node;
            lm.resize(lm.width, n);
          }
          break;
        }
        case "visible":
          if ("visible" in node) node.visible = Boolean(value);
          break;
        case "opacity": {
          const n = optionalFiniteNumber(value);
          if (n !== null && "opacity" in node) node.opacity = n;
          break;
        }
        case "rotation": {
          const n = optionalFiniteNumber(value);
          if (n !== null && "rotation" in node) node.rotation = n;
          break;
        }
        case "characters":
          if (node.type === "TEXT") {
            await loadTextNodeFonts(node);
            node.characters = String(value);
          }
          break;
        case "fills":
          if ("fills" in node) node.fills = value;
          break;
      }
    }
    const serializedAfter = serializeSelectionNode(node);
    return __spreadProps(__spreadValues({}, serializedAfter), { version: nodeFingerprint(serializedAfter) });
  }
  async function loadTextNodeFonts(node) {
    if (!node || node.type !== "TEXT") return;
    const characters = node.characters || "";
    if (!characters.length) {
      const fontName = node.fontName;
      if (fontName && fontName !== figma.mixed && typeof fontName === "object") {
        const fn = fontName;
        if (typeof fn.family === "string" && typeof fn.style === "string") {
          await safeLoadFont({ family: fn.family, style: fn.style });
        }
      }
      return;
    }
    const fonts = node.getRangeAllFontNames(0, characters.length);
    const uniqueFonts = /* @__PURE__ */ new Map();
    for (const font of fonts) {
      if (!font || font === figma.mixed) continue;
      if (typeof font !== "object") continue;
      const fn = font;
      if (typeof fn.family !== "string" || typeof fn.style !== "string") continue;
      uniqueFonts.set(`${fn.family}::${fn.style}`, { family: fn.family, style: fn.style });
    }
    await Promise.all(Array.from(uniqueFonts.values()).map((font) => safeLoadFont(font)));
  }
  async function deleteNode(nodeId) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    node.remove();
    return { deleted: nodeId };
  }
  async function setSelection(nodeIds) {
    const nodes = [];
    for (const id of nodeIds) {
      const node = await figma.getNodeByIdAsync(id);
      if (node && "parent" in node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
        nodes.push(node);
      }
    }
    figma.currentPage.selection = nodes;
    return { selected: nodes.length };
  }
  async function navigateTo(nodeId) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    if (node.type === "DOCUMENT" || node.type === "PAGE") {
      throw new Error(`Cannot navigate into document/page root: ${nodeId}`);
    }
    figma.viewport.scrollAndZoomIntoView([node]);
    return { navigated: nodeId };
  }
  async function captureScreenshot(params) {
    const node = params.nodeId ? await figma.getNodeByIdAsync(String(params.nodeId)) : figma.currentPage;
    if (!node) {
      throw new Error(`Node not found: ${String(params.nodeId)}`);
    }
    const validated = validateScreenshotParams({ format: params.format, scale: params.scale });
    if (!validated.ok) {
      throw new Error(validated.error.message);
    }
    const { format, scale } = validated.value;
    if (!("exportAsync" in node)) {
      throw new Error(`Node ${String(params.nodeId)} does not support export`);
    }
    const bytes = await node.exportAsync({
      format,
      constraint: { type: "SCALE", value: scale }
    });
    return {
      image: {
        base64: figma.base64Encode(bytes),
        format,
        scale,
        byteLength: bytes.length,
        node: {
          id: node.id,
          name: node.name,
          type: node.type
        },
        bounds: "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null
      }
    };
  }
  const SCRATCH_TOKEN_COLLECTION = "Mémoire E2E Scratch";
  const SCRATCH_TOKEN_PREFIX = "memoire/e2e/";
  async function pushTokens(params) {
    var _a, _b, _c;
    const tokens = Array.isArray(params.tokens) ? params.tokens : [];
    const createMissing = params.createMissing === true;
    const collectionName = typeof params.collectionName === "string" && params.collectionName.trim() ? params.collectionName.trim() : null;
    const canCreateMissing = createMissing && collectionName === SCRATCH_TOKEN_COLLECTION;
    if (createMissing && !canCreateMissing) {
      throw new Error(
        JSON.stringify({
          code: "E_UNSAFE_TOKEN_CREATE",
          message: `pushTokens can only create missing variables in ${SCRATCH_TOKEN_COLLECTION}`,
          retryable: false
        })
      );
    }
    let updated = 0;
    let created = 0;
    const notFound = [];
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const index = /* @__PURE__ */ new Map();
    const fetchPromises = [];
    for (let ci = 0; ci < collections.length; ci += 1) {
      const col = collections[ci];
      const modeId = col.modes[0] ? col.modes[0].modeId : null;
      if (!modeId) continue;
      const varIds = col.variableIds;
      for (let vi = 0; vi < varIds.length; vi += 1) {
        const varId = varIds[vi];
        fetchPromises.push(
          figma.variables.getVariableByIdAsync(varId).then((v) => v ? { variable: v, modeId } : null)
        );
      }
    }
    const fetched = await Promise.all(fetchPromises);
    for (let i = 0; i < fetched.length; i += 1) {
      const entry = fetched[i];
      if (entry && entry.variable && typeof entry.variable.name === "string") {
        if (!index.has(entry.variable.name)) index.set(entry.variable.name, entry);
      }
    }
    let scratchCollection = null;
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (!token || !token.name) continue;
      let entry = index.get(token.name);
      if (!entry || !token.values) {
        if (!canCreateMissing || !token.name.startsWith(SCRATCH_TOKEN_PREFIX) || !token.values) {
          notFound.push(token.name);
          continue;
        }
        const firstValueForType = Object.values(token.values)[0];
        const resolvedType = inferVariableResolvedType(firstValueForType);
        if (!resolvedType) {
          notFound.push(token.name);
          continue;
        }
        scratchCollection = scratchCollection != null ? scratchCollection : findOrCreateScratchCollection(collections, collectionName);
        const modeId = scratchCollection.defaultModeId || ((_a = scratchCollection.modes[0]) == null ? void 0 : _a.modeId);
        if (!modeId) {
          notFound.push(token.name);
          continue;
        }
        const variable = figma.variables.createVariable(token.name, scratchCollection, resolvedType);
        entry = { variable, modeId };
        index.set(token.name, entry);
        created += 1;
      }
      const firstValue = Object.values(token.values)[0];
      const parsedColor = parseColorValue(firstValue);
      if (parsedColor) {
        entry.variable.setValueForMode(entry.modeId, parsedColor);
      } else {
        entry.variable.setValueForMode(entry.modeId, firstValue);
      }
      updated += 1;
    }
    return {
      updated,
      created,
      notFound,
      total: tokens.length,
      collectionName: (_c = (_b = scratchCollection == null ? void 0 : scratchCollection.name) != null ? _b : collectionName) != null ? _c : void 0
    };
  }
  function findOrCreateScratchCollection(collections, collectionName) {
    let collection = null;
    for (const candidate of collections) {
      if (candidate.name === collectionName) {
        collection = candidate;
        break;
      }
    }
    if (!collection) {
      collection = figma.variables.createVariableCollection(collectionName);
      collections.push(collection);
    }
    collection.hiddenFromPublishing = true;
    return collection;
  }
  function inferVariableResolvedType(value) {
    if (parseColorValue(value)) return "COLOR";
    if (typeof value === "number") return "FLOAT";
    if (typeof value === "string") return "STRING";
    if (typeof value === "boolean") return "BOOLEAN";
    return null;
  }
})();
