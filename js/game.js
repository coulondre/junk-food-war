$(window).load(function() {
	game.init();
});

var game = {
	// Start initializing objects, preloading assets and display start screen
	init: function() {
		// Initialize objects
		levels.init();

		// Hide all game layers and display the start screen
		$(".gamelayer").hide();
		$("#gamestartscreen").show();
		
		// Get handler for game canvas and context
		game.canvas = $("#gamecanvas")[0];
		game.context = game.canvas.getContext('2d');

		// Play button listener
		$("#play").on("click", function() {
			game.showLevelScreen();
		});
	},

	showLevelScreen: function() {
		$(".gamelayer").hide();
		$("#levelselectscreen").show("slow");
	}
}

var levels = {
	// Level data
	data: [
		{ // First Level
			foreground: 'desert-foreground',
			background: 'clouds-background',
			entities: []
		},
		{ // Second Level
			foreground: 'desert-foreground',
			background: 'clouds-background',
			entities: []
		},
	],
	// Initialize level selection screen
	init:function() {
		var html = "";
		var levelLength = levels.data.length;
		for (var i=0; i < levelLength; i++) {
			var level = levels.data[i];
			html += '<input type="button" value="'+ (i+1) + '" > '; 
		};
		$("#levelselectscreen").html(html);

		// Set the button click event handlers to load level
		$("#levelselectscreen input").on("click", function() {
			levels.load(this.value-1);
			$("#levelselectscreen").hide();
		});
	},

	load:function(number) {

	} 
}


// The images and sounds assets loader
var loader = {
	loaded: true,
	loadedCount: 0, // Assets that have been loaded so far
	totalCount: 0, // Total number of assets that need to be loaded

}