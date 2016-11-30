console.log("TabSearch for Tableau Server™ Installing");

chrome.runtime.onInstalled.addListener(function(details) {
	console.log("Testing for install or update");
	if (details.reason=="install" || details.reason=="update") {
		console.log("Test Passed");

		var extviews = chrome.extension.getViews();
		console.log(extviews.length+" other tabs loaded");
		if (chrome.runtime.openOptionsPage) {
			// New way to open options pages, if supported (Chrome 42+).
			chrome.runtime.openOptionsPage();
		} else {
			// Reasonable fallback.
			chrome.tabs.create({ 'url': 'chrome://extensions/?options=' + chrome.runtime.id });
		}
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
