const Redis = require( 'ioredis')
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

class KV {
  constructor(tableName='') {
    this.prefix="embyRouter"
    this.tableName = tableName
    this.redis = redis;
  }
  _getKey(key) {
    return this.tableName ? `${this.prefix}:${this.tableName}:${key}` : `${this.prefix}:${key}`;
  }
  async get(key) {
    return this.redis.get(this._getKey((key)));
  }
  async put(key, value, params = null) {
    if (params && params.expirationTtl) {
      return this.redis.set(this._getKey((key)), value, 'EX', params.expirationTtl);
    }
    return this.redis.set(this._getKey((key)), value);
  }
  async delete(key) {
    return this.redis.del(this._getKey(key));
  }
}
module.exports = KV;
