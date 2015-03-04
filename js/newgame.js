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
    // Global variables
    var jsonURL = "http://localhost/junk-food-war/game.json";

    // Game Class
    var Game = function() {
        this.gameJSON;
        this.canvas = $("#gamecanvas")[0];
        this.context = this.canvas.getContext('2d');
        this.levels = [];
        this.currentLevel = {};
        this.loader;

    };

    Game.prototype.jsonLoad = function(url) {
        // Load JSON file representing the game
        var self = this;
        $.getJSON(url, function(data) {
            self.gameJSON = data.response;
            self.init();
        }).error(function(e) {
            console.log(e);      
        });
    };

    Game.prototype.init = function() {
        // Initialize Levels
        this.initLevels();

        // Hide all game layers and display the start screen
        $(".gamelayer").hide();
        $("#gamestartscreen").show();

        // Play button listener
        var self = this;
        $("#play").on("click", function() {
            self.showLevelScreen();
        });
    };

    Game.prototype.initLevels = function() {
        var html = "";
        var nbLevel = this.gameJSON.levels.length;
        for (var i=0; i < nbLevel; i++) {
            var level = this.gameJSON.levels[i];
            html += '<input type="button" value="'+ (i+1) + '" > '; 
        };
        $("#levelselectscreen").html(html);

        // Set the button click event handlers to load level
        var self = this;
        $("#levelselectscreen input").on("click", function() {
            self.currentLevel = new Level(this.value-1, self);
            self.currentLevel.load();
            $("#levelselectscreen").hide();
        });
    };

    Game.prototype.showLevelScreen = function() {
        $(".gamelayer").hide();
        $("#levelselectscreen").show("slow");
    };

    // Level Class
    var Level = function(number, game) {
        this.game = game;
        this.number = number;
        this.assets = game.gameJSON.levels[number];
        this.heros = [];
        this.mode = "intro";
        this.slingshotX = 140;
        this.slingshotY = 280;
        this.offsetLeft = 0;
        this.ended = false;
        this.score = 0;
        this.animationFrame; // will be initialize in start() method
        this.background; // will be initialize in load method
        this.foreground; // will be initialize in load method
        this.slingshotImage; // will be initialize in load method
        this.slingshotFrontImage; // will be initialize in load method
        this.loader; // loader object that will load all the assets
    };

    Level.prototype.load = function() {
        $("score").html("Score: " + this.score);
        this.loader = new Loader(this);
        this.loader.init();

        // Load the level assets (i.e: background, foreground and slingshot images)
        this.backgroundImage = this.loader.loadImage(this.assets.background);
        this.foregroundImage = this.loader.loadImage(this.assets.foreground);
        this.slingshotImage = this.loader.loadImage(this.assets.slingshotImage);
        this.slingshotFrontImage = this.loader.loadImage(this.assets.slingshotFrontImage);

        // Call level.start() once the assets have loaded
        if (this.loader.loaded) {
            this.start();
        } else {
            this.loader.onload = this.start.bind(this);
        }
    };

    Level.prototype.start = function() {
        $('.gamelayer').hide();
        // Display the game canvas and score 
        $('#gamecanvas').show();
        $('#scorescreen').show();

        var self =  this;
        this.animationFrame = window.requestAnimationFrame(function() {
                                                                self.animate();
                                                            }, self.canvas);
    };

    Level.prototype.handlePanning = function() {
        this.offsetLeft++;
    };

    Level.prototype.animate = function() {
        // Animate the background
        this.handlePanning();

        // Animate the characters
        // TODO

        // Draw the background with parallax scrolling
        game.context.drawImage(this.backgroundImage, this.offsetLeft/4, 0, 640, 480, 0, 0, 640, 480);
        game.context.drawImage(this.foregroundImage, this.offsetLeft, 0, 640, 480, 0, 0, 640, 480);
        game.context.drawImage(this.slingshotImage, this.slingshotX - this.offsetLeft, this.slingshotY);
        game.context.drawImage(this.slingshotFrontImage, this.slingshotX - this.offsetLeft, this.slingshotY);

        if (!this.ended) {
            var self =  this;
            this.animationFrame = window.requestAnimationFrame(function() {
                                                                    self.animate();
                                                                }, self.canvas);
        }
    };

    // Loader Class
    var Loader = function(level) {
        this.level = level;
        this.loaded = true;
        this.loadedCount = 0; // Assets that have been loaded so far
        this.totalCount = 0; // Total number of assets that need to be loaded
        this.soundFileExtn = ".ogg"; // Default initialization of sound file extension
    };

    Loader.prototype.init = function() {
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
        this.soundFileExtn = oggSupport?".ogg":mp3Support?".mp3":undefined;

        // Initialize the totalCount attribute;
        this.countAssets();
    };

    Loader.prototype.countAssets = function() {
        var nbAssets = Object.keys(this.level.assets).length; // Warning this is not compatible w/ IE < IE9+
        this.totalCount = nbAssets;
    }

    Loader.prototype.loadImage = function(url) {
        this.loaded = false;
        $("#loadingscreen").show();
        var image = new Image();
        image.src = url;
        image.onload = this.itemloaded.bind(this);
        return image;
    };

    Loader.prototype.loadSound = function(url) {
        this.loaded = false;
        $("loadingscreen").show();
        var audio = new Audio();
        audio.src = url + this.soundFileExtn;
        audio.addEventListener("canplaythrough", this.itemLoaded.bind(this), false);
        return audio;
    };

    Loader.prototype.itemloaded = function() {
        this.loadedCount ++;
        $("#loadingmessage").html("Loaded " + this.loadedCount + " of " + this.totalCount);
        if (this.loadedCount === this.totalCount) {
            // Loader has loaded completely
            this.loaded = true;
            // Hide Loading screen
            $("loadingscreen").hide();
            // and call the loader .onload method if it exists
            if(this.onload) {
                this.onload();
                this.onload = undefined;
            }
        }
    };

    //Game initialization
    var game = new Game();
    game.jsonLoad(jsonURL);
});