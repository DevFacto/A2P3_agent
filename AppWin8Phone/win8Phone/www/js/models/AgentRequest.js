/* 
* Copyright (C) Province of British Columbia, 2013
*/

(function() {
	'use strict';

	// ----------
	// AgentRequest Model, A2P3 draft v8 compliant
	// ----------

	window.Agent.AgentRequest = Backbone.Model.extend({

		urlRoot: window.Agent.Context.BaseUrl + '/api/AgentRequest',

		// Default attributes
		defaults: {
			// AS URL
			AuthenticationServerURL: '',
			
			// Device Id
			DeviceId: '',
			
			// Raw incoming URL
			SourceUrl: '',
					
			// Where the Client App wants redirect responses
			ReturnURL: '',
			
			// Where the Client APp wants an ACK instead
			CallbackURL: '',
			
			// State - an optional parameter for the Client APp to preserve state
			State: '',
			
			// Sar - signature of the agent request
			Sar: '',
			
			// Request part of the source URL
			Request: '',
			
			// Notification URL Flag - Indicates if the client app wants a notification URL
			NotificationURLFlag: '', 
			
			// Notification URL - an optiona parameter for the Client to be notified
			NotificationURL: '', 
			
			// AppId - the identifier of the app
			AppId: '',
			
			// Name of the Client App - used for display purposes
			AppName: '',
			
			// An array of resource authZ URL as passed in from request
			Resources: null,
			
			// Array of resource server ids parsed from Resources
			ResourceIds: null,
						
			// An array of resource descriptions
			ResourceDescriptions: null,
			
			// Indicates if the User must enter the passcode
			PasscodeFlag: true,
			
			// Passcode entered by user
			Passcode: '',
			
			// Indicates if the User must be prompted to authoze the txn
			AuthorizeFlag: true,
			
			// True or false if the user authorized this request
			Authorized: false,
			
			// Indicates if the User must be prompted to use NFC enable card
			// Unsupported in this Agent
			NFC: true,
			
			// The IX Token returned from the AS after successful authN
			IXToken: '',
			
			// Error Message - a natural language description of the error for the user
			ErrorMessage: '',
			
			// Error code for  Client App
			// “USER_CANCELLED”: The User cancelled the transaction. 
			// “INVALID_APP_ID”: Registrar did not recognize the App ID. 
			// “INVALID_REQUEST”: The Request structure or signature is invalid. 
			// “INVALID_RETURN_URL”: The ReturnURL is not registered for this App ID with the Registrar.
			ClientAppErrorCode: '',
			
			// Error message for Client App
			ClientAppErrorMessage: '',
			
			// A flag to indicate the transaction is aborted
			Abort: false,
			
			// A flag to saw we've parsed the request
			ParsedFlag: false,
			
			// A message to show the user of our progres
			StatusMessage: '',
			
			// How many resources loaded
			ResourceServersLoaded: 0,
			
			// How many resources we've loaded thus far
			ResourceServersTotal: null,
			
			// A flag to indicate the user has begon the report process
			Report: false,
			
			// A flag to indicate the user has begon the report process
			ReportConfirmed: false,
			
			// Backbone state management
			IsSync: true,
		},
		
		AppDisplayName: function () {
			var appName = this.get("AppName");
			if (appName) {
				return appName;
			}
			else {
				// Look in cache
				var appName = settings.getAppName(this.get("AppId"));
				if (appName) {
					return appName;
				}
				return "Loading...";
			}
		},
	
		initialize: function() {
			// Get AS URL and deviceId from config
			this.set({"AuthenticationServerURL": settings.getAuthenticationServerURL(), 
				"DeviceId": settings.get("DeviceId"),});
		
			
            console.log("********* IN FUNCTION: initialize");
			// Begin Async registrar and resource server calls
            this.setAgentRequest();                                          
			this.verifyWithRegistrar();
			this.fetchResourceDescriptions();
			
		},
		
		/*
		 * Verifies the calling client app with registrar
		 * /app/verify
		 * NOTE: non-­-standard API, Agent does a POST call with the 
		 * “request” and 
		 * “token” parameters. 
		 * 
		 * Standard JSON response format. 
		 * 
		 * Called by: Personal Agent 
		 * 
		 * Purpose: checks if an Agent Request from an App is valid 
		 * 
		 * “request”: Agent Request received from App 
		 * “token”: agent token 
		 * 
		 */
		verifyWithRegistrar: function () {
			// make URL
			var url = settings.getRegistrarURL() + "/request/verify";
			
			// make data
			var data = {"request": this.get("Request"),
				"token": settings.get("RegistrarToken")};
			console.log("verify data = " + JSON.stringify(data));
			
			// Call Registrar
			$.ajax({url: url, 
				type: "POST",
				data: JSON.stringify(data), 
				contentType: "application/json;", 
				dataType: "json",
				context: this,
				error: function(url) {
					return function(jqXHR, textStatus, errorThrown) {
						this.verifyWithRegistrarError(jqXHR, textStatus, errorThrown, url)
					}}(url),
				success: this.verifyWithRegistrarCallback});
		},
		
		/*
		 * When bad things happen with the registrar
		 */
		verifyWithRegistrarError: function (jqXHR, textStatus, errorThrown, url) {
			this.set({"ErrorMessage": "The registrar is unavailable at: " + url,
				"Abort": true});	
		},
		
		/*
		 * Callback for verify with registrar
		 *  * “result”: 
		 * “name”: App name that was registered at the Registrar 
		 * 
		 * Error codes: 
		 * 
		 * “INVALID_APP_ID”: Unknown App ID in Agent Request. 
		 * “INVALID_REQUEST”: The Agent Request structure or signature is invalid. 
		 * "INVALID_TOKEN”: agent token is invalid
		 */
		verifyWithRegistrarCallback: function (data, textStatus, jqXHR) {
			console.log("registrar data=" + JSON.stringify(data));
			if (textStatus == "success") {
				if (data.result) {
					this.set("AppName", data.result.name);
					settings.addAppName(this.get("AppId"), data.result.name);
				}
				else {
					if (data.error.code == "INVALID_TOKEN") {
						this.set({"Passcode": "",
							"ErrorMessage": "This agent is not recognized by the registrar.  This can happen if the servers data has been reset.  Reset this Agent and enroll again.",
							"Abort": true});
					}
					else if (data.error.code == "INVALID_APP_ID") {
						this.set({"ClientAppErrorCode": "INVALID_APP_ID", 
							"ClientAppErrorMessage": "The registrar is not recognize the app id.",
							"Abort": true});
					}
					else {
						this.set({"ErrorMessage": "Verification with registrar failed with: " + data.error.message,
						"Abort": true});
					}
				}
			}
			else {
				this.set({"ErrorMessage": "Verification with registrar failed with: " + textStatus,
					"Abort": true});
			}
		},
		
		/*
		 * Get IX Token from AS
		 *  we authN with the AS that inclues part of the inbound request
		 * AS URL/token
		 * Call method: POST of JSON object
		 * 	{ “device”: device id
		 * 	, “sar”: signature of Agent Request
		 * , “auth”:{ “passcode”: passcode if entered by User
		 * 	, “authorization”: User AuthZ flag
		 * , “nfc”: flag indicating if NFC was used
		 * }}
		 * “result”: 
		 * “token”: IX Token if successful
		 * Error codes:
		 * “INVALID_DEVICEID”: Invalid device ID
		 */
		startGetIXToken: function (authorized) {
			// Update status and reset error message
			this.set({"Authorized": authorized,
				"StatusMessage": "Calling authentication server..."});
			
			
			var notificationUrl = this.get("NotificationURLFlag");
			

			// Make JS POST data
			var jsData1 = {"device": this.get("DeviceId"),
				"sar": this.get("Sar"),
				"auth": {"passcode": this.get("Passcode"),
						 "authorization": this.get("Authorized")}};
			
			// Add in optional notification URL
			// only if its true
			if (notificationUrl &&
				notificationUrl == "true") {
					jsData1.notificationURL = notificationUrl;
			}
			
			// Convert to JSON
			var data1 = JSON.stringify(jsData1);
			console.log("AS data = " + data1);
			
			// Make URL
			var url1 = this.get("AuthenticationServerURL") + "/token";
			
			// Call AS 
			$.ajax({url: url1, 
				type: "POST",
				data: data1, 
				contentType: "application/json;", 
				dataType: "json",
				context: this,
				error: function (jqXHR, textStatus, errorThrown) {
					this.getIXTokenError (jqXHR, textStatus, errorThrown, url1)},
				success: this.getIXTokenCallback});
		},
		
		/*
		 * When bad things happen to get IX token
		 */
		getIXTokenError: function (jqXHR, textStatus, errorThrown, url) {
			this.set({"ErrorMessage": "The authentication server is unavailable at: " + url,
				"Abort": true,
				"StatusMessage": ""});	
		},
		
		/*
		 * Callback for getIXToken
		 */
		getIXTokenCallback: function (data, textStatus, jqXHR) {
			this.set({"StatusMessage": ""});
			
			// success only means AS responsed
			if (textStatus == "success") {
				// Look for logical errors
				if (data.error) {
					if (data.error.code == "INVALID_PASSCODE") {
						this.set({"Passcode": "",
							"ErrorMessage": "Your passcode was incorrect.  Try again."});
					}
					else if (data.error.code == "INVALID_DEVICEID") {
						this.set({"Passcode": "",
							"ErrorMessage": "This agent is not recognized by the authentication server.  This can happen if the servers data has been reset.  Reset this Agent and enroll again.",
							"Abort": true});
					}
					else {
						this.set({"Passcode": "",
							"ErrorMessage": "Authentication with authentication server failed with: " + data.error.message,
							"Abort": true});
						
					}
					return;
				}
				
				// Get the IX Token out of response
				// update our model state
				this.set({"IXToken": data.result.token,
					"NotificationURL": data.result.notificationURL});
				
				//console.log("IXToken = " + JSON.stringify(data.result.token));
				
				console.log("notification url: " + data.result.notificationURL);
					
				// Save resource ids we've authorized
				settings.addResourceIds(this.get("ResourceIds"));
				
				// Now respond to the Client App
				this.respondToClientApp();
				
				return;
			}
			else {
				this.set({"Passcode": "",
						"ErrorMessage": "Authentication with authentication server failed with: " + textStatus,
						"Abort": true});
			}
			
		},
		
		/*
		 * Fetch resource descriptions from the resources
		 * named in the request.  These are all be done 
		 * async while we collect the user's passcode.
		 */
		fetchResourceDescriptions: function() {
			
			// Loop through each resource url
			var resourceUrls = this.get("Resources");
			if (resourceUrls &&
				resourceUrls.length > 0) {
				this.set("ResourceDescriptions", new Object());
				
				// Set our total
				this.set("ResourceServersTotal", resourceUrls.length);
			}
		
			var i;
			for (i in resourceUrls) {
				// Call RS 			
				var url = resourceUrls[i].valueOf();
				$.ajax({url: url, 
					type: "GET", 
					dataType: "json",
					context: this,
					error: function(url) {
						return function(jqXHR, textStatus, errorThrown) {
							this.fetchResourceDescriptionError(jqXHR, textStatus, errorThrown, url);
						}}(url),
					success: function(url) {
    					return function(data, textStatus, jqXHR) {
    						this.fetchResourceDescriptionCallback(data, textStatus, jqXHR, url);
    					}}(url),
				});
			}
		},

		/*
		 * When bad things happen trying to fetch resource descriptions
		 */
		fetchResourceDescriptionError: function(jqXHR, textStatus, errorThrown, url) {
			this.set({"ErrorMessage": "A resource server is unavailable at: " + url,
			"Abort": true});	
		},
		
		/* 
		 * Call back from each resource server, push into this resource description
		 * and allow the view to update
		 */
		fetchResourceDescriptionCallback:  function (data, textStatus, jqXHR, rsUrl) {
			//console.log("rsUrl: " + rsUrl + "; data: " + JSON.stringify(data));
			// Set status
			
			
			// success only means RS responsed
			if (textStatus == "success") {
				// init
				var rsDescs = this.get("ResourceDescriptions");
				if (!rsDescs) {
					
				}
				
				// Convert MD to HTML
				var converter = new Showdown.converter();
				var resourceDescription = converter.makeHtml(_.escape(data["en"]));
				
				// add description, only EN supported for now.  TODO: make language a setting
				rsDescs[rsUrl] = resourceDescription;
				
				this.set(rsDescs);
				
				// Increment the loaded
				var resourceServersLoaded = this.get("ResourceServersLoaded");
				resourceServersLoaded++;
				this.set("ResourceServersLoaded", resourceServersLoaded);
				
				this.trigger("change:ResourceDescriptions");
			}
			else {
				this.set({"ErrorMessage": "Fetching resource description failed with: " + textStatus,
					"Abort": true});	
			}
		},
		
		/*
		 * Internal function to "crack" the request into Agent useful parts
		 * TODO: add error handling if request does not meet spec
		 * 
		 * example: a2p3.net://token?request=eyJ0eXAiOiJKV1MiLCJhbGciOiJIUzUxMiIsImtpZCI6InAxZjJfR3VfY2hER1lVd1AifQ.eyJpc3MiOiJhcHAuZXhhbXBsZS5jb20iLCJhdWQiOiJpeC5sb2NhbC5hMnAzLm5ldCIsInJlcWV1ZXN0LmEycDMub3JnIjp7InJldHVyblVSTCI6Imh0dHBzOi8vYXBwLmV4YW1wbGUuY29tL3JldHVyblVSTCIsInJlc291cmNlcyI6WyJodHRwczovL2hlYWx0aC5hMnAzLm5ldC9zY29wZS9wcm92X251bWJlciIsImh0dHBzOi8vcGVvcGxlLmEycDMubmV0L3Njb3BlL2RldGFpbHMiXSwiYXV0aCI6eyJwYXNzY29kZSI6dHJ1ZSwiYXV0aG9yaXphdGlvbiI6dHJ1ZX19LCJpYXQiOjEzNTU3ODY4NDB9.OcijfMJ_m_97nj-DQLX_VGoYXUyJaWzjzELoORiLSrRBC1WW8UCuFEC12dnflIEajj3AHUgGz9LRnBipeq0AlQ
		 * 
		 * split the Request on '.'
		 * the first part is the header, not much useful to you there
		 * the second part is the payload
		 * base 64 URL decode the payload
		 * JSON.parse the payload
		 * You now have the resources that you can fetch, and the returnURL for sending results back to the App\
		 * and we'll parse the resource ids while were at it
		 * 
		 * Could set the response error code of:
		 * INVALID_REQUEST
		 */
		setAgentRequest: function() {                                  
            console.log("********** IN FUNCTION: setAgentRequest");
			// Get the request portion
			var parsedUrl = parseUri(this.get("SourceUrl"));
			
			// Requireds'
			var requestParam = parsedUrl.queryKey.request;
            console.log("requestParam = " + requestParam);

			if (!requestParam) { this.set({"ClientAppErrorCode": "INVALID_REQUEST", 
				"ClientAppErrorMessage": "Request missing from query string parameters."}); return;}

			//console.log("state = " + parsedUrl.queryKey.state);
			
			// Optionals'
			var state = "";
			if (parsedUrl.queryKey.state) {
				state = parsedUrl.queryKey.state;
			}

			console.log("notificationURL = " + parsedUrl.queryKey.notificationURL);
			
			var notificationURLFlag = "";
			if (parsedUrl.queryKey.notificationURL) {
				notificationURLFlag = parsedUrl.queryKey.notificationURL;
			}
			
			// Spilt in half
			var requestParamParts = requestParam.split(".");
			if (!requestParamParts ||
				requestParamParts.length != 3) { this.set({"ClientAppErrorCode": "INVALID_REQUEST", 
				"ClientAppErrorMessage": "Missing, too few or many JWT parts in request string."}); return;}
			
			//var firstPart = requestParamParts[0]; // header
			var secondPart = requestParamParts[1]; // body
			var thirdPart = requestParamParts[2]; // sig (aka sar)
			console.log("sig = " + thirdPart);
			
			// Decode it to string
			var decodedSecondPart = atob(secondPart);
			
			// Parse into javascript
			var jsSecondPart = JSON.parse(decodedSecondPart);
			
			// Log decoded second part
			console.log("Parsing request: " + JSON.stringify(jsSecondPart));
			
			// Pull out request.a2p3.org part
			var request = jsSecondPart["request.a2p3.org"];
			
			// Parse each resource url for its id (aka hostname)
			// note: resources are optional
			var i;
			var resourceIds = [];
            if (request.resources &&
                request.resources.length > 0) {
                	
                for (i = 0; i < request.resources.length; i++) {
                	
                	//TODO: do this but use the full URL to get the scope
					// Parse URI
					var parsedUrl = parseUri(request.resources[i]);
					
					// Save hostname
					resourceIds[i] = parsedUrl.host;
				}
			}
			
            console.log("********** returnURL: " + request.requestURL);
            console.log("********** callbackURL: " + request.callbackURL);

			// Do callback URL
			if (request.returnURL &&
				request.returnURL.length > 0 &&
				request.callbackURL &&
				request.callbackURL.length > 0) {
				this.set({"ClientAppErrorCode": "INVALID_REQUEST", 
				"ClientAppErrorMessage": "Both returnUrl and callbackURL were provided.  Use one or the other but not both."}); 
				return;	
			}	
			if (request.returnURL &&
				request.returnURL.length < 1 &&
				request.callbackURL &&
				request.callbackURL.length < 1) {
				this.set({"ClientAppErrorCode": "INVALID_REQUEST", 
				"ClientAppErrorMessage": "Niether returnUrl and callbackURL was provided.  Use one or the other but not both."}); 
				return;	
			}
			
			// Populate my model
			this.set({"Sar": thirdPart,
				"ReturnURL": request.returnURL,
				"CallbackURL": request.callbackURL,
				"Resources": request.resources,
				"ResourceIds": resourceIds,
				"PasscodeFlag": request.auth.passcode,
				"AuthorizeFlag": request.auth.authorization,
				"AppId": jsSecondPart.iss,
				"State": state,
				"NotificationURLFlag": notificationURLFlag,
				"Request": requestParam,
				"ParsedFlag": true});
		},
		
		/*
		 * Handles user cancellations
		 */
		cancel: function () {
			this.set({"ClientAppErrorCode": "USER_CANCELLED",
				"ClientAppErrorMessage": "The User cancelled the transaction."});
			this.respondToClientApp();
		},
		
		
		/*
		 * Call back the Client App using their returnUrl with appended query parameters
		 * Returns: “token”: IX Token if successful, 
		 * “notificationURL”: if requested, supported and authorized 
		 * “state”: the state parameter if provided by the App 
		 * “error”: the error code if a request was not successful 
		 * “errorMessage”: a message about the error
		 */
		respondToClientApp: function () {
			this.set({"StatusMessage": "Responding to " + this.AppDisplayName()});
			
			// Check for return 
			var returnUrl = this.get("ReturnURL");
			var callbackUrl = this.get("CallbackURL");
			console.log("returnUrl = " + returnUrl);
			console.log("callbackUrl = " + callbackUrl);
			
			var url1;
			if (returnUrl &&
				returnUrl.length > 0) {
				url1 = returnUrl;
			}
			else if (callbackUrl &&
				callbackUrl.length > 0) {
				url1 = callbackUrl;	
			}
			
			// Make required parts of the response URL
			url1 += "?token=" + encodeURI(this.get("IXToken"));
			
			// Make optional part NotificationURL
			var notificationURL = this.get("NotificationURL");
			console.log("res notification url = " + notificationURL);
			if (notificationURL) {
				if (settings.get("NotificationDeviceToken")) {
					url1 += "&notificationURL=" + encodeURI(notificationURL);
				}
				else {
					url1 += "&notificationURL=" + "NOTIFICATION_DECLINED";
				}
			}
			
			// Make optional part state
			var state = this.get("State");
			if (state) {
				url1 += "&state=" + state; // This does not need encoding since it was read literally from request URL
			}
			
			// Make optional part Request
			var request = this.get("Request");
			if (request) {
				url1 += "&request=" + request; // This does not need encoding since it was read literally from request URL
			}
			
			// Make optional part error
			var error = this.get("ClientAppErrorCode");
			if (error) {
				url1 += "&error=" + encodeURI(error);
			}
			
			// Make optional part errorMessage
			var errorMessage = this.get("ClientAppErrorMessage");
			if (errorMessage) {
				url1 += "&errorMessage=" + encodeURI(errorMessage);
			}
			
			console.log("Client App response URL: " + url1);
			
			// call appropriate channel of response
			if (returnUrl &&
				returnUrl.length > 0) {
				this.respondToClientAppReturn(url1);
			}
			else if (callbackUrl &&
				callbackUrl.length > 0) {
				this.respondToClientAppCallback(url1);
			}
			else {
				UnhandledError("Unable to return response to app.");
			}
		},
		
		/* 
		 * Client Apps wants a browser invoke to URL
		 */
		respondToClientAppReturn: function () {
			console.log("return path");
			
			// Check for return 
			var returnUrl = this.get("ReturnURL");

            console.log("RETURN URL ==== " + returnUrl);
			
			// Make required parts of the response URL
			var url1 = returnUrl + "?token=" + encodeURI(this.get("IXToken"));
			
			// Make optional part NotificationURL
			var notificationURL = this.get("NotificationURL");
			console.log("res notification url = " + notificationURL);
			if (notificationURL) {
				if (settings.get("NotificationDeviceToken")) {
					url1 += "&notificationURL=" + encodeURI(notificationURL);
				}
				else {
					url1 += "&notificationURL=" + "NOTIFICATION_DECLINED";
				}
			}
			
			// Make optional part state
			var state = this.get("State");
			if (state) {
				url1 += "&state=" + state; // This does not need encoding since it was read literally from request URL
			}
			
			// Make optional part Request
			var request = this.get("Request");
			if (request) {
				url1 += "&request=" + request; // This does not need encoding since it was read literally from request URL
			}
			
			// Make optional part error
			var error = this.get("ClientAppErrorCode");
			if (error) {
				url1 += "&error=" + encodeURI(error);
			}
			
			// Make optional part errorMessage
			var errorMessage = this.get("ClientAppErrorMessage");
			if (errorMessage) {
				url1 += "&errorMessage=" + encodeURI(errorMessage);
			}
			
			console.log("Client App response URL: " + url1);
			
			window.location.href = url1;
		},
		
		/*
		 * Client App wants a web service call instead
		 * returns:
		 * tbd
		 */
		respondToClientAppCallback: function () {
			console.log("callback path");
			
			// Check for return 
			var callbackUrl = this.get("CallbackURL");
			
			// init data
			var data = new Object();
			
			// put in token
			data.token = this.get("IXToken");
			
			// Make optional part NotificationURL
			var notificationURL = this.get("NotificationURL");
			console.log("res notification url = " + notificationURL);
			if (notificationURL) {
				if (settings.get("NotificationDeviceToken")) {
					data.notificationURL = notificationURL;
				}
				else {
					data.notificationURL = "NOTIFICATION_DECLINED";
				}
			}
			
			// Make optional part state
			var state = this.get("State");
			if (state) {
				data.state = state; 
			}
			
			// Make optional part Request
			var request = this.get("Request");
			if (request) {
				data.request = request; 
			}
			
			// Make optional part error
			var error = this.get("ClientAppErrorCode");
			if (error) {
				data.error = error;
				
				// Make optional part errorMessage
				var errorMessage = this.get("ClientAppErrorMessage");
				if (errorMessage) {
					data.errorMessage = errorMessage;
				}
			}
			
			console.log("Client app callback URL = " + callbackUrl);
			console.log("Client App response data: " + JSON.stringify(data));
		
			// Do some back channel call
			$.ajax({url: callbackUrl, 
				type: "POST", 
				dataType: "json",
				contentType: "application/json;", 
				data: JSON.stringify(data),
				context: this,
				error: function(url) {
					return function(jqXHR, textStatus, errorThrown) {
						this.respondToClientAppCallbackFail(jqXHR, textStatus, errorThrown, url);
					}}(callbackUrl),
				success: function(url) {
					return function(data, textStatus, jqXHR) {
						this.respondToClientAppCallbackOK(data, textStatus, jqXHR, url);
					}}(callbackUrl),
			});
		},
		
		/*
		 * When bad things happen responding to client app via JSON
		 */
		respondToClientAppCallbackFail: function (jqXHR, textStatus, errorThrown, url) {
			this.set({"ErrorMessage": "Client App callback failed with: " + errorThrown,
			"Abort": true});	
		},
		
		/*
		 * We've got an 200 from client app
		 */
		respondToClientAppCallbackOK: function (data, textStatus, jqXHR, url) {
			// success only means RS responsed
			if (textStatus == "success") {
				// Move nav 
				app.navigate("", true);
			}
			else {
				this.set({"ErrorMessage": "Client App callback failed with:  " + textStatus,
					"Abort": true});	
			}
		},
		
		/*
		 * User wishes to report this app to the Registrar
		 */
		report: function () {
			// Tell the user what is going on
			this.set({"StatusMessage": "Reporting " + this.AppDisplayName() + " to registrar... "});
			
			// make url
			var url = settings.getRegistrarURL() + "/report";
			
			// make data
			var data = {"request": this.get("Request"),
				"token": settings.get("RegistrarToken")};
			
			// Do some back channel call
			$.ajax({url: url, 
				type: "POST", 
				dataType: "json",
				contentType: "application/json;", 
				data: JSON.stringify(data),
				context: this,
				error: function(url) {
					return function(jqXHR, textStatus, errorThrown) {
						this.reportFailed(jqXHR, textStatus, errorThrown, url);
					}}(url),
				success: function(url) {
					return function(data, textStatus, jqXHR) {
						this.reportCallback(data, textStatus, jqXHR, url);
					}}(url),
			});
		},
		
		/*
		 * When bad things happen with reporting a failure
		 */
		reportFailed: function (jqXHR, textStatus, errorThrown, url) {
			this.set({"ErrorMessage": "The registrar is unavailable at: " + url,
				"Abort": true});	
		},
		
		/*
		 * Registrar called back from report
		 */
		reportCallback: function (data, textStatus, jqXHR, url) {
			// Clear status
			this.set({"StatusMessage": ""});
			
			// success only means registrar responsed
			if (textStatus == "success") {
				if (data.result &&
					data.result.success) {
					this.set("ReportConfirmed", true);	
					return;
				}
				else {
					this.set({"ErrorMessage": "Registrar failed with: " + data.error.message,
					"Abort": true});	
				}
			}
			
			this.set({"ErrorMessage": "Registrar failed with: " + textStatus,
				"Abort": true});	
		},
	});
	
	
})();
