console.log("Tableau Server Extension Installing");

chrome.runtime.onInstalled.addListener(function(details) {
	console.log("Testing for install or update");
	if (details.reason=="install" || details.reason=="update") {
		console.log("Test Passed");
		
		var extviews = chrome.extension.getViews();
		console.log(extviews.length+" other tabs loaded");
		
		chrome.tabs.create({'url': '/options.html', 'selected':true});
	}
} );

 chrome.tabs.update(tab.id,update,function(utab){ 
                chrome.tabs.onUpdated.addListener(function (tabId,info,tab){ 
                        console.log(info.status) 
                        if(info.status == "complete"){ 
                                insertScript(tab); 
                                //chrome.tabs.onUpdated.removeListener(arguments.callee); 
                        } 
                }); 
        }); 