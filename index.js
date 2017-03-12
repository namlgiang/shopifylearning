var config = require("./config.js");
var express = require('express');
var app = express();

app.get('/', function (req, res) {
  res.send('api_key: '+config.api_key+'<br>secret: '+config.secret);
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
});
