var express = require('express');
var app = express();

var config = require("./config.js");
var Shopify = require('shopify-api-node');
var shopify = new Shopify({
  shopName: "namdevstore",
  apiKey: config.api_key,
  password: config.secret
});

app.use(express.static('public'))

app.listen("80", function() {
  console.log("Running on 80");
});
