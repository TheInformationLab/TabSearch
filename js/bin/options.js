(function() {
  var opt = {};

  opt.checkSession = function (serverUrl) {
    var parser = document.createElement('a');
    parser.href = serverUrl;
    chrome.cookies.getAll({domain : parser.hostname}, function(cookies) {
      for (var i=0; i<cookies.length; i++) {
        switch (cookies[i].name) {
          case "workgroup_session_id":
            var workgroup_session_id = cookies[i].value;
            break;
          case "XSRF-TOKEN":
            var xsrf_token = cookies[i].value;
            break;
        }
      }
      var settings = {
    	  "async": true,
    	  "crossDomain": true,
    	  "url": serverUrl + "/vizportal/api/web/v1/getSessionInfo",
    	  "method": "POST",
    		"headers": {
          "X-XSRF-TOKEN": xsrf_token,
    	    "accept": "application/json, text/plain, */*",
    			"content-type": "application/json;charset=UTF-8"
    		},
    	  "data": "{\"method\":\"getSessionInfo\",\"params\":{}}"
    	}
    	$.ajax(settings).done(function (response) {
        console.log("All's good");
        opt.saveCreds(serverUrl, response.result.site.urlName, response.result.user.username, response.result.user.id, function(resp) {
          console.log(resp);
          $('username').val(response.result.user.username);
          opt.getSites(serverUrl, function(resp) {
            $.each(resp.result.siteNames, function(val, opt) {
              var label = opt.name;
              var siteUrl = opt.urlName;
              $('#sites').append(
                  $('<option></option>').val(siteUrl).html(label)
              );
            });
            $('#sites').show();
            $('#sites').val(response.result.site.urlName);
            $('#connectedClient').show();
          });
        })
      }).fail(function() {
        console.log("No Good");
      })
    });
  }

  opt.login = function (serverUrl, username, password, callback) {
    var settings = {
  	  "async": true,
  	  "crossDomain": true,
  	  "url": serverUrl + "/vizportal/api/web/v1/generatePublicKey",
  	  "method": "POST",
  		"headers": {
  	    "accept": "application/json, text/plain, */*",
  			"content-type": "application/json;charset=UTF-8"
  		},
  	  "data": "{\"method\":\"generatePublicKey\",\"params\":{}}"
  	}
  	$.ajax(settings).done(function (response) {
  	  var keyID = response.result.keyId;
  		var key = response.result.key;
  		var res = rsa.encrypt(password, key)
  		var settings = {
  		  "async": true,
  		  "crossDomain": true,
  		  "url": serverUrl+"/vizportal/api/web/v1/login",
  		  "method": "POST",
  			"headers": {
  		    "accept": "application/json, text/plain, */*",
  				"content-type": "application/json;charset=UTF-8"
  			},
  		  "data": "{\"method\":\"login\",\"params\":{\"username\":\""+username+"\",\"encryptedPassword\":\""+res+"\",\"keyId\":\""+keyID+"\"}}"
  		}
  		$.ajax(settings).done(function (response, textStatus, jqXHR) {
        if (response.result.errors) {
          if (response.result.errors[0].code == 55) {
            //rerun login with new destination Pod URL
            $('serverUrl').val(response.result.errors[0].destinationPodUrl);
            opt.login(response.result.errors[0].destinationPodUrl, username, password, callback);
          }
        } else {
          opt.saveCreds(serverUrl, response.result.site.urlName, username, response.result.user.id, function(resp) {
            callback(resp);
          });
        }
      })
    })
  }

  opt.saveCreds = function(serverUrl, site, username, userId, callback) {
    var parser = document.createElement('a');
    parser.href = serverUrl;
    chrome.cookies.getAll({domain : parser.hostname}, function(cookies) {
      for (var i=0; i<cookies.length; i++) {
        switch (cookies[i].name) {
          case "workgroup_session_id":
            var workgroup_session_id = cookies[i].value;
            break;
          case "XSRF-TOKEN":
            var xsrf_token = cookies[i].value;
            break;
        }
      }
      var creds = {};
      creds.access_token = workgroup_session_id;
      creds.xsrf_token = xsrf_token;
      creds.server_url = serverUrl;
      creds.username = username;
      creds.userId = userId;
      if (site != "") {
        creds.site = "/#/site/" + site;
      } else {
        creds.site = "";
      }
      chrome.storage.local.set(creds, function() {
        callback('Basic Auth credentials saved');
      });
    });
  }

  opt.oAuthRegister = function (serverUrl, workgroup_session_id, xsrf_token, callback) {
    chrome.instanceID.getID(function(instanceID) {
      var settings = {
    	  "async": true,
    	  "crossDomain": true,
    	  "url": serverUrl+"/oauth2/v1/token",
    	  "method": "POST",
    	  "headers": {
    	    "accept": "*/*",
    	    "accept-encoding": "gzip, deflate",
    	    "cookie": "XSRF-TOKEN="+xsrf_token+"; workgroup_session_id="+workgroup_session_id,
    	    "content-type": "application/x-www-form-urlencoded",
    			"x-xsrf-token": xsrf_token
    	  },
    	  "data": {
    	    "client_id": instanceID,
    	    "device_id": instanceID,
    	    "device_name": "chromePlugin",
    	    "grant_type": "session",
    	    "session_id": workgroup_session_id
    	  }
    	}
    	$.ajax(settings).done(function (response) {
        var parser = document.createElement('a');
        parser.href = serverUrl;
        chrome.cookies.set({url : serverUrl, name: "workgroup_session_id", value: response.access_token});
        chrome.cookies.set({url : serverUrl, name: "XSRF-TOKEN", value: response.xsrf_token});
    		callback(response);
    	});
    });
  }

  opt.getSites = function(serverUrl, callback) {
    chrome.storage.local.get(null, function(creds) {
      var settings = {
        "async": true,
        "crossDomain": true,
        "url": serverUrl + "/vizportal/api/web/v1/getSiteNamesAcrossAllPods",
        "method": "POST",
        "headers": {
          "X-XSRF-TOKEN" : creds.xsrf_token,
          "accept": "application/json, text/plain, */*",
    			"content-type": "application/json;charset=UTF-8"
        },
        "data" : "{\"method\":\"getSiteNamesAcrossAllPods\",\"params\":{\"page\":{\"startIndex\":0,\"maxItems\":1000000}}}"
      }
      $.ajax(settings).done(function (response) {
        callback(response);
      });
    });
  }

  opt.switchSite = function (serverUrl, site, username, userId, callback) {
    chrome.storage.local.get(null, function(creds) {
    	var settings = {
    	  "async": false,
    	  "crossDomain": true,
    	  "url": serverUrl+"/vizportal/api/web/v1/switchSite",
    	  "method": "POST",
    	  "headers": {
    	    "X-XSRF-TOKEN": creds.xsrf_token,
    			"accept": "application/json, text/plain, */*",
    			"content-type": "application/json;charset=UTF-8"
    	  },
    	  "data": "{\"method\":\"switchSite\",\"params\":{\"urlName\":\""+site+"\"}}"
    	}
    	$.ajax(settings).done(function (response) {
        if (response.result.errors) {
          if (response.result.errors[0].code == 55) {
            //rerun login with new destination Pod URL
            $('serverUrl').val(response.result.errors[0].destinationPodUrl);
            opt.login(response.result.errors[0].destinationPodUrl, username, password, callback);
          }
        } else {
          opt.saveCreds(serverUrl, site, username, userId, function(resp) {
            callback(resp);
          });
        }
    	});
    });
  }

  $(document).ready(function(){
    chrome.storage.local.get(null, function(creds) {
      if ((creds.server_url) ? $('#serverUrl').val(creds.server_url) : null);
      if ((creds.username) ? $('#username').val(creds.username) : null);
      if ((creds.userId) ? $('#username').attr('data-userId',creds.userId) : null);
      if ((creds.site) ? $('#site').val(creds.site) : null);
      if ((creds.server_url) ? opt.checkSession(creds.server_url) : null);
    });
    $('#loginBtn').click( function() {
      opt.login($('#serverUrl').val(), $('#username').val(), $('#password').val(), function(resp) {
        console.log(resp);
        opt.getSites($('#serverUrl').val(), function(resp) {
          $.each(resp.result.siteNames, function(val, opt) {
            var label = opt.name;
            var siteUrl = opt.urlName;
            $('#sites').append(
                $('<option></option>').val(siteUrl).html(label)
            );
          });
          $('#sites').show();
          $('#connectedClient').show();
        });
      });
    });
    $('#sites').change( function() {
      opt.switchSite($('#serverUrl').val(), $('#sites').val(), $('#username').val(),$('#username').attr('data-userId'), function(resp) {
        console.log(resp);
      });
    });
  });

})();
