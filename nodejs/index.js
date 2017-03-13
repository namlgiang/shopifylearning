var config = require("./config.js");
var Shopify = require('shopify-api-node');
var shopify = new Shopify({
  shopName: "namdevstore",
  apiKey: config.api_key,
  password: config.secret
});
