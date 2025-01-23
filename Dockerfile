FROM node:18-slim

# 创建并切换到 /app 目录
WORKDIR /app

# 复制 package.json用于依赖安装
COPY package.json ./

# 安装依赖
RUN npm install

# 复制剩余项目文件
COPY . .

# 如果需要其他环境变量，可以在这里 ENV 或留给 docker-compose.yml
# ENV HTTP_PORT=9876

# 暴露端口（与 package.json / server.js 中一致）
EXPOSE 9876

# 容器启动时执行
CMD ["npm", "start"]
