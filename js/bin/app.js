(function() {

  var app = {}

  $('input').attr("autocomplete", "off");

  app.checkSession = function (serverUrl, callback) {
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
        app.saveCreds(serverUrl, response.result.site.urlName, response.result.user.username,response.result.user.id, function(resp) {
          callback(resp);
        })
      }).fail(function() {
        console.log("No Good");
        if (chrome.runtime.openOptionsPage) {
          // New way to open options pages, if supported (Chrome 42+).
          chrome.runtime.openOptionsPage();
        } else {
          // Reasonable fallback.
          window.open(chrome.runtime.getURL('options.html'));
        }
      })
    });
  }

  app.saveCreds = function(serverUrl, site, username, userId, callback) {
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

  app.getWorkbooks = function(str, all, page, workbooks, live, callback) {
    chrome.storage.local.get(null, function(creds) {
      var itemLimit = 5;
      if(all) {
        itemLimit = 200;
      }
      var curPage = page * itemLimit ;
      var settings = {
        "async": true,
        "crossDomain": true,
        "url": creds.server_url + "/vizportal/api/web/v1/getWorkbooks",
        "method": "POST",
        "headers": {
          "X-XSRF-TOKEN" : creds.xsrf_token,
          "accept": "application/json, text/plain, */*",
    			"content-type": "application/json;charset=UTF-8"
        },
        "data" : "{\"method\":\"getWorkbooks\",\"params\":{\"filter\":{\"operator\":\"and\",\"clauses\":[{\"operator\":\"matches\",\"value\":\""+str+"\"}]},\"order\":[{\"field\":\"relevancy\",\"ascending\":false}],\"page\":{\"startIndex\":"+curPage+",\"maxItems\":"+itemLimit+"}}}"
      }
      if (creds.server_url == "https://public.tableau.com") {
        settings.data = "{\"method\":\"getWorkbooks\",\"params\":{\"filter\":{\"operator\":\"and\",\"clauses\":[{\"operator\":\"eq\",\"field\":\"ownerId\",\"value\":\""+creds.userId+"\"},{\"operator\":\"matches\",\"value\":\""+str+"\"}]},\"order\":[{\"field\":\"relevancy\",\"ascending\":false}],\"page\":{\"startIndex\":"+curPage+",\"maxItems\":"+itemLimit+"}}}"
      }
      $.ajax(settings).done(function (response) {
        workbooks = workbooks.concat(response.result.workbooks);
        response.result.workbooks = workbooks;
        response.serverUrl = creds.server_url;
        response.site = creds.site;
        if (response.result.moreItems && all) {
          if((live) ? callback(response) : null);
          app.getWorkbooks(str, all, page + 1, workbooks, live, callback);
        } else {
          callback(response);
        }
      });
    });
  }

  app.getViews = function(str, all, page, views, live, callback) {
    chrome.storage.local.get(null, function(creds) {
      var itemLimit = 5;
      if(all) {
        itemLimit = 200;
      }
      var curPage = page * itemLimit ;
      var settings = {
        "async": true,
        "crossDomain": true,
        "url": creds.server_url + "/vizportal/api/web/v1/getViews",
        "method": "POST",
        "headers": {
          "X-XSRF-TOKEN" : creds.xsrf_token,
          "accept": "application/json, text/plain, */*",
    			"content-type": "application/json;charset=UTF-8"
        },
        "data" : "{\"method\":\"getViews\",\"params\":{\"filter\":{\"operator\":\"and\",\"clauses\":[{\"operator\":\"matches\",\"value\":\""+str+"\"}]},\"order\":[{\"field\":\"relevancy\",\"ascending\":false}],\"page\":{\"startIndex\":"+curPage+",\"maxItems\":"+itemLimit+"}}}"
      }
      if (creds.server_url == "https://public.tableau.com") {
        settings.data = "{\"method\":\"getViews\",\"params\":{\"filter\":{\"operator\":\"and\",\"clauses\":[{\"operator\":\"eq\",\"field\":\"ownerId\",\"value\":\""+creds.userId+"\"},{\"operator\":\"matches\",\"value\":\""+str+"\"}]},\"order\":[{\"field\":\"relevancy\",\"ascending\":false}],\"page\":{\"startIndex\":"+curPage+",\"maxItems\":"+itemLimit+"}}}"
      }
      $.ajax(settings).done(function (response) {
        views = views.concat(response.result.views);
        response.result.views = views;
        response.serverUrl = creds.server_url;
        response.site = creds.site;
        if (response.result.moreItems && all) {
          if((live) ? callback(response) : null);
          app.getViews(str, all, page + 1, views, live, callback);
        } else {
          callback(response);
        }
      });
    });
  }

  app.getDatasources = function(str, all, page, datasources, live, callback) {
    chrome.storage.local.get(null, function(creds) {
      var itemLimit = 5;
      if(all) {
        itemLimit = 200;
      }
      var curPage = page * itemLimit ;
      var settings = {
        "async": true,
        "crossDomain": true,
        "url": creds.server_url + "/vizportal/api/web/v1/getDatasources",
        "method": "POST",
        "headers": {
          "X-XSRF-TOKEN" : creds.xsrf_token,
          "accept": "application/json, text/plain, */*",
    			"content-type": "application/json;charset=UTF-8"
        },
        "data" : "{\"method\":\"getDatasources\",\"params\":{\"filter\":{\"operator\":\"and\",\"clauses\":[{\"operator\":\"eq\",\"field\":\"isPublished\",\"value\":true},{\"operator\":\"matches\",\"value\":\""+str+"\"}]},\"order\":[{\"field\":\"relevancy\",\"ascending\":false}],\"page\":{\"startIndex\":"+curPage+",\"maxItems\":"+itemLimit+"}}}"
      }
      $.ajax(settings).done(function (response) {
        datasources = datasources.concat(response.result.datasources);
        response.result.datasources = datasources;
        response.serverUrl = creds.server_url;
        response.site = creds.site;
        if (response.result.moreItems && all) {
          if((live) ? callback(response) : null);
          app.getDatasources(str, live, page + 1, datasources, live, callback);
        } else {
          callback(response);
        }
      });
    });
  }

  app.getFavourites = function(callback) {
    chrome.storage.local.get(null, function(creds) {
      var settings = {
        "async": true,
        "crossDomain": true,
        "url": creds.server_url + "/vizportal/api/web/v1/getFavorites",
        "method": "POST",
        "headers": {
          "X-XSRF-TOKEN" : creds.xsrf_token,
          "accept": "application/json, text/plain, */*",
    			"content-type": "application/json;charset=UTF-8"
        },
        "data" : "{\"method\":\"getFavorites\",\"params\":{\"page\":{\"startIndex\":0,\"maxItems\":1000}}}"
      }
      $.ajax(settings).done(function (response) {
        response.serverUrl = creds.server_url;
        response.site = creds.site;
        callback(response);
      });
    });
  }

  function formatNumber(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  var buildRow = function (link, img, title, hits) {
    var html = "<div class='media item'><a href='"+link+"' target='_blank'>";
    html += "<div class='media-left'><div class='media-object thumbnail' style='background-image: url("+img+");'></div></div>";
    html += "<div class='media-body'><h4 class='media-heading'>"+title+"</h4>";
    if (hits > 0) {
          html += formatNumber(hits) + " views";
    }
    html += "</div></a></div>";
    return html;
  }

  var buildTile = function (link, img, title, hits) {
    var html = "<div class='card col-xs-6 col-md-2 tile'><a href='"+link+"' target='_blank'>";
    html += "<div class='card-img-top'><div class='media-object thumbnail' style='background-image: url("+img+");'></div></div>";
    html += "<div class='card-block'><h4 class='card-title'>"+title+"</h4>";
    if (hits > 0) {
          html += "<p class='card-text'>" + formatNumber(hits) + " views</p>";
    }
    html += "</div></a></div>";
    return html;
  }

  app.doSearch = function(str) {
    $('#workbooks').html("");
    app.getWorkbooks(str,false,0,[], false, function(resp) {
      var workbooks = resp.result.workbooks;
      if (resp.result.totalCount > 0) {
        $('#workbooks').append("<div class='section'><h2>Workbooks</h2>"+resp.result.totalCount+"<div class='ViewAll'><a href='view.html?s="+str+"&v=workbooks' target='_blank'>View All</a></div></div>");
        $.each(workbooks, function(val, opt) {
          $('#workbooks').append(buildRow(resp.serverUrl + resp.site + "/views/" + opt.defaultViewUrl, resp.serverUrl + "/" + opt.thumbnailUrl, opt.name, opt.usageInfo.hitsTotal));
        });
      }
    });
    $('#views').html("");
    app.getViews(str,false,0,[], false, function(resp) {
      var views = resp.result.views;
      if (resp.result.totalCount > 0) {
        $('#views').append("<div class='section'><h2>Views</h2>"+resp.result.totalCount+"<div class='ViewAll'><a href='view.html?s="+str+"&v=views' target='_blank'>View All</a></div></div>");
        $.each(views, function(val, opt) {
          $('#views').append(buildRow(resp.serverUrl + resp.site + "/views/" + opt.path, resp.serverUrl + "/" + opt.thumbnailUrl, opt.name, opt.usageInfo.hitsTotal));
        });
      }
    });
    $('#datasources').html("");
    app.getDatasources(str,false,0,[], false, function(resp) {
      var datasources = resp.result.datasources;
      if (resp.result.totalCount > 0) {
        $('#datasources').append("<div class='section'><h2>Data Sources</h2>"+resp.result.totalCount+"<div class='ViewAll'><a href='view.html?s="+str+"&v=datasources' target='_blank'>View All</a></div></div>");
        $.each(datasources, function(val, opt) {
          $('#datasources').append(buildRow(resp.serverUrl + resp.site + "/datasources/" + opt.id + "/connections", "/img/ds.png", opt.name, opt.usageInfo.hitsTotal));
        });
      }
    });
  }

  app.showFavourites = function() {
    $('#workbooks').html("");
    $('#views').html("");
    $('#datasources').html("");
    app.getFavourites(function(resp) {
      console.log(resp);
      var favourites = resp.result.favorites;
      var workbooks = resp.result.workbooks;
      var views = resp.result.views;
      var datasources = [];
      for (var i=0; i < favourites.length; i++) {
        if (favourites[i].objectType == "datasource") {
          datasources.push(favourites[i]);
        }
      }
      if (workbooks.length > 0) {
        $('#workbooks').append("<div class='section'><h2>Workbooks</h2></div>");
        $.each(workbooks, function(val, opt) {
          $('#workbooks').append(buildRow(resp.serverUrl + resp.site + "/views/" + opt.defaultViewUrl, resp.serverUrl + "/" + opt.thumbnailUrl, opt.name, opt.usageInfo.hitsTotal));
        });
      }
      if (views.length > 0) {
        $('#views').append("<div class='section'><h2>Views</h2></div>");
        $.each(views, function(val, opt) {
          $('#views').append(buildRow(resp.serverUrl + resp.site + "/views/" + opt.path, resp.serverUrl + "/" + opt.thumbnailUrl, opt.name, opt.usageInfo.hitsTotal));
        });
      }
      if (datasources.length > 0) {
        $('#datasources').append("<div class='section'><h2>Data Sources</h2></div>");
        $.each(datasources, function(val, opt) {
          $('#datasources').append(buildRow(resp.serverUrl + resp.site + "/datasources/" + opt.objectId + "/connections", "/img/ds.png", opt.objectName, 0));
        });
      }
    });
  }

  var timeoutID = null;
  $('#search').keyup(function(e) {
    clearTimeout(timeoutID);
    timeoutID = setTimeout(app.doSearch.bind(undefined, $('#search').val()), 500);
  });

  function getParameterByName(name, url) {
    if (!url) {
      url = window.location.href;
    }
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }

  app.pageSearch = function(searchTerm) {
    $('#views .row').html("");
    app.getViews(searchTerm,true,0,[], true, function(response) {
      var views = response.result.views;
      if (views.length > 0) {
        $.each(views, function(val, opt) {
          if (opt) {
            $('#views .row').append(buildTile(response.serverUrl + response.site + "/views/" + opt.path, response.serverUrl + "/" + opt.thumbnailUrl, opt.name, opt.usageInfo.hitsTotal));
          }
        });
      }
    });
    $('#workbooks .row').html("");
    app.getWorkbooks(searchTerm,true,0,[], true, function(response) {
      var workbooks = response.result.workbooks;
      if (workbooks.length > 0) {
        $.each(workbooks, function(val, opt) {
          if (opt) {
            $('#workbooks .row').append(buildTile(response.serverUrl + response.site + "/views/" + opt.defaultViewUrl, response.serverUrl + "/" + opt.thumbnailUrl, opt.name, opt.usageInfo.hitsTotal));
          }
        });
      }
    });
    $('#datasources .row').html("");
    app.getDatasources(searchTerm,true,0,[], true, function(response) {
      var datasources = response.result.datasources;
      if (datasources[0]) {
        $.each(datasources, function(val, opt) {
          if(opt) {
            $('#datasources .row').append(buildTile(response.serverUrl + response.site + "/datasources/" + opt.id + "/connections", "/img/ds.png", opt.name, opt.usageInfo.hitsTotal));
          }
        });
      }
    });
  }

  app.getTDE = function(data, node, callback) {
    var callVars = {};
    callVars.content = data.result;
    callVars.node = node;
    var settings = {
      url : "https://tabcommunicate.theinformationlab.co.uk/remote/tde",
      method : "POST",
      data : callVars,
      contentType : "application/x-www-form-urlencoded"
    }
    $.ajax(settings).done(function (response) {
      callback('https://tabcommunicate.theinformationlab.co.uk/' + response.substring(1));
    });
  }

  chrome.storage.local.get(null, function(creds) {
    url = window.location.href;
    if (creds.server_url && !url.includes('view.html')) {
      app.checkSession(creds.server_url, function(resp) {
        if(creds.server_url != "https://public.tableau.com") {
          app.showFavourites();
        }
      });
    } else if (creds.server_url && url.includes('view.html')) {
      app.checkSession(creds.server_url, function(resp) {
        var searchTerm = getParameterByName('s');
        var view = getParameterByName('v');
        $('#searchTerm').val(searchTerm);
        app.pageSearch(searchTerm);
        $('.nav-item').click(function() {

          $('.nav-item.active').removeClass('active');

          $(this).addClass('active');
          selectedTab = $(this).attr('data-tab');
          $('.tab').addClass('hide');
          $('#'+selectedTab).removeClass('hide');
        });
        $('#search').click(function() {
          app.pageSearch($('#searchTerm').val());
        });
        $('#tdeExportBtn').click(function() {
          switch(view) {
            case 'views':
              app.getViews(searchTerm,true,0,[], false, function(response) {
                app.getTDE(response, 'views', function(url) {
                  window.open(url, '_blank');
                });
              });
              break;
            case 'workbooks':
              app.getWorkbooks(searchTerm,true,0,[], false, function(response) {
                app.getTDE(response, 'workbooks', function(url) {
                  window.open(url, '_blank');
                });
              });
              break;
            case 'datasources':
              app.getDatasources(searchTerm,true,0,[], false, function(response) {
                app.getTDE(response, 'datasources', function(url) {
                  window.open(url, '_blank');
                });
              });
              break;
          }
        });
      });
    } else {
      //shop options screen
    }
  });
})()
