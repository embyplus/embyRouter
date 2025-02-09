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
        try {
          return JSON.parse(cacheData);
        } catch (err) {
          console.error(`缓存数据解析失败：${err}，准备重新拉取数据`);
          // 清理失效缓存（
          await this.kv.put(cacheKey, "", { expirationTtl: 0 });
        }
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
    try {
      const result = await axios.get(this.getEmbyPath(path, auth));
      return result;
    } catch (error) {
      console.error(`axios get 请求出错：${error.message}`);
      return null;
    }
  }
  async post(path, data) {
    try {
      const result = await axios.post(this.getEmbyPath(path), data);
      return result;
    } catch (error) {
      console.error(`axios post 请求出错：${error.message}`);
      return null;
    }
  }
  async put(path, data) {
    try {
      const result = await axios.put(this.getEmbyPath(path), data);
      return result;
    } catch (error) {
      console.error(`axios put 请求出错：${error.message}`);
      return null;
    }
  }
  async delete(path) {
    try {
      const result = await axios.delete(this.getEmbyPath(path));
      return result;
    } catch (error) {
      console.error(`axios delete 请求出错：${error.message}`);
      return null;
    }
  }
}

module.exports = Emby;
