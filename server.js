#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT_DIR = __dirname;
const SETTINGS_PATH = path.join(ROOT_DIR, "config", "manual-settings.json");

const DEFAULTS = {
  server: {
    host: "127.0.0.1",
    port: 8090,
    maxBodyBytes: 1024 * 1024
  },
  paths: {
    mediaAlias: "../webwriter/zz-media-files",
    settings: "config/settings.json"
  }
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf"
};

function readSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const server = Object.assign({}, DEFAULTS.server, parsed && parsed.server && typeof parsed.server === "object" ? parsed.server : {});
    const paths = Object.assign({}, DEFAULTS.paths, parsed && parsed.paths && typeof parsed.paths === "object" ? parsed.paths : {});

    // Backward compatibility with previous single-key shape.
    if (!paths.mediaAlias && parsed && typeof parsed.mediaRoot === "string") {
      paths.mediaAlias = parsed.mediaRoot;
    }

    return { server, paths };
  } catch (_) {
    return { server: { ...DEFAULTS.server }, paths: { ...DEFAULTS.paths } };
  }
}

const SETTINGS = readSettings();
const HOST = String(process.env.WEBLAB_HOST || SETTINGS.server.host || DEFAULTS.server.host);
const PORT = Number(process.env.WEBLAB_PORT || SETTINGS.server.port || DEFAULTS.server.port);
const MAX_BODY_BYTES = Number(SETTINGS.server.maxBodyBytes || DEFAULTS.server.maxBodyBytes);
const MEDIA_ALIAS_DIR = path.resolve(ROOT_DIR, SETTINGS.paths.mediaAlias || DEFAULTS.paths.mediaAlias);
const APP_SETTINGS_PATH = path.resolve(ROOT_DIR, SETTINGS.paths.settings || DEFAULTS.paths.settings);

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text)
  });
  response.end(text);
}

function sendJson(response, statusCode, data) {
  const body = JSON.stringify(data, null, 2);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function readAppSettings() {
  const raw = fs.readFileSync(APP_SETTINGS_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return parsed;
}

function writeAppSettings(settings) {
  const parentDir = path.dirname(APP_SETTINGS_PATH);
  fs.mkdirSync(parentDir, { recursive: true });
  fs.writeFileSync(APP_SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

function handleSettingsGet(response) {
  try {
    sendJson(response, 200, readAppSettings());
  } catch (_) {
    sendJson(response, 200, {});
  }
}

function handleSettingsPost(request, response) {
  let body = "";
  let received = 0;

  request.on("data", (chunk) => {
    received += chunk.length;
    if (received > MAX_BODY_BYTES) {
      request.destroy();
      return;
    }
    body += chunk;
  });

  request.on("end", () => {
    if (received > MAX_BODY_BYTES) {
      sendJson(response, 413, { error: "Request body too large" });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(body || "{}");
    } catch (_) {
      sendJson(response, 400, { error: "Invalid JSON payload" });
      return;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      sendJson(response, 400, { error: "Settings payload must be a JSON object" });
      return;
    }

    try {
      writeAppSettings(parsed);
      sendJson(response, 200, parsed);
    } catch (_) {
      sendJson(response, 500, { error: "Unable to write settings file" });
    }
  });

  request.on("error", () => {
    sendJson(response, 500, { error: "Request stream failed" });
  });
}

function parseRangeHeader(rangeHeader, size) {
  if (typeof rangeHeader !== "string") {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return { invalid: true };
  }
  const startRaw = match[1];
  const endRaw = match[2];
  let start = null;
  let end = null;

  if (startRaw === "" && endRaw === "") {
    return { invalid: true };
  }

  if (startRaw !== "") {
    start = Number(startRaw);
    if (!Number.isInteger(start) || start < 0) {
      return { invalid: true };
    }
  }
  if (endRaw !== "") {
    end = Number(endRaw);
    if (!Number.isInteger(end) || end < 0) {
      return { invalid: true };
    }
  }

  if (start === null) {
    const suffixLength = end;
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return { invalid: true };
    }
    if (suffixLength >= size) {
      return { start: 0, end: size - 1 };
    }
    return { start: size - suffixLength, end: size - 1 };
  }

  if (end === null || end >= size) {
    end = size - 1;
  }
  if (start >= size || end < start) {
    return { invalid: true };
  }
  return { start, end };
}

function resolveStaticPath(pathname) {
  const requestPath = pathname === "/" ? "/lab/lab.html" : pathname;
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch (_) {
    return null;
  }
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(ROOT_DIR, normalized);
  if (!fullPath.startsWith(ROOT_DIR)) {
    return null;
  }
  return fullPath;
}

function resolveMediaAliasPath(pathname) {
  if (!pathname.startsWith("/zz-media-files/")) {
    return null;
  }
  const relativePath = pathname.slice("/zz-media-files/".length);
  let decodedRelative;
  try {
    decodedRelative = decodeURIComponent(relativePath);
  } catch (_) {
    return null;
  }
  const fullPath = path.resolve(MEDIA_ALIAS_DIR, decodedRelative);
  if (fullPath === MEDIA_ALIAS_DIR || fullPath.startsWith(MEDIA_ALIAS_DIR + path.sep)) {
    return fullPath;
  }
  return null;
}

function serveFile(fullPath, request, response) {
  if (!fullPath) {
    sendText(response, 403, "Forbidden");
    return;
  }

  fs.stat(fullPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }

    const extension = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";
    const headers = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes"
    };
    const range = parseRangeHeader(request.headers.range, stats.size);

    if (range && range.invalid) {
      response.writeHead(416, {
        ...headers,
        "Content-Range": "bytes */" + stats.size
      });
      response.end();
      return;
    }

    if (range) {
      const contentLength = range.end - range.start + 1;
      response.writeHead(206, {
        ...headers,
        "Content-Length": contentLength,
        "Content-Range": "bytes " + range.start + "-" + range.end + "/" + stats.size
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      fs.createReadStream(fullPath, { start: range.start, end: range.end }).pipe(response);
      return;
    }

    response.writeHead(200, {
      ...headers,
      "Content-Length": stats.size
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(fullPath).pipe(response);
  });
}

const server = http.createServer((request, response) => {
  if (!request || !request.url) {
    sendText(response, 400, "Bad request");
    return;
  }

  let parsed;
  try {
    parsed = new URL(request.url, "http://" + request.headers.host);
  } catch (_) {
    sendText(response, 400, "Bad request");
    return;
  }

  const pathname = parsed.pathname;
  if (pathname === "/api/settings") {
    if (request.method === "GET") {
      handleSettingsGet(response);
      return;
    }
    if (request.method === "POST") {
      handleSettingsPost(request, response);
      return;
    }
    sendText(response, 405, "Method Not Allowed");
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendText(response, 405, "Method Not Allowed");
    return;
  }

  const mediaPath = resolveMediaAliasPath(pathname);
  if (mediaPath) {
    serveFile(mediaPath, request, response);
    return;
  }

  const staticPath = resolveStaticPath(pathname);
  serveFile(staticPath, request, response);
});

server.listen(PORT, HOST, () => {
  process.stdout.write("weblab-server listening on http://" + HOST + ":" + PORT + "\n");
});
