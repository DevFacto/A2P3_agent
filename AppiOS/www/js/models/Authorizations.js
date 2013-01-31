/* 
* Copyright (C) Province of British Columbia, 2013
*/
(function() {
	'use strict';

	// ----------
	// Authorization Model
	// ----------

	window.Agent.Authorizations = Backbone.Model.extend({
		
		urlRoot: window.Agent.Context.BaseUrl + '/api/Authorizations',

		// Default attributes
		defaults: {
			RegistrarURL: '',
			RegistrarToken: '',
			ResourceServerIds: [],
			// “apps”: an array of the following object 
			// “app”: App ID “name”: Display name for App 
			// “lastAccess”: time of last access of App 
			// “resources”: array of authorized resource URLs 
			// “request”: an RS Request the agent can use to delete the authorization
			// extended to include 
			// rsRequests {rsUrl, token}
			Apps: null,
			// An object array using the resource server URL as the key
			// "en": "Retrieve your weight records at 'health.bc.local.a2p3.net' at anytime." 
			ResourceDescriptions: null,
			ErrorMessage: '',
			IsSync: true,
		},
	
		initialize: function() {
			
			// get resource server ids from config
			var resourceServerIds = settings.get("ResourceServerIds");
			var registrarUrl = settings.get("RegistrarURL");
			var registrarToken = settings.get("RegistrarToken");
			
			this.set({"ResourceServerIds": resourceServerIds,
				"RegistrarURL": registrarUrl,
				"RegistrarToken": registrarToken,
				"Apps": new Object(),
				"ResourceDescriptions": new Object()});
			
			// if we have any authZ start the process
			if (resourceServerIds && 
				resourceServerIds.length > 0) {
				this.getResourceServerTokens();
			}
		},
		
		/*
		 * Calls registrar to get all the resource server tokens. 
		 * 
		 * /authorizations/requests
		 * 
		 * NOTE: non-­-standard API, Agent does a POST call with the 
		 * “authorizations” and “token” parameters. Standard JSON 
		 * response format. 
		 * 
		 * Called by: Personal Agent 
		 * 
		 * Purpose: gets RS Requests from the Registrar so the Personal Agent can call 
		 * 
		 * Resource Servers “/authorizations/list” 
		 * 
		 * API Parameters: 
		 * 	“authorizations”: comma delimited list of Resource Servers 
		 * 	“token”: registrar token 
		 * 
		 */
		getResourceServerTokens: function () {
			
			// concat the resource server id into authorizations
			var authorizations = this.get("ResourceServerIds");
			var token = this.get("RegistrarToken");
			var url = this.get("RegistrarURL") + "/authorizations/requests";
			
			console.log("Calling registrar at = " + url);
			console.log("token = " + JSON.stringify(token));
			console.log("authorizations = " + JSON.stringify(authorizations));
			
			// Call Registrar
			$.ajax({url: url, 
				type: "POST",
				contentType: "application/json;", 
				data: JSON.stringify({ "token": token ,
					"authorizations": authorizations}),
				context: this,
				error: function(url) {
					return function (jqXHR, textStatus, errorThrown) {
						this.getResourceServerTokensError(jqXHR, textStatus, errorThrown, url);
					}}(url),
				success: this.getResourceServerTokensCallback});
		},
		
		/*
		 * When bad things happen trying to fetch rs tokens
		 */
		getResourceServerTokensError: function(jqXHR, textStatus, errorThrown, url) {
			this.set({"ErrorMessage": "The registrar is unavailable at: " + url});	
		},
		
		
		/*
		 * The callback for getResourceServerTokens
		 * "result”: An array of objects with the properties: 
		 * 		“id”: RS ID 
	 	 *		“request”: RS Request 
 	 	 * Error codes: INVALID_TOKEN”: agent token is invalid
		 */
		getResourceServerTokensCallback: function(data, textStatus, jqXHR) {
			console.log("Resource server data = " + JSON.stringify(data));
			// Look for logical errors
			if (data.error) {
				
				// Update our status and set the message
				this.set({"ErrorMessage": "Fetching resource server tokens from registrar failed with: " + data.error.message});
				return;
			}
			
			// Now we send many requests to resource servers
			var i;
			for (i in data.result) {
				if (data.result.hasOwnProperty(i)) {
					this.getAppsFromResourceServer(i, data.result[i]);
				}
			}
		},
		
		/*
		 * Get
		 * NOTE: Non-­-standard API. 
		 * The Request is generated by the Registrar even though call is 
		 * made by a Personal Agent 
		 * 
		 * Called by: Personal Agent 
		 * 
		 * Purpose: lists all Apps and Resources that have been authorized by User 
		 *
		 */
		
		getAppsFromResourceServer: function (resource, rsToken) {
			console.log("Resource = " + resource);
			// make url
			var url = settings.get("ResourceServerProtocol") + "://" + resource;
			var port = settings.get("ResourceServerPort");
			if (port) {
				url += ":" + port;
			}
			// Call Registrar- 
			$.ajax({url: url + "/authorizations/list", 
				type: "POST",
				contentType: "application/json;", 
				data: JSON.stringify({ "request": rsToken }),
				context: this,
				error: function (url) {
					return function (jqXHR, textStatus, errorThrown) {
						this.getAppsFromResourceServerError(jqXHR, textStatus, errorThrown, url);
					}}(url + "/authorizations/list"),
				success: function(url) {
					return function (data, textStatus, jqXHR) { 
						this.getAppsFromResourceServerCallback(data, textStatus, jqXHR, url);
					}}(url),
				});
		},
		
		/*
		 * When bad things happen trying to fetch apps from rs
		 */
		getAppsFromResourceServerError: function(jqXHR, textStatus, errorThrown, url) {
			this.set({"ErrorMessage": "The resource server is unavailable at: " + url});	
		},
		
		/*
		 * Callback for getAppsFromResourceServer
		 * 
		 * “result”: “apps”: an array of the following object 
		 * 
		 * 		“app”: App ID 
		 * 		“name”: Display name for App 
		 * 		“lastAccess”: time of last access of App 
		 * 		“resources”: array of authorized resource URLs 
		 * 		“request”: an RS Request the agent can use to delete the authorization 
		 * 
		 * Error codes: “INVALID_TOKEN”: Invalid RS Token
		 */
		getAppsFromResourceServerCallback: function (data, textStatus, jqXHR, rsUrl) {
			console.log(data);
			
			// Look for logical errors
			if (data.error) {
				
				// Update our status and set the message
				this.set({"ErrorMessage": "Fetching authorizations from resource server failed with: " + data.error.message});
				return;
			}
			
			// Read each app from the response and call add app
			var i;
			for (i in data.result) {
				if (data.result.hasOwnProperty(i)) {
					this.addApp(i, data.result[i], rsUrl);
				}
			}	
		},
		
		/*
		 * Adds apps to our attribute.  
		 * If app already exists, append resource description URLs and requests
		 */
		addApp: function (appId, app, rsUrl) {
			// init
			var apps = this.get("Apps");
						
			// If the app already exists, append the resource descriptions
			if (apps.hasOwnProperty(appId)) {
			
				apps[appId].resources.concat(app.resources);
				apps[appId].rsRequests = [];
				apps[appId].rsRequests.push({"rsUrl": rsUrl,
					"request": app.request});
					
				// Use the most recent last access - although should be the same
				if (app.lastAccess &&
					app.lastAccess > app[appid].lastAccess) {
					apps[appId].lastAccess = app.lastAccess;		
				}
			}
			else {
				// If it doesn't exist add it
				apps[appId] = app;
						
				// add rs requests
				apps[appId].rsRequests = [];
				apps[appId].rsRequests.push({"rsUrl": rsUrl,
					"request": app.request});
			}
			
			this.set("Apps", apps);
			
			
			// Get resource descriptions for each resources
			var i;
			for (i in apps[appId].resources) {
				if (apps[appId].resources.hasOwnProperty(i)) {
					this.getResourceDescription(apps[appId].resources[i]);
				}
			}
			
		},

		/*
		 * Begin the process of fetching the resource description
		 * Only have to do this once for ALL apps
		 */
		getResourceDescription: function (rsUrl) {
			// Tolerate if a null url is provided - defect logged on A2P3
			console.log("rsUrl = " + rsUrl)
			if (!rsUrl) {
				return;
			}
			// init
			var rsDescs = this.get("ResourceDescriptions");
			
			// Begin AJAX call if we don't have it already
			// Overloads callback function to pass the rsURL
			if (!rsDescs.hasOwnProperty(rsUrl)) {
				console.log("getting resource");
				$.ajax({url: rsUrl, 
					type: "GET", 
					dataType: "json",
					context: this,
					error: function (rsUrl) {
						return function (jqXHR, textStatus, errorThrown) {
							this.getResourceDescriptionError (jqXHR, textStatus, errorThrown, rsUrl);
						}}(rsUrl),
					success: function (rsUrl) {
						return function (data, textStatus, jqXHR) { 
							this.getResourceDescriptionCallback (data, textStatus, jqXHR, rsUrl); 
						}}(rsUrl),
					});				
			}
		},
		
		/*
		 * When bad things happen trying to get resource descriptions
		 */
		getResourceDescriptionError: function (jqXHR, textStatus, errorThrown, url) {
			this.set({"ErrorMessage": "The resource server is unavailable at: " + url});	
		},
		
		/*
		 * Overloaded callback for getResourceDescription, expecting JSON response:
		 * {
		 *  "en": "Access your email address from 'email.local.a2p3.net'."
		 * }
		 */
		getResourceDescriptionCallback: function (data, textStatus, jqXHR, rsUrl) {
			console.log("rsurl = " + rsUrl + "; data = " + JSON.stringify(data));
			if (textStatus == "success") {
				// Look for logical errors
				if (data.error) {
					
					// Update our status and set the message
					this.set({"ErrorMessage": "Fetching resource server failed with: " + data.error.message});
					return;
				}
				
				// init
				var rsDescs = this.get("ResourceDescriptions");
				
				// add description, only EN supported for now.  
				rsDescs[rsUrl] = data["en"];
				
				this.trigger("change");
			}
		},
		
		/*
		 * Given an appId (host), go and delete all the resources it uses
		 */
		deleteAppAuthorizations: function (appId) {
			// init
			var app = this.get("Apps")[appId];
			console.log("appid = " + appId + "; app=" + JSON.stringify(app));
			
			
			// For each resource server request received
			var i;
			for (i in app.rsRequests) {
				
				// make up data
				var data = {"request": app.rsRequests[i].request};
				var url = app.rsRequests[i].rsUrl + "/authorization/delete";
				
				// Call resource server
				$.ajax({url: url,
					type: "POST", 
					dataType: "json",
					contentType: "application/json;", 
					data: JSON.stringify(data),
					context: this,
					error: function (url) {
						return function (jqXHR, textStatus, errorThrown) {
							this.deleteAppAuthorizationsError(jqXHR, textStatus, errorThrown, url);
						}}(url),
					success: function (url) {
						return function (data, textStatus, jqXHR) { 
							this.deleteAppAuthorizationsCallback (data, textStatus, jqXHR, appId); 
						}}(url),
					});		
			}
		},
		
		/*
		 * When bad things happen trying delete authorizations
		 */
		deleteAppAuthorizationsError: function (jqXHR, textStatus, errorThrown, url) {
			this.set({"ErrorMessage": "The resource server is unavailable at: " + url});	
		},
		
		
		/*
		 * Callback for deleteAppAuthorizations
		 */
		deleteAppAuthorizationsCallback: function (data, textStatus, jqXHR, appId) {
			console.log("data" + JSON.stringify(data));
			if (data.error) {
				// Update our status and set the message
				this.set({"ErrorMessage": "When deleting authorization, the resource server failed with: " + data.error.message});
				return;
			}
			else if (data.result.success) {
				// remove the app from our list
				var apps = this.get("Apps");
				delete apps[appId]; 
				this.set({"Apps": apps});
		
				// Fire event explicity
				this.trigger("change");
			}
		}
	});

})();  