$(function($) {
	'use strict';
	
	window.Agent.DemoView = Backbone.View.extend({
	
	    template:_.template($('#demo').html()),
	
		initialize: function(Opts) {
			
		},
		
	    render:function (eventName) {
	        $(this.el).html(this.template());
	        return this;
	    },
	
		events: {
			"click a[id=demoApps] ": "demoApps"
	    },
	    
	    demoApps: function () {
	    	window.location.href = settings.get("DemoAppsURL");
	    }
	    
	});
});