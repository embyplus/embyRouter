const axios = require("axios");
const KV = require("./kv");

class Emby {
  constructor(apiUrl = "", apiKey = "", enableCache = true) {
    this.api = new EmbyApi(apiUrl, apiKey);
    this.kv = new KV("embyApi");
    this.enableCache = enableCache;
  }

  async getOrFetch(cacheKey, fetchFn, cacheTil = null) {
    // 如果开启缓存就先尝试读取缓存数据
    if (this.enableCache) {
      const cacheData = await this.kv.get(cacheKey);
      if (cacheData) {
        return JSON.parse(cacheData);
      }
    }

    // 缓存未命中或未启用，调用 fetchFn
    const response = await fetchFn();
    // 需要根据你实际的请求结构来判断
    if (!response || response.status !== 200) {
      return null;
    }
    let cache = true;
    const cacheKeyMainTitle = cacheKey.split("_")[0];
    if (cacheKeyMainTitle === "deviceInfo") {
      if (!response.data || !response.data["LastUserId"]) {
        cache = false;
      }
    }
    // 如果开启缓存且缓存条件满足，则写入缓存
    if (this.enableCache && cache) {
      await this.kv.put(
        cacheKey,
        JSON.stringify(response.data),
        cacheTil ? { expirationTtl: cacheTil } : null
      );
    }
    return response.data;
  }

  async getPlaybackInfo(itemId, userId = "", mediaSourceId = "") {
    const cacheKey = `playbackInfo_${itemId}_${userId}_${mediaSourceId}`;
    return this.getOrFetch(
      cacheKey,
      async () => {
        let path = `/Items/${itemId}/PlaybackInfo`;
        if (userId) {
          path += `?UserId=${userId}`;
        }
        if (mediaSourceId) {
          path += `&MediaSourceId=${mediaSourceId}`;
        }
        return await this.api.get(path);
      },
      86400
    );
  }
  async getDeviceInfo(deviceId) {
    const cacheKey = `deviceInfo_${deviceId}`;
    return this.getOrFetch(cacheKey, async () => {
      return await this.api.get(`/Devices/Info?Id=${deviceId}`);
    });
  }
  async checkApiKey(apiKey) {
    const cacheKey = `apiKey_${apiKey}`;
    return this.getOrFetch(cacheKey, async () => {
      return await this.api.get(`/System/Info`, false);
    });
  }
}
class EmbyApi {
  constructor(apiUrl = "", apiKey = "") {
    this.apiUrl = apiUrl || process.env.EMBY_API_URL;
    this.apiKey = apiKey || process.env.EMBY_API_KEY;
  }
  getEmbyPath(path, auth = true) {
    path = this.apiUrl + path;
    if (auth) {
      if (path.includes("?")) {
        path += "&api_key=" + this.apiKey;
      } else {
        path += "?api_key=" + this.apiKey;
      }
    }
    return path;
  }
  async get(path, auth = true) {
    return await axios.get(this.getEmbyPath(path, auth));
  }
  async post(path, data) {
    return await axios.post(this.getEmbyPath(path), data);
  }
  async put(path, data) {
    return await axios.put(this.getEmbyPath(path), data);
  }
  async delete(path) {
    return await axios.delete(this.getEmbyPath(path));
  }
}

module.exports = Emby;
