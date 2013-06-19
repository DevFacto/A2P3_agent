/* 
* Copyright (C) Province of British Columbia, 2013
*/

// When jquery is ready
$(document).ready(function() {
	
	console.log("jquery document ready");
	
    // Figure out if we are on phonegap/cordova
	var isCordova = (document.location.protocol == "file:");

	if (isCordova) {
		document.addEventListener("deviceready", onDeviceReady, false);
	}
	else {
		onDeviceReady();
	}
});

/*
 * Event for when cordova is fully loaded
 */
function onDeviceReady() {	
	console.log("device ready");
	
	// Init our singltons
	settings = new window.Agent.Settings();
	enrollmentSessions = new window.Agent.EnrollmentSessions();
	agentRequestSessions = new window.Agent.AgentRequestSessions();
	notification = new window.Agent.Notification();
	
	// Start up backbone
    app = new window.Agent.AppRouter();
    Backbone.history.start();
	
	// attach more listeners to cordova
	document.addEventListener("resume", onResume, false);
	document.addEventListener("pause", onPause, false);
	document.addEventListener("online", onOnline, false);
	document.addEventListener("offline", onOffline, false);
	
	// Surpress shake gesture
	window.addEventListener('devicemotion', function (e) {
        // Stop the default behavior from triggering the undo dialog (hopefully)
    	e.preventDefault();
	});
	
	// try to register if we haven't
	if (!settings.get("NotificationDeviceToken")) {
		notification.register();
	}
	// bind push events - when our app is active and gets new notification
	document.addEventListener("push-notification", window.Agent.Notification.onPendingNotificationWhileActive, false);
	
	 // Get new notifications
	window.Agent.Notification.processPendingNotifications(onDefaultEvent);
}

/*
 * Event for when we don't have pending notifications or incoming 
 * URL.
 */
function onDefaultEvent () {
	// reset to splash - THIS MUST BE BEFORE Backbone history starts
	if (navigator.splashscreen) {
		navigator.splashscreen.hide();
	}
	
	// lets to default home page
	console.log("loading default home page");

	if (settings.isEnrolled()) {
    	//app.homeScan();
   	}
}

/*
 * Event for when we become active from the background
 */
function onResume() {
	console.log("resume");
	console.log("handling = " + window.Agent.HandlingOpenUrl);
	
	if (window.Agent.HandlingOpenUrl == true) {
		
		//return;
	} 
	// Process new notifications
	if (settings.get("NotificationDeviceToken")) {
    	window.Agent.Notification.processPendingNotifications(onDefaultEvent);
    }
    else {
    	onDefaultEvent();
    }
}

/*
 * Event for when we become we are put into background
 */
function onPause() {
	console.log("pause");
	
	// show splash and nav home
	navigator.splashscreen.show();
	app.navigate("", true);
}

/*
 * Event for when cordova becomes online
 */
function onOnline () {
	console.log("online");
	
	// Process new notifications
	if (settings.get("NotificationDeviceToken")) {
    	window.Agent.Notification.processPendingNotifications(onDefaultEvent);
    }
}

/*
 * Event for when cordova goes offline
 */
function onOffline () {
	console.log("offline");
}


console.log("---------- BANG! ------------");
if (window.navigateToUrl != "") {
    console.log("trying to navigate to" + window.navigateToUrl);
    handleOpenURL(window.navigateToUrl);
}