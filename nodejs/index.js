var express = require('express');
var app = express();

var config = require("./config.js");
var Shopify = require('shopify-api-node');
var shopify = new Shopify({
  shopName: "namdevstore",
  apiKey: config.api_key,
  password: config.secret
});

app.get("/", function(req, res) {
  res.send("Hello");
});

app.listen("3000", function() {
  console.log("Running on 3000");
});
