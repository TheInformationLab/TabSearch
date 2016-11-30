(function() {
  var opt = {};

  opt.checkSession = function (serverUrl, callback) {
    $('#serverUrl').val(serverUrl);
    chrome.storage.local.get(null, function(creds) {
      var parser = document.createElement('a');
      parser.href = serverUrl;
      opt.getCookies(serverUrl, function(workgroup_session_id, xsrf_token) {
        if (workgroup_session_id == '""') {
          chrome.cookies.remove({url : serverUrl, name: "workgroup_session_id"});
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
        if (creds.access_token) {
          settings.headers.Authorization = "Bearer " + creds.access_token;
        }
      	$.ajax(settings).done(function (response) {
          console.log("All's good");
          callback(true);
          $('#loginBtn').hide();
          $('#logoutBtn').show();
          $('.loggedIn').show();
          if(creds.refreshToken) {
            var refreshToken = {};
            refreshToken.refresh_token = creds.refreshToken;
            refreshToken.access_token = creds["access_token"];
            refreshToken.xsrf_token = xsrf_token;
            refreshToken.deviceName = creds.deviceName;
          } else {
            var refreshToken = undefined;
          }
          opt.saveCreds(serverUrl, response.result.site.urlName, response.result.user.username, response.result.user.id, refreshToken, function(resp) {
            console.log(resp);
            opt.getSites(serverUrl, function(resp) {
              opt.populateSites(resp, function(resp) {
                chrome.storage.local.get(null, function(creds) {
                  if (creds.refreshToken) {
                    opt.oAuthRefresh(serverUrl, creds.site, function(resp) {
                      console.log(resp);
                    });
                  }
                });
              });
            });
          })
        }).fail(function() {
          chrome.storage.local.get(null, function(creds) {
            credentials = creds;
            console.log("Trying Connected Desktop");
            chrome.instanceID.getID(function(instanceID) {
              if (credentials["server_url"] == $('#serverUrl').val() && credentials.refreshToken) {
                opt.oAuthRefresh(serverUrl, credentials.site, function(resp) {
                  console.log(resp);
                  opt.getSites(serverUrl, function(resp) {
                    opt.populateSites(resp, function(resp) {
                      console.log(resp);
                    });
                  });
                });
              } else {
                opt.login(serverUrl, function(resp){
                  callback(true);
                });
              }
            });
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
      type: "popup",
      width: 800,
      height: 740
    }
    console.log(newWin);
    chrome.windows.create(newWin, function (win) {
      var wgChanged = false;
      var xtChanged = false;
      if (serverUrl.includes("online.tableau.com")) {
        var counter = 1;
      } else {
        var counter = 0;
      }
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
            chrome.windows.remove(win.id);
            var parser = document.createElement('a');
            parser.href = serverUrl;
            chrome.cookies.onChanged.removeListener(arguments.callee);
            opt.checkSession(parser.protocol + "//" + obj.cookie.domain, function(response) {
              if(response) {
                console.log("Loggin complete");
              }
              callback(true);
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
      chrome.storage.local.clear(function() {
        var parser = document.createElement('a');
        parser.href = serverUrl;
        opt.getCookies(serverUrl, function(workgroup_session_id, xsrf_token) {
          if (workgroup_session_id) {
            currentCreds.workgroup_session_id = workgroup_session_id;
          }
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
          if (currentCreds.refreshToken) {
            $('#saveBtn').removeClass('btn-primary');
            $('#saveBtn').addClass('btn-success');
            $('#saveBtn').prop('disabled', true);
            $('#saveBtn').html('Connected');
          } else {
            $('#saveBtn').removeClass('btn-success');
            $('#saveBtn').addClass('btn-primary');
            $('#saveBtn').prop('disabled', false);
            $('#saveBtn').html('Stay Connected');
          }
          console.log(currentCreds);
          chrome.storage.local.set(currentCreds, function() {
            callback('Basic Auth credentials saved');
          });
        });
      });
    });
  }

  opt.getCookies = function(serverUrl, callback) {
    var workgroup_session_id = xsrf_token = undefined;
    chrome.cookies.get({url: serverUrl, name: "workgroup_session_id"}, function(wg) {
      if (wg) {
        workgroup_session_id = wg.value;
      }
      chrome.cookies.get({url: serverUrl, name: "XSRF-TOKEN"}, function(xt) {
        if (xt) {
          xsrf_token = xt.value;
        }
        callback(workgroup_session_id, xsrf_token)
      });
    });
  }

  opt.oAuthRegister = function (serverUrl, callback) {
    chrome.storage.local.get(null, function(creds) {
      console.log(creds);
      chrome.instanceID.getID(function(instanceID) {
        console.log(creds);
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
      	    "device_name": "TabSearch",
      	    "grant_type": "session",
      	    "session_id": creds.workgroup_session_id
      	  }
      	}
      	$.ajax(settings).done(function (response) {
          response.deviceName = $('#computer').val();
          var parser = document.createElement('a');
          parser.href = serverUrl;
          chrome.cookies.get({url: serverUrl, name: "workgroup_session_id"}, function(cookie) {
            if (cookie.value == '""') {
              chrome.cookies.remove({url : serverUrl, name: "workgroup_session_id"});
            }
            chrome.cookies.set({url : serverUrl, name: "XSRF-TOKEN", value: response["xsrf_token"]});
            opt.saveCreds(serverUrl, creds.site, creds.username, creds.userId, response, function(resp) {
              callback(resp);
            });
          });
      	});
      });
    });
  }

  opt.oAuthRefresh = function(serverUrl, siteId, callback) {
    chrome.storage.local.get(null, function(creds) {
      chrome.instanceID.getID(function(instanceID) {
        var settings = {
          "async": true,
          "crossDomain": true,
          "url": serverUrl + "/oauth2/v1/token",
          "method": "POST",
          "headers": {
            "accept": "*/*",
            "content-type": "application/x-www-form-urlencoded"
          },
          "data": "client_id="+instanceID+"&device_id="+instanceID+"&grant_type=refresh_token&refresh_token="+encodeURIComponent(creds.refreshToken)+"&site_namespace="+siteId
        }
        if (creds.access_token) {
          settings.headers.Authorization = "Bearer " + creds.access_token;
        }
        $.ajax(settings).done(function (response) {
          console.log("Connected Desktop Refreshed");
          $('#loginBtn').hide();
          $('#logoutBtn').show();
          $('.loggedIn').show();
          var parser = document.createElement('a');
          parser.href = serverUrl;
          chrome.cookies.get({url: serverUrl, name: "workgroup_session_id"}, function(cookie) {
            if (cookie.value == '""') {
              chrome.cookies.remove({url : serverUrl, name: "workgroup_session_id"});
            }
            //chrome.cookies.set({url : serverUrl, name: "workgroup_session_id", value: response["access_token"]});
            chrome.cookies.set({url : serverUrl, name: "XSRF-TOKEN", value: response["xsrf_token"]});
            opt.saveCreds(serverUrl, creds.site, creds.username, creds.userId, response, function(resp) {
              callback(resp);
            });
          });
        }).fail(function() {
          opt.login(serverUrl, function(resp){
            callback(true);
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
      if (creds.access_token) {
        settings.headers.Authorization = "Bearer " + creds.access_token;
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
      if (creds.access_token) {
        settings.headers.Authorization = "Bearer " + creds.access_token;
      }
    	$.ajax(settings).done(function (response) {
        if (response.result.errors) {
          var errCode = response.result.errors[0].code;
          if (errCode == 55) {
            //rerun login with new destination Pod URL
            var newPodUrl = response.result.errors[0].destinationPodUrl;
            $('#serverUrl').val(newPodUrl);
            opt.logout(serverUrl, function(resp) {
              opt.login(newPodUrl, function(resp) {
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
          } else if (errCode == 57) {
            if (creds.refreshToken) {
              opt.oAuthRefresh(serverUrl, site, function (resp) {
                callback(resp);
              });
            } else {
              opt.logout(serverUrl, function(resp) {
                opt.login(serverUrl, function(resp){
                  callback(resp);
                });
              });
            }
          }
        } else {
          console.log("Switched to site " + site);
          opt.saveCreds(serverUrl, site, username, userId, undefined, function(resp) {
            if (creds.refreshToken) {
              opt.oAuthRefresh(serverUrl, site, function (resp) {
                callback(resp);
              });
            } else {
              callback(resp);
            }
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
      if (creds.access_token) {
        settings.headers.Authorization = "Bearer " + creds.access_token;
      }
      $.ajax(settings).done(function (response) {
        console.log('Logged out from server');
      }).fail(function() {
        console.log('Error logging out of server');
      }).always(function() {
        chrome.storage.local.clear(function() {
          callback("Logged Out");
          $('.loggedIn').hide();
          $('#loginBtn').show();
          $('#logoutBtn').hide();
        });
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
      } else {
        $('.loggedIn').hide();
        $('#loginBtn').show();
        $('#logoutBtn').hide();
      }
    });
    $('#loginBtn').click( function() {
      opt.checkSession($('#serverUrl').val(), function (resp) {
        console.log(resp);
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
