const express = require( 'express');
require('dotenv').config();


const app = express();
// 全局中间件
app.use(express.json());

// nginx 反代问题：https://expressjs.com/en/guide/behind-proxies.html
app.set('trust proxy', 1);

// 路由
//   用户路线API
const apiRouter = require( './routes/api.js');
app.use('/api', apiRouter);
//   emby stream重定向
const embyRouter = require( './routes/emby.js');
app.use('/', embyRouter);

// 默认路由
app.use((req, res) => {
  res.send('hello world.');
});
const port = process.env.HTTP_PORT || 9876;
app.listen(port, () => {
  console.log(`Server is listening on http://127.0.0.1:${port}`);
});
