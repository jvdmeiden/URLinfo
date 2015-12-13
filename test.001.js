// Author: Jan van der Meiden
// jvdmeiden@gmail.com
// Version: 20151212.00
//
// Copyright (c) 2015 Jan van der Meiden.
//
// Copying and distribution of this file, with or without modification,
// are permitted in any medium without royalty provided the copyright
// notice and this notice are preserved.  
// This file is offered as-is, without any warranty.
//
// ==================================================================
// Utility to write informaton on a URL to the command line
//   This information contains:
//   - IP address 
//   - reverse IP address
//   - GeoIP information
//   - http headers
//   - redirection
//   - if applicable some information from the sites certificate
// Run as 'node test.001 <URL>'

var dns = require('dns');
var http = require('http');
var url = require('url');
var name = process.argv[2];
var https = require('https');
var options = {
  hostname : '',
  path : '/',
  headers: {
    'connection'       : 'keep-alive',
    'agent'            : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.80 Safari/537.36',
    'accept-encoding'  : 'gzip, deflate, sdch',
    'accept-language'  : 'en-US,en;q=0.8'
  }
};
var latestLocation = "";

// set DNS to Google
dns.setServers(['8.8.8.8','8.8.4.4']);


function getIpInfo(addr){
  http.get('http://127.0.0.1:8081/geoip?'+addr, function(res) {
    var ipinfo = '';
    res.on('data', function (chunk) {
      ipinfo+=chunk;
    });
    res.on('end', function() {
      console.log('GEOIP for '+' '+addr+' is '+ipinfo);
    })
  }).on('error', function(e) {
    console.log('Got error: ' + e.message);
  });
  dns.reverse(addr, function (erno, domains) {
    if (erno) console.log(addr+' REVERSE LOOKUP FAILED'); else {
      console.log('Reverse for ' + addr + ': ' + JSON.stringify(domains))
    }
  })
}

function traverse(level,indent,obj) {
  for (j in obj) {
    if (typeof(obj[j])=='object') {
        // so this is an object
        console.log(indent + j + '(object)');
        // Mark an array
        if (level < 10){
          if(obj[j] instanceof Array) {
            console.log(indent + ' +-');
            traverse(level+1,indent+' | ',obj[j]);
          } else {
            traverse(level+1,indent+'   ',obj[j]);
          }
        }
      } else {
        // We are at an endpoint
        console.log(indent + j + '('+ typeof(obj[j]) + ') : ' + obj[j]);
    }
  }
};

function getPage(response) {
  var str = '';

  //another chunk of data has been recieved, so append it to `str`
  response.on('data', function (chunk) {
    str += chunk;
  });

  response.on('error', function(e) {
    if ( latestLocation.substring(0,4) != 'www.' && latestLocation.substring.substring(0,4) != 'http'){
      serverInfo('www.'+latestLocation.substring);
    } else {
      console.log("Got error on http get: " + e.message);
    }
  });

  //the whole response has been recieved, so we just print it out here
  response.on('end', function () {
 
    traverse(0,'------',response.headers);
    if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
      console.log('\n redirected to: ' + JSON.stringify(response.headers.location));
      if (response.headers.location != latestLocation){
        serverInfo(response.headers.location);
      }
    }
    // console.log(str);
  });
}

function getSPage(response) {
  var str = '';

  //another chunk of data has been recieved, so append it to `str`
  response.on('data', function (chunk) {
    str += chunk;
  });

  //the whole response has been recieved, so we just print it out here
  response.on('end', function () {
 
    traverse(0,'------',response.headers);
    var cert=response.connection.getPeerCertificate();
    if ( cert != null){
      traverse(0,"",cert.subject);
      traverse(0,"",cert.issuer);
      var validFrom="";
      for ( i in cert.valid_from ){
        validFrom=validFrom+cert.valid_from[i];
      };
      console.log('Valid From :' + validFrom);
      var validTo="";
      for ( i in cert.valid_to ){
        validTo=validTo+cert.valid_to[i];
      };
      console.log('Valid To :' + validTo);
      console.log(cert.subjectaltname);
    }
    //traverse(0,'',res.connection.ssl);
    if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
      console.log('\n redirected to: ' + JSON.stringify(response.headers.location));
      if (response.headers.location != latestLocation){
        serverInfo(response.headers.location);
      }
    }
    // console.log(str);
  });
}

function serverInfo(thisUrl){
  latestLocation = thisUrl;
  if (thisUrl.substring(0,4) != 'http'){
    thisUrl='http://'+thisUrl;
  }
  var pathname=url.parse(thisUrl).pathname;
  var protocol=url.parse(thisUrl).protocol;
  var hostname=url.parse(thisUrl).hostname;
  
console.log('~~~~~'+protocol+' '+hostname+' '+pathname);
  
  dns.resolve4(hostname, function (err, addresses) {
    if (err) console.log(hostname+' NOT FOUND'); else {
      console.log('addresses: ' + JSON.stringify(addresses));
      addresses.forEach(function (a) {
        getIpInfo(a);
      }
    )}
  })

  console.log('>>>'+JSON.stringify(thisUrl));
  if (protocol == 'https:'){
    options.protocol=protocol;
    options.hostname=hostname;
    options.pathname=pathname;
    options.rejectUnauthorized=false;
    https.request(options, getSPage).end();
  } else if (protocol == 'http:'){
    options.protocol=protocol;
    options.hostname=hostname;
    options.pathname=pathname;
    http.request(options, getPage).end();
  } else {
    console.log('Unsupported Protocol');
  }
}

serverInfo(name)
