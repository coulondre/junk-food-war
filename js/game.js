// Setup requestAnimationFrame and cancelAnimationFrame for use in the game code
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = 
          window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

$(window).load(function() {
	game.jsonLoad();
});

var game = {
	jsonLoad:function() {
		// Load JSON file representing the game
		var gameJsonURL = "http://localhost/junk-food-war/game.json";
		$.getJSON(gameJsonURL, function(data) {
			game.gameJSON = data.response;
			game.init();
		}).error(function(e) {
		    console.log(e);      
		});
	},
	// Start initializing objects, preloading assets and display start screen
	init:function() {
		// Initialize objects
		levels.init();
		loader.init();

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

	showLevelScreen:function() {
		$(".gamelayer").hide();
		$("#levelselectscreen").show("slow");
	},

	// Game Mode
	mode:"intro", 
    // X & Y Coordinates of the slingshot
	slingshotX:140,
    slingshotY:280,

    start:function(){
        $('.gamelayer').hide();
        // Display the game canvas and score 
        $('#gamecanvas').show();
        $('#scorescreen').show();

        game.mode = "intro";    
        game.offsetLeft = 0;
		game.ended = false;
		game.animationFrame = window.requestAnimationFrame(game.animate,game.canvas);
    },

    handlePanning:function() {
    	game.offsetLeft++;
    },

    animate:function() {
    	// Animate the background
    	game.handlePanning();

    	// Animate the characters
    	// TODO

    	// Draw the background with parallax scrolling
    	game.context.drawImage(game.currentLevel.backgroundImage, game.offsetLeft/4, 0, 640, 480, 0, 0, 640, 480);
    	game.context.drawImage(game.currentLevel.foregroundImage, game.offsetLeft, 0, 640, 480, 0, 0, 640, 480);
    	game.context.drawImage(game.slingshotImage, game.slingshotX - game.offsetLeft, game.slingshotY);
    	game.context.drawImage(game.slingshotFrontImage, game.slingshotX - game.offsetLeft, game.slingshotY);

    	if (!game.ended) {
    		game.animationFrame = window.requestAnimationFrame(game.animate, game.canvas);
    	}
    }

}

var levels = {
	// Initialize level selection screen
	init:function() {
		var html = "";
		var levelLength = game.gameJSON.levels.length;
		for (var i=0; i < levelLength; i++) {
			var level = game.gameJSON.levels[i];
			html += '<input type="button" value="'+ (i+1) + '" > '; 
		};
		$("#levelselectscreen").html(html);

		// Set the button click event handlers to load level
		$("#levelselectscreen input").on("click", function() {
			levels.load(this.value-1);
			$("#levelselectscreen").hide();
		});
	},

	// Load all data and images for a specific level
	load:function(number) {
		// Declare a new current level object
		game.currentLevel = {
			number: number,
			hero: []
		};
		game.score = 0;
		$("score").html("Score: " + game.score);
		var level = game.gameJSON.levels[number];
		console.log(level.background);
		console.log(level.foreground);
		console.log(game.gameJSON.slingshotImage);
		console.log(game.gameJSON.slingshotFrontImage);

		// Load the background, foreground and slingshot images
		game.currentLevel.backgroundImage = loader.loadImage(level.background);
		game.currentLevel.foregroundImage = loader.loadImage(level.foreground);
		game.slingshotImage = loader.loadImage(game.gameJSON.slingshotImage);
		game.slingshotFrontImage = loader.loadImage(game.gameJSON.slingshotFrontImage);

		// Call game.start() once the assets have loaded
		if (loader.loaded) {
			game.start();
		} else {
			loader.onload = game.start;
		}
	} 
}


// The images and sounds assets loader
var loader = {
	loaded: true,
	loadedCount: 0, // Assets that have been loaded so far
	totalCount: 0, // Total number of assets that need to be loaded
	soundFileExtn: ".ogg", // Default initialization of sound file extension

	init:function() {
		// check for sound support
		var mp3Support, oggSupport;
		var audio = document.createElement('audio');
		if (audio.canPlayType) {
			// Currently canPlayType() returns: "", "maybe" or "probably"
			mp3Support = "" != audio.canPlayType('audio/mp3');
			oggSupport = "" != audio.canPlayType('audio/ogg; codecs = "vorbis"');

		} else {
			mp3Support = false;
			oggSupport = false;
		}

		// Check for ogg, then mp3, and finally set soundFileExtn to undefined
		loader.soundFileExtn = oggSupport?".ogg":mp3Support?".mp3":undefined;
	},

	loadImage:function(url) {
		this.totalCount ++;
		this.loaded = false;
		$("#loadingscreen").show();
		var image = new Image();
		image.src = url;
		image.onload = loader.itemloaded;
		return image;
	},

	loadSound:function(url) {
		this.totalCount ++;
		this.loaded = false;
		$("loadingscreen").show();
		var audio = new Audio();
		audio.src = url + loader.soundFileExtn;
		audio.addEventListener("canplaythrough", loader.itemLoaded, false);
		return audio;
	},

	itemloaded:function() {
		loader.loadedCount ++;
		$("#loadingmessage").html("Loaded " + loader.loadedCount + " of " + loader.totalCount);
		if (loader.loadedCount === loader.totalCount) {
			// Loader has loaded completely
			loader.loaded = true;
			// Hide Loading screen
			$("loadingscreen").hide();
			// and call the loader .onload method if it exists
			if(loader.onload) {
				loader.onload();
				loader.onload = undefined;
			}
		}
	}
}