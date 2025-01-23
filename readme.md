## emby stream router
大多数代码来自 ChatGPT-o1
### 实现
- [x] 基于emby用户的路线选择API
- [x] 根据deviceId获取用户路线，将emby stream重定向
- [x] telegram通知功能
- [x] 同一用户访问太频繁发送通知，防止扫库(50次/小时)

### 原理
nginx拦截emby请求，根据deviceId获取用户路线，将emby stream 302重定向到对应路线。

```理论上可以拦截更多emby请求，将该项目作为emby的中间件```

## 使用
### docker运行【推荐】
```shell
# docker build -t "emby-router:latest" . --build-arg HTTP_PROXY=http://172.17.0.1:2333 // 使用代理加速build
docker build -t "emby-router:latest" .

vim docker-compose.yml // 修改配置,参考参数说明

docker compose up -d
```
### 本地运行
```shell
npm install
cp .env.example .env
vim .env // 修改配置,参考参数说明
node index.js
```

### 参数说明
| 参数                | 说明               | 备注                        |
|-------------------|------------------|---------------------------|
| HTTP_PORT         | http监听端口         | 默认 9876，docker下运行请修改映射端口  |
| REDIS_URL         | redis地址          | 默认 redis://127.0.0.1:6379 |
| TELEGRAM_BOT_ID   | telegram bot id  | 通知使用，不填不通知                |
| TELEGRAM_CHAT_ID  | telegram chat id | 通知使用，不填不通知                |
| EMBY_API_URL      | emby api地址       | 必填                        |
| EMBY_API_KEY      | emby api key     | 必填                        |
| KT_SALT           | 加密salt           | 必填                        |
| ROUTERS_JSON_DATA | 路由配置             | 必填，json字符串，参考默认配置         |
| DEFAULT_ROUTE     | 默认路由             | 默认 gd-1                   |
| DEFAULT_SOURCE    | 默认源              | 非法访问时返回的stream，不填返回404    |
