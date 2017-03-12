var config = require("./config.js");
var shopify = new Shopify({
  shopName: "namdevstore",
  apiKey: config.api_key,
  accessToken: config.secret
});
