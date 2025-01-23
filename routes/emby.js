const express = require('express');
const {getRouter, ROUTER_TYPE_REAL_PATH, ROUTER_TYPE_REVERSE_PROXY} = require("../libs/datastore");
const KV = require('../libs/kv');
const {telegramNotify} = require("../libs/telegram");
const router = express.Router();
const crypto = require('crypto');
const Emby = require("../libs/emby");

// /emby/Videos/***/stream.mkv /emby/Videos/***/stream.mp4
router.get('/emby/Videos/:itemId/stream.mkv', handleStream);
router.get('/emby/Videos/:itemId/stream.mp4', handleStream);
// /emby/videos/***/original.mp4 /emby/videos/***/original.mkv
router.get('/emby/videos/:itemId/original.mp4', handleStream);
router.get('/emby/videos/:itemId/original.mkv', handleStream);
// /Videos/***/stream.mkv /Videos/***/stream.mp4
router.get('/Videos/:itemId/stream.mkv', handleStream);
router.get('/Videos/:itemId/stream.mp4', handleStream);
// /videos/***/original.mp4 /videos/***/original.mkv
router.get('/videos/:itemId/original.mp4', handleStream);
router.get('/videos/:itemId/original.mkv', handleStream);
// /emby/Items/***/Download
router.get('/emby/Items/:itemId/Download', handleStream);

// ========== 其余请求 => 404 ==========
router.all('*', (req, res) => {
  return res.status(404);
});

const embyLimitKV = new KV('embyLimit');
const userRouterKV = new KV('userRouter');

async function checkEmbyUserLimit(embyId, itemId) {
  const MAX_TIMES_IN_AN_HOUR = 50;
  const ONE_HOUR_IN_SECONDS = 3600;
  const now = Math.floor(Date.now() / 1000);

  // 1) 从 Redis KV 获取用户最近播放记录（JSON 数组）
  let recordStr = await embyLimitKV.get(embyId);
  let recordArr = recordStr ? JSON.parse(recordStr) : [];

  // 2) 移除已超过 1 小时的记录（实现滑动窗口）
  recordArr = recordArr.filter(entry => (now - entry.firstTime) < ONE_HOUR_IN_SECONDS);

  // 3) 若剩余记录数已 >= 50，表示超限
  if (recordArr.length >= MAX_TIMES_IN_AN_HOUR) {
    return true;
  }

  // 4) 如果在记录中已存在此 itemId，说明重复播放，不计数 => 未超限
  if (recordArr.some(entry => entry.itemId === itemId)) {
    return false;
  }

  // 5) 新的 itemId，添加到记录
  recordArr.push({ firstTime: now, itemId });

  // 6) 写回到 KV，并设置过期时间（可根据需要调整）
  //    这里设置 3600 秒后过期，意味着如果 1 小时内无新操作，则整条记录自动过期
  //    也可以不设 TTL，全靠逻辑来做定期过滤
  await embyLimitKV.put(embyId, JSON.stringify(recordArr), { expirationTtl: ONE_HOUR_IN_SECONDS });

  // 未超限
  return false;
}

function getApiKeyOrThrow(req) {
  let apiKey = req.query.api_key || req.query.X_Emby_Token || req.query.X_Emby_Token || null;
  if (apiKey == null) {
    // 检查header
    apiKey = req.headers['x-emby-token'] ? req.headers['x-emby-token'] : req.headers['api_key'];
    if (! apiKey) {
      throw new Error('Invalid api')
    }
  }
  return apiKey
}
function getItemIdOrThrow(req) {
  const itemId = parseInt(req.params.itemId);
  if (! itemId) {
    throw new Error('Item not found.')
  }
  return itemId
}
function getMediaSourceId(req) {
  return req.params.MediaSourceId || req.params.MediaSourceId || null;
}
function getDeviceIdOrThrow(req) {
  let deviceId = req.query.DeviceId || req.query.deviceId || null;
  if (! deviceId) {
    let headersMap = new Map(req.headers);
    headersMap.forEach( (v, k) => {
      if (k.toLowerCase().endsWith("authorization")) {
        let result = /DeviceId\=\"([A-Za-z0-9\-]+)\"/gi.exec(v);
        if (result.length > 1) {
          deviceId = result[1]
        }
      }
    });
  }
  if (! deviceId) {
    throw new Error('DeviceId not found.')
  }
  return deviceId;
}
function copyHeadersToReq(req, res) {
  const skipHeaders = [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
    'host' // 这个一般由反代服务器自行指定，或保留服务端真实Host
  ];
  Object.entries(req.headers).forEach(([key, value]) => {
    // 跳过不需要复制的头
    if (skipHeaders.includes(key.toLowerCase())) {
      return;
    }
    res.setHeader(key, value);
  });
}

async function handleStream(req, res) {
  try {
    const apiKey = getApiKeyOrThrow(req)
    const itemId = getItemIdOrThrow(req)
    const deviceId = getDeviceIdOrThrow(req)
    const mediaSourceId = getMediaSourceId(req)
    const embyClient = new Emby();
    const deviceInfo = await embyClient.getDeviceInfo(deviceId);
    if (! deviceInfo) {
      // 没传入deviceId
      await redirectToDefault(res);
      return
    }
    const embyId = deviceInfo['LastUserId'] || "unsupported_device_user";
    const isLimited = await checkEmbyUserLimit(embyId, itemId);
    if (isLimited) {
      telegramNotify(`Emby user ${embyId} reached the limit of 50 times per hour.`).catch(console.error);
      await redirectToDefault(res);
      return
    }
    const routeIndex = await userRouterKV.get(embyId);
    const embyRouter = routeIndex ? getRouter(routeIndex) : getRouter();
    let realUrl = '';
    let needKT = false;
    switch (embyRouter.type.toUpperCase()) {
      case ROUTER_TYPE_REAL_PATH:
        needKT = true;
        const userEmbyClient = new Emby('', apiKey);
        const playbackInfo = await userEmbyClient.getPlaybackInfo(itemId, embyId, mediaSourceId);
        let mediaPath = "";
        if (playbackInfo && playbackInfo.MediaSources.length > 0) {
          mediaPath = playbackInfo.MediaSources[0].Path;
        }
        if (! mediaPath) {
          await redirectToDefault(res);
          return
        }
        realUrl = embyRouter.url + mediaPath.replace("/GoogleDrive", "");
        break
      case ROUTER_TYPE_REVERSE_PROXY:
        const fullUrl = req.originalUrl;
        realUrl = embyRouter.url + fullUrl;
        break;
    }
    copyHeadersToReq(req, res);
    return redirect302(res, realUrl, needKT);
  } catch (e) {
    console.error(e)
    res.json({
      'code': 500,
      'error': e.message
    })
  }
}

function sha256(str) {
  // Buffer 处理：Node.js下可直接 update string，无需再手动encode
  const hash = crypto
    .createHash('sha256')
    .update(str, 'utf8')
    .digest('base64');

  // 与原逻辑保持一致，把 '/' 替换成 '_'，'+' 替换成 '-'
  return hash
    .replace(/\//g, '_')
    .replace(/\+/g, '-');
}
async function redirectToDefault(res) {
  const defaultMP4 = process.env.DEFAULT_SOURCE;
  if (defaultMP4) {
    return await redirect302(res, defaultMP4, false);
  } else {
    return res.status(404);
  }
}
async function redirect302(res, url, withKT = true) {
  if (withKT) {
    // 在 Node.js 中获取当前时间戳(秒)
    const t = Math.floor(Date.now() / 1000);
    // 计算 sha256
    const salt = process.env.KT_SALT || '123456789abcdef'
    const k = sha256(t + salt); // 简单的鉴权逻辑，需要与服务端约定好

    // 拼接到URL后面
    // 注意要保证 url 本身是否已经带有 query，可能需要用 & 或 ? 区分
    // 这里示例直接使用 ?t=xxx, 若 url 已有 ?，可做额外处理
    url += `?t=${t}&k=${k}`;
  }

  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers',
    'DNT,X-Mx-ReqToken,Keep-Alive,User-Agent,' +
    'X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization'
  );

  // 使用 Express 提供的重定向方法
  // res.redirect(status, url) -> 302 跳转
  // encodeURI(url) 可以确保中文、特殊字符被正确编码
  return res.redirect(302, encodeURI(url));
}


module.exports = router;

