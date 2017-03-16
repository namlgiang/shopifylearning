var express = require('express');
var querystring= require('querystring');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var crypto = require('crypto');
var bodyParser = require('body-parser');
var request = require('request');
var config = require('./settings')
var session = require('express-session')
var app = express();

config.oauth.scope = "read_script_tags,write_script_tags";

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({secret: 'keyboard cat'}));
app.use(express.static(path.join(__dirname, 'public')));

// Shopify Authentication

// This function initializes the Shopify OAuth Process
// The template in views/embedded_app_redirect.ejs is rendered
app.get('/shopify_auth', function(req, res) {
    if (req.query.shop) {
        req.session.shop = req.query.shop;
        res.render('embedded_app_redirect', {
            shop: req.query.shop,
            api_key: config.oauth.api_key,
            scope: config.oauth.scope,
            redirect_uri: config.oauth.redirect_uri
        });
    }
})

// After the users clicks 'Install' on the Shopify website, they are redirected here
// Shopify provides the app the is authorization_code, which is exchanged for an access token
app.get('/access_token', verifyRequest, function(req, res) {
    if (req.query.shop) {
        var params = {
            client_id: config.oauth.api_key,
            client_secret: config.oauth.client_secret,
            code: req.query.code
        }
        var req_body = querystring.stringify(params);
        console.log(req_body)
        request({
            url: 'https://' + req.query.shop + '/admin/oauth/access_token',
            method: "POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(req_body)
            },
            body: req_body
        },
        function(err,resp,body) {
            console.log(body);
            body = JSON.parse(body);
            req.session.access_token = body.access_token;
            console.log(req.session);
            res.redirect('/');
        })
    }
})

// Renders the install/login form
app.get('/install', function(req, res) {
    res.render('app_install', {
        title: 'Shopify Embedded App'
    });
})

// Renders content for a modal
app.get('/modal_content', function(req, res) {
    res.render('modal_content', {
        title: 'Embedded App Modal'
    });
})

// The home page, checks if we have the access token, if not we are redirected to the install page
// This check should probably be done on every page, and should be handled by a middleware
app.get('/', function(req, res) {
    if (req.session.access_token) {
        res.render('index', {
            title: 'Home',
            api_key: config.oauth.api_key,
            shop: req.session.shop
        });
    } else if(req.query.shop) {
      req.query.shop = req.query.shop.replace(/.myshopify.com/g, "");
      req.session.shop = req.query.shop;
      res.render('embedded_app_redirect', {
          shop: req.query.shop,
          api_key: config.oauth.api_key,
          scope: config.oauth.scope,
          redirect_uri: config.oauth.redirect_uri
      });
    }
    else {
      res.redirect('/install');
    }
})

app.get('/add_product', function(req, res) {
    res.render('add_product', {
        title: 'Add A Product',
        api_key: config.oauth.api_key,
        shop: req.session.shop,
    });
})

app.get('/products', function(req, res) {
    var next, previous, page;
    page = req.query.page ? ~~req.query.page:1;

    next = page + 1;
    previous = page == 1 ? page : page - 1;

    request.get({
        url: 'https://' + req.session.shop + '.myshopify.com/admin/products.json?limit=5&page=' + page,
        headers: {
            'X-Shopify-Access-Token': req.session.access_token
        }
    }, function(error, response, body){
        if(error)
            return next(error);
        body = JSON.parse(body);
        res.render('products', {
            title: 'Products',
            api_key: config.oauth.api_key,
            shop: req.session.shop,
            next: next,
            previous: previous,
            products: body.products
        });
    })
})

app.post('/products', function(req, res) {
    data = {
     product: {
            title: req.body.title,
            body_html: req.body.body_html,
            images: [
                {
                    src: req.body.image_src
                }
            ],
            vendor: "Vendor",
            product_type: "Type"
        }
    }
    req_body = JSON.stringify(data);
    console.log(data);
    console.log(req_body);
    request({
        method: "POST",
        url: 'https://' + req.session.shop + '.myshopify.com/admin/products.json',
        headers: {
            'X-Shopify-Access-Token': req.session.access_token,
            'Content-type': 'application/json; charset=utf-8'
        },
        body: req_body
    }, function(error, response, body){
        if(error)
            return next(error);
        console.log(body);
        body = JSON.parse(body);
        if (body.errors) {
            return res.json(500);
        }
        res.json(201);
    })
})

function verifyRequest(req, res, next) {
    var map = JSON.parse(JSON.stringify(req.query));
    delete map['signature'];
    delete map['hmac'];

    var message = querystring.stringify(map);
    var generated_hash = crypto.createHmac('sha256', config.oauth.client_secret).update(message).digest('hex');
    console.log(generated_hash);
    console.log(req.query.hmac);
    if (generated_hash === req.query.hmac) {
        next();
    } else {
        return res.json(400);
    }

}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

// var server = app.listen(3000, function() {
//   console.log('Express server listening on port ' + server.address().port);
// });


var leStore = require('le-store-certbot').create({
  configDir: '/etc/letsencrypt',          // or /etc/letsencrypt or wherever
  privkeyPath: ':configDir/live/myapp.techsfeed.com/privkey.pem',          //
  fullchainPath: ':configDir/live/myapp.techsfeed.com/fullchain.pem',      // Note: both that :configDir and :hostname
  certPath: ':configDir/live/myapp.techsfeed.com/cert.pem',                //       will be templated as expected by
  chainPath: ':configDir/live/myapp.techsfeed.com/chain.pem',              //       node-letsencrypt
  workDir: '/etc/letsencrypt/var/lib',
  logsDir: '/etc/letsencrypt/var/log',
  webrootPath: '/etc/letsencrypt/srv/www/myapp.techsfeed.com/.well-known/acme-challenge',
  debug: false
});

// returns an instance of node-letsencrypt with additional helper methods
var lex = require('letsencrypt-express').create({
  // set to https://acme-v01.api.letsencrypt.org/directory in production
  //server: 'staging',
  server: 'https://acme-v01.api.letsencrypt.org/directory',

  // If you wish to replace the default plugins, you may do so here
  //
  challenges: { 'http-01': require('le-challenge-fs').create({ webrootPath: '/etc/letsencrypt/var/acme-challenges' }) },
  store: leStore,


  // You probably wouldn't need to replace the default sni handler
  // See https://github.com/Daplie/le-sni-auto if you think you do
  //, sni: require('le-sni-auto').create({})

  approveDomains: approveDomains
});

function approveDomains(opts, certs, cb) {
  // TODO - verify domain

  if (certs) {
     opts.domains = certs.altnames;
   }
  else {
     opts.email = 'namlgiang@gmail.com';
     opts.agreeTos = true;
  }

  cb(null, { options: opts, certs: certs });
}

// app.use(express.static('public'));

// handles acme-challenge and redirects to http
require('http').createServer(lex.middleware(require('redirect-https')())).listen(80, function () {
  console.log("Listening for ACME http-01 challenges on", this.address());
});

server = require('https').createServer(lex.httpsOptions, lex.middleware(app)).listen(443, function () {
  console.log("Listening for ACME tls-sni-01 challenges and serve app on", this.address());
});

module.exports = app;
