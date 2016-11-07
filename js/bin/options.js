(function() {
  var opt = {};

  opt.checkSession = function (serverUrl, callback) {
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
        callback(true);
        $('#loginBtn').hide();
        $('#logoutBtn').show();
        $('.loggedIn').show();
        opt.saveCreds(serverUrl, response.result.site.urlName, response.result.user.username, response.result.user.id, undefined, function(resp) {
          console.log(resp);
          opt.getSites(serverUrl, function(resp) {
            opt.populateSites(resp, function(resp) {
              console.log(resp);
            });
          });
        })
      }).fail(function() {
        chrome.storage.local.get(null, function(creds) {
          credentials = creds;
          console.log("Trying Connected Desktop");
          chrome.instanceID.getID(function(instanceID) {
            if (credentials["server_url"] == $('#serverUrl').val() && credentials.refreshToken) {
              var settings = {
            	  "async": true,
            	  "crossDomain": true,
            	  "url": serverUrl + "/oauth2/v1/token",
            	  "method": "POST",
            		"headers": {
            	    "accept": "*/*",
            			"content-type": "application/x-www-form-urlencoded"
            		},
            	  "data": "client_id="+instanceID+"&device_id="+instanceID+"&grant_type=refresh_token&refresh_token="+credentials.refreshToken+"&site_namespace="+credentials.site
            	}
            	$.ajax(settings).done(function (response) {
                console.log("All's good");
                callback(true);
                $('#loginBtn').hide();
                $('#logoutBtn').show();
                $('.loggedIn').show();
                var parser = document.createElement('a');
                parser.href = serverUrl;
                chrome.cookies.set({url : serverUrl, name: "workgroup_session_id", value: response["access_token"]});
                chrome.cookies.set({url : serverUrl, name: "XSRF-TOKEN", value: response["xsrf_token"]});
                opt.saveCreds(serverUrl, credentials.site, credentials.username, credentials.userId, response, function(resp) {
                  console.log(resp);
                  opt.getSites(serverUrl, function(resp) {
                    opt.populateSites(resp, function(resp) {
                      console.log(resp);
                    });
                  });
                })
              }).fail(function() {
                $('.loggedIn').hide();
                $('#loginBtn').show();
                $('#logoutBtn').hide();
                console.log("No Good");
                callback(false);
              });
            } else {
              $('.loggedIn').hide();
              $('#loginBtn').show();
              $('#logoutBtn').hide();
              console.log("No Good");
              callback(false);
            }
          });
        });
      });
    });
  }

  opt.populateSites = function(resp, callback) {
    chrome.storage.local.get(null, function(creds) {
      $('#sites').html("");
      $.each(resp.result.siteNames, function(val, opt) {
        var label = opt.name;
        var siteUrl = opt.urlName;
        $('#sites').append(
            $('<option></option>').val(siteUrl).html(label)
        );
      });
      $('#sites').show();
      $('#connectedClient').show();
      if(creds) {
          $('#sites').val(creds.site);
      }
      callback("Sites updated");
    });
  }

  opt.login = function(serverUrl, callback) {
    var newWin = {
      url: serverUrl,
      focused: true,
      type: "popup"
    }
    chrome.windows.create(newWin, function (win) {
      var wgChanged = false;
      var xtChanged = false;
      var counter = 0;
      var wgValue = "";
      var xtValue = "";
      chrome.cookies.onChanged.addListener(function(obj) {
        var ckValue = obj.cookie.value;
        if (obj.cookie.name == "workgroup_session_id" && ckValue.length > 5 && obj.cause == "explicit") {
          wgChanged = true;
          wgValue = ckValue;
        } else if (obj.cookie.name == "XSRF-TOKEN" && ckValue.length > 5 && obj.cause == "explicit") {
          xtChanged = true;
          xtValue = ckValue;
        }
        console.log(obj);
        if (xtChanged && wgChanged && (obj.cookie.name == "workgroup_session_id" || obj.cookie.name == "XSRF-TOKEN")  && obj.cause == "explicit") {
          counter = counter + 1;
          if (counter > 1) {
            console.log("Want to check session");
            chrome.cookies.onChanged.removeListener(arguments.callee);
            var creds = {};
            creds.access_token = wgValue;
            creds.xsrf_token = xtValue;
            creds.server_url = serverUrl;

            chrome.storage.local.set(creds, function() {
              console.log('Creds without Site Saved');
              $('.loggedIn').show();
              $('#loginBtn').hide();
              $('#logoutBtn').show();
              opt.getSites(serverUrl, function(sites) {
                chrome.windows.remove(win.id);
                opt.populateSites(sites, function(resp) {
                  console.log(resp);
                });
                opt.checkSession(serverUrl, function(resp) {
                  console.log(resp);
                });
              });
            });
          }
        }
      });
    });
  };

  opt.saveCreds = function(serverUrl, site, username, userId, refreshToken, callback) {
    curentCreds = {};
    chrome.storage.local.get(null, function(creds) {
      currentCreds = creds;
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
        currentCreds.access_token = workgroup_session_id;
        currentCreds.xsrf_token = xsrf_token;
        currentCreds.server_url = serverUrl;
        currentCreds.username = username;
        currentCreds.userId = userId;
        currentCreds.site = site;
        if (refreshToken) {
          currentCreds.refreshToken = refreshToken["refresh_token"];
          currentCreds.access_token = refreshToken["access_token"];
          currentCreds.xsrf_token = refreshToken["xsrf_token"];
          if (refreshToken.deviceName) {
            currentCreds.deviceName = refreshToken.deviceName;
          }
        }
        console.log(currentCreds);
        $('#computer').val(currentCreds.deviceName);
        chrome.storage.local.set(currentCreds, function() {
          callback('Basic Auth credentials saved');
        });
      });
    });
  }

  opt.oAuthRegister = function (serverUrl, callback) {
    chrome.storage.local.get(null, function(creds) {
      chrome.instanceID.getID(function(instanceID) {
        var settings = {
      	  "async": true,
      	  "crossDomain": true,
      	  "url": serverUrl+"/oauth2/v1/token",
      	  "method": "POST",
      	  "headers": {
      	    "accept": "*/*",
      	    "content-type": "application/x-www-form-urlencoded",
      			"x-xsrf-token": creds.xsrf_token
      	  },
      	  "data": {
      	    "client_id": instanceID,
      	    "device_id": instanceID,
      	    "device_name": $('#computer').val(),
      	    "grant_type": "session",
      	    "session_id": creds.access_token
      	  }
      	}
      	$.ajax(settings).done(function (response) {
          response.deviceName = $('#computer').val();
          var parser = document.createElement('a');
          parser.href = serverUrl;
          chrome.cookies.set({url : serverUrl, name: "workgroup_session_id", value: response["access_token"]});
          chrome.cookies.set({url : serverUrl, name: "XSRF-TOKEN", value: response["xsrf_token"]});
          opt.saveCreds(serverUrl, creds.site, creds.username, creds.userId, response, function(resp) {
            callback(resp);
          });

      	});
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
          opt.saveCreds(serverUrl, site, username, userId, undefined, function(resp) {
            callback(resp);
          });
        }
    	});
    });
  }

  opt.logout = function(serverUrl, callback) {
    chrome.storage.local.get(null, function(creds) {
      var settings = {
        "async": false,
        "crossDomain": true,
        "url": serverUrl+"/vizportal/api/web/v1/logout",
        "method": "POST",
        "headers": {
          "X-XSRF-TOKEN": creds.xsrf_token,
          "accept": "application/json, text/plain, */*",
          "content-type": "application/json;charset=UTF-8"
        },
        "data": "{\"method\":\"logout\",\"params\":{}}"
      }
      $.ajax(settings).done(function (response) {
        callback("Logged Out");
        $('.loggedIn').hide();
        $('#loginBtn').show();
        $('#logoutBtn').hide();
      });
    });
  }

  $(document).ready(function(){
    chrome.storage.local.get(null, function(creds) {
      if ((creds.server_url) ? $('#serverUrl').val(creds.server_url) : null);
      if ((creds.site) ? $('#site').val(creds.site) : null);
      if (creds.server_url) {
        opt.checkSession(creds.server_url, function (resp) {
          console.log(resp);
        });
      }
    });
    $('#loginBtn').click( function() {
      opt.login($('#serverUrl').val(), function(resp) {
        console.log(resp);
        opt.getSites($('#serverUrl').val(), function(resp) {
          $('#sites').html('');
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
    $('#logoutBtn').click( function() {
      opt.logout($('#serverUrl').val(), function(resp) {
        console.log(resp);
        $('#sites').hide();
        $('#connectedClient').hide();
      });
    });
    $('#sites').change( function() {
      chrome.storage.local.get(null, function(creds) {
        opt.switchSite($('#serverUrl').val(), $('#sites').val(), creds.username, creds.userId , function(resp) {
          console.log(resp);
        });
      });
    });
    $('#saveBtn').click( function() {
      opt.oAuthRegister($('#serverUrl').val(), function(resp) {
        console.log(resp);
      });
    });
  });

})();
