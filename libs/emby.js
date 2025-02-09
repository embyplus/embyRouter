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
        const queryParams = new URLSearchParams();
        if (userId) {
          queryParams.set("UserId", userId);
        }
        if (mediaSourceId) {
          queryParams.set("MediaSourceId", mediaSourceId);
        }
        const queryString = queryParams.toString();
        const path = `/Items/${itemId}/PlaybackInfo${
          queryString ? "?" + queryString : ""
        }`;
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
    try {
      const url = new URL(path, this.apiUrl);
      if (auth) {
        url.searchParams.set("api_key", this.apiKey);
      }
      return url.toString();
    } catch (error) {
      console.error(`URL 拼接失败啦：${error.message}`);
      throw new Error(`URL 拼接失败啦：${error.message}`);
    }
  }

  // 新增私有方法 _request ，统一处理 axios 请求逻辑
  async _request(method, path, data = null, auth = true) {
    const url = this.getEmbyPath(path, auth);
    try {
      const response = await axios({
        method,
        url,
        data,
      });
      return response;
    } catch (error) {
      console.error(
        `axios ${method.toUpperCase()} 请求出错啦：${error.message}`
      );
      throw error;
    }
  }

  async get(path, auth = true) {
    return this._request("get", path, null, auth);
  }

  async post(path, data) {
    return this._request("post", path, data);
  }

  async put(path, data) {
    return this._request("put", path, data);
  }

  async delete(path) {
    return this._request("delete", path);
  }
}

module.exports = Emby;
