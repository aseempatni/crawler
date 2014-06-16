var args = process.argv;
var http = require("http");
var request = require('request');
var mongoose = require('mongoose');
var cheerio = require('cheerio');
var colors = require('colors');
var phantom = require('phantom');
var events = require('events');
var mongoose = require('mongoose');
var fs = require('fs');
var parseString = require('xml2js').parseString;

var https = require('https'),
  key = 'AIzaSyCRlhvnFqzGWcKOWRH64Wi8Bu2NMja0csE';

//GET parameters
var qfindurls = false; // Whether add urls from www ranking

//Modes for fetching data
var alexaMode = true; // Whether get alexa data
var jsMode = true; // get resources (js)
var psidMode = true; // get PageSpeed insights for desktop
var psimMode = true; // get PageSpeed Insights for mobile

//config
var resTimeout = 60000; // Resource timeout
var pageSize = 1000; // Get data from wwwranking in slots of?
var pageNo = 10; // No of slots

var loadImage = true;
var live = true;

exports.init = function(file, isLive) {
  var configs = require(file);
  key = configs.googleAPI;
  qfindurls = configs.getNewUrls;
  alexaMode = configs.getAlexa;
  jsMode = configs.getJs;
  psidMode = configs.pageInsightD;
  psimMode = configs.pageInsightM;
  resTimeout = configs.resourceTimeOut;
  pageSize = configs.slots_NoOfUrlsToFetch;
  pageNo = configs.noOfSlots;
  loadImage = configs.screenShots;
  live = isLive;
}

// Configs yet to be written
var colName = 'thoupages'; // Collection name
var addwCheck = true; // Add to db with check if already exists
var qprint = false; // whether print database

// automated config
var query = {};
var noofpages = 4;
var slots = 2;
var executeInterval = 5000;

var emitter = new events.EventEmitter();

// live version required for serverLive.js
exports.liveServer = function(url, res) {
  res.writeHead(200, {
    "Content-Type": "application/json"
  });
  console.log('got request for -> ' + url);
  e = new Data({
    url: url
  });
  var crash = phantom.crash(url);
  crash.on('error', function() {
    e.crash = true;
    console.log('Crashed: '.red + crash.url);
    res.end(url + ' sucks :-P ' + 'It crashed!!\n');
  });
  findRes(e);
  addData(e);
  addgpsi(e, 'desktop');
  addgpsi(e, 'mobile');
  emitter.on('done', function() {
    res.end(JSON.stringify(e, null, 2) + '\n');
    /*
	    path = './'+e.capture;
	    console.log(path);
	    fs.readFile(path, function(error, file) {
		    if(error) console.log('Error reading file');
		    var imagedata = new Buffer(file).toString('base64');
		    res.write("hi there!<img src='data:my_pic.jpg;base64,"+imagedata+"'/>");
	    });
    	*/
  });
};

//Connect to db
db = require('./model/db'),
Data = mongoose.model(colName);
var con = mongoose.connection;
con.on('error', console.error.bind(console, 'connection error:'));
con.once('open', function callback() {

  /****************Most Important Calls***************/

  if (qprint) printData(Data);
  if (qfindurls) findUrl();
  if (!live) execute();

  /***************************************************/

});

function execute() {
  Data.find(query, function(err, arr) {
    var add = 0;
    if (noofpages == 0) noofpages = arr.length;
    console.log('total = ' + noofpages);
    timera = setInterval(function() {
      for (i = add; i < slots + add; i++) {
        if (i == noofpages) {
          console.log('timer stopped');
          clearInterval(timera);
          break;
        }
        e = arr[i];
        console.log('( %d ) ' + e.url.bold, i + 1);
        if (jsMode) findRes(e);
        if (psidMode) addgpsi(e, 'desktop');
        if (psimMode) addgpsi(e, 'mobile');
        if (alexaMode) addData(e);
      }
      add += slots;
    }, executeInterval);
  });
}

String.prototype.endsWith = function(suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};
String.prototype.contains = function(it) {
  return this.indexOf(it) != -1;
};

function testjs(url, type) {
  if (url.endsWith('.js')) return true;
  else if (url.contains('.js?')) return true;
  else if (type != null && type.contains('javascript')) return true;
  return false;
}

function testcss(url, type) {
  if (url.endsWith('.css')) return true;
  else if (url.contains('.css?')) return true;
  else if (type != null && type.contains('css')) return true;
  return false;
}

function testextjs(url, host) {
  if (url.contains(host)) return false;
  else return true;
}
url = require('url')
var gethost = function(href) {
  urlo = url.parse(href);
  return urlo.host;
}

  function testimg(url, type) {
    if (url.endsWith('.jpg')) return true;
    if (url.endsWith('.png')) return true;
    if (url.endsWith('.gif')) return true;
    return false;
  }

donecount = 0;

function findRes(e) {
  var pageurl = e.url;
  var crash = phantom.crash(pageurl);
  crash.once('error', function() {
    e.crash = true;
    console.error('Crashed: '.yellow + crash.url);
    console.error(pageurl + ' sucks :-P It crashed!!\n');
    if (!live) {
      e.save(function(err) {});
    }
  });
  if (loadImage == false) {
    arg = '--load-images=no';
  } else arg = '';

  phantom.create(arg, function(ph) {
    ph.onError = function(msg, trace) {
      var msgStack = ['PHANTOM ERROR: ' + msg];
      if (trace && trace.length) {
        msgStack.push('TRACE:');
        trace.forEach(function(t) {
          msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
        });
      }
      console.error(msgStack.join('\n'));
    };
    ph.createPage(function(page) {
      page.set('viewportSize', {
        width: 1366,
        height: 768
      });
      var jsarr = [];
      var cssarr = [];
      var extjsarr = [];
      var host = gethost(pageurl);
      page.set('onError', function(msg, trace) {
        //console.log('Found error: '+msg);
        var msgStack = ['ERROR: '.red + msg];
        if (trace && trace.length) {
          msgStack.push('TRACE:');
          trace.forEach(function(t) {
            msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
          });
        }
        // uncomment to log into the console 
        console.error(msgStack.join('\n'));
      });
      page.set('settings.userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/36.0.1944.0 Safari/537.36');
      page.set('settings.resourceTimeout', resTimeout);
      page.set('onResourceReceived', function(response) {
        if (response.stage == 'end') {
          var url = response.url;
          //		console.log(url);
          hosturl = gethost(url);
          type = response.contentType;
          if (testjs(url, type)) { // resource is js
            jsarr.push(url);
            if (testextjs(hosturl, host)) {
              extjsarr.push(url);
            }
          } else if (testcss(url, type)) { // resource is css
            cssarr.push(url);
          }
          // other
        }
      })
      page.set('onResourceError', function(resourceError) {
        console.log('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
        console.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
      });
      page.set('onNavigationRequested', function(url, type, willNavigate, main) {
        //  if(main) console.log('Trying to navigate to: ' + url);
        //  console.log('Caused by: ' + type);
        // 	console.log('Will actually navigate: ' + willNavigate);
      });
      page.open(pageurl, function(status) {
        if (status !== 'success') {
          console.log('Unable to load' + pageurl);
        }
        page.evaluate(function() {
          return document;
        }, function(document) {
          //now actually done

          e.title = document.title;
          if (loadImage == true) {
            var path = 'img/' + host;
            page.render('./' + path, {
              format: 'jpeg',
              quality: '60'
            });
            //console.log('page rendered at ' + path);
            e.capture = path + '.jpeg';
          }
          e.js = extjsarr;

          if (!live) {
            e.save(function(err) {
              if (err) return console.error(err);
              donecount++;
              console.info('Done '.green + donecount);
            });
          } else {
            emitter.emit('done');
          }

          console.log(e);
          ph.exit();
        });
      });
    });
  });
}

//find all the urls from wwwranking
//also calls addurl
function findUrl() {
  var url1 = "http://wwwranking.webdatacommons.org/Q/?pageIndex=";
  var url2 = "&pageSize=";

  j = 0;
  var timer = setInterval(function() {
    url3 = url1 + j + url2 + pageSize; //complete url
    console.log('url3 = ' + url3);
    download(url3, function(data) {
      if (data) {
        var json = JSON.parse(data);
        for (i = 0; i < pageSize; i++) {
          html = (json['data'][i]['harmonic']);
          $ = cheerio.load(html);
          link = $('a').attr('href');
          addUrls(link);
        }
      } else console.log("error");
      j++;
    });

    if (j == (pageNo - 1)) {
      clearInterval(timer);
      console.log('stopped fetching urls');
    }

  }, 10000)
}

//find ranks of all the urls present in the db
//also calls addData
var adone = 0;

function findData() {
  Data.find(function(err, all) {
    console.log(all.length);
    all.forEach(function(element, index, array) {

    })
  })
}

// Utility function that downloads a URL and invokes
// callback with the data.
function download(url, callback) {
  http.get(url, function(res) {
    var data = "";
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on("end", function() {
      callback(data);
    });
  }).on("error", function() {
    callback(null);
  });
}

function addgpsi(e, strategy) {
  var url = e.url;
  getgpsi(url, strategy, function(data) {
    if (data) {
      var json = JSON.parse(data);
      if (strategy == 'desktop') e.psid = json;
      else if (strategy == 'mobile') e.psim = json;
      if (!live) {
        if (strategy == 'desktop') e.markModified('psid');
        else if (strategy == 'mobile') e.markModified('psim');
        e.save();
      }
    } else console.log("error");
  });
}

function getgpsi(url, strategy, callback) {
  https.get({
    host: 'www.googleapis.com',
    path: '/pagespeedonline/v1/runPagespeed?url=' + encodeURIComponent(url) +
      '&key=' + key + '&strategy=' + strategy
  }, function(res) {
    var data = "";
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on("end", function() {
      callback(data);
    });
  }).on("error", function(err) {
    console.log(err);
    callback(null);
  });
}

//print existing data
function printData(urls) {
  urls.find(function(err, urls) {
    if (err) return console.error(err);
    console.log(urls)
  })
}

//refactor urls
function addUrls(url) {
  if (!addwCheck) { //do without check in db
    var page = new Data({
      url: url
    })
    page.save(function(err) {
      if (err) return console.error(err);
      //saved
      console.log(url + ' saved');
    })
  } else { //do with check if already present
    Data.find({
      url: url
    }, function(err, arr) {
      console.log('searching ' + url);
      //console.log(arr);
      if (err) {

      }
      if (arr.length == 0) {
        var page = new Data({
          url: url
        })
        page.save(function(err) {
          if (err) return console.error(err);
          //console.log('saved');
        })
        console.log('not found');
      } else {
        console.log('already present');
        //console.log(arr[0].url);
      }
    })
  }
}

nacount = 0;
//refactor alexa ranks
function addData(e) {
  if (e.arank == null) {
    console.log('Fetching alexa data for -> ' + e.url);
    link = e.url;
    var aurl = 'http://data.alexa.com/data?cli=10&dat=snbamz&url=' + link;
    var rank;
    request(aurl, function(error, response, xml) {
      if (!error && response.statusCode == 200) {
        parseString(xml, function(err, result) {
          e.alexa = result.ALEXA;
          e.markModified('alexa');
          if (!live) {
            e.save(function(err) {
              if (err) return console.error(err);
              adone++;
              console.log('Alexa Done '.green + adone);
            })
          }
        });
        /*
    		var $ = cheerio.load(xml, {
    			xmlMode:true
    		});
            rank = $('REACH').attr('RANK');
			e.ltime = $('SPEED').attr('TEXT');
			e.ptime = $('SPEED').attr('PCT');
    		if(rank) {
                e.arank = rank;
                if(!live) {
		    		e.save(function(err) {
		            	if (err) return console.error(err);
		            	adone++;
		            	console.log('Alexa Done '.green + adone);
		            })	
	    		}
            }
    		else if(typeof rank === 'undefined') {
    			console.log ('Rank for '+aurl+ ' not available.');
    		}
    		*/
      } else console.log('Error fetching alexa data for ' + aurl);
    });
  } else console.log('Alexa Data already present');
}