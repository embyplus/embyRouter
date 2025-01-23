const express = require('express');
const KV = require("../libs/kv");
const {routers, getRouter} = require("../libs/datastore");

const router = express.Router();
const userRouterKV = new KV('userRouter');

// ========== 1) 返回全部路线 ==========
router.get('/route', async (req, res) => {
  return res.json(routers());
});

// ========== 2) 返回用户当前路线 ==========
router.get('/route/:userId', async (req, res) => {
  const userId = req.params.userId; // pathArray[1]

  let result = { index: process.env.DEFAULT_ROUTE};
  let currentIndex = await userRouterKV.get(userId);

  if (currentIndex !== null) {
    result.index = currentIndex;
  }
  return res.json(result);
});

// ========== 3) 设置用户路线 ==========
router.get('/route/:userId/:newIndex', async (req, res) => {
  const userId = req.params.userId;
  const newIndex = req.params.newIndex;
  try {
    if (! getRouter(newIndex)) {
      throw new Error('Invalid route index');
    }
  } catch (e) {
    return res.json({
      'code': 500,
      'error': e.message
    });
  }



  let oldCurrentIndex = await userRouterKV.get(userId);
  if (oldCurrentIndex !== null && oldCurrentIndex !== newIndex) {
    await userRouterKV.delete(userId);
  }
  await userRouterKV.put(userId, newIndex);

  res.json({ result: 200 });
});

// ========== 其余请求 => 404 ==========
router.all('*', (req, res) => {
  return res.status(404);
});

module.exports = router;
