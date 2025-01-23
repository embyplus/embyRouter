const ROUTER_TYPE_REAL_PATH = 'GD' // 真实路径
const ROUTER_TYPE_REVERSE_PROXY = 'RP' // 反代
const DEFAULT_ROUTE = process.env.DEFAULT_ROUTE;

function routers() {
  return JSON.parse(process.env.ROUTERS_JSON_DATA);
}
function getRouter(index= null) {
  index = index ? index : DEFAULT_ROUTE;
  let router = null;
  routers().forEach((r) => {
    if (r.index === index) {
      router = r;
    }
  });
  return router;
}
module.exports = {
  ROUTER_TYPE_REAL_PATH,
  ROUTER_TYPE_REVERSE_PROXY,
  DEFAULT_ROUTE,
  routers,
  getRouter,
}
