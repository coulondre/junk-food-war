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

    Game.prototype.init = function(url) {
        // Hide all game layers and display the start screen
        $(".gamelayer").hide();
        $("#gamestartscreen").show();

        // Play button listener
        var self = this;
        $("#play").on("click", function() {
            self.showLevelScreen();
        });

        // Load JSON file representing the game
        var self = this;
        $.ajax({
            type: "GET",
            url: url,
            async: false,
            success: function(data) {
            self.gameJSON = data.response;
            }
        });

        // Initialize Levels
        this.initLevels();
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
            self.currentLevel.init();
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
        this.loader; // loader object that will load all the assets
        this.mouse;
        this.number = number;
        this.assets = game.gameJSON.levels[number];
        this.entities = [];
        this.mode = "intro";
        this.slingshotX = 140;
        this.slingshotY = 280;
        this.offsetLeft = 0; // Variable defined for screen panning and parallax
        this.ended = false;
        this.score = 0;
        this.maxSpeed = 3;
        this.minOffset = 0;
        this.maxOffset = 300;

        this.animationFrame; // will be initialize in start() method
        this.background; // will be initialize in load method
        this.foreground; // will be initialize in load method
        this.slingshotImage; // will be initialize in load method
        this.slingshotFrontImage; // will be initialize in load method
       
    };

    Level.prototype.init = function() {
        this.loader = new Loader(this);
        this.loader.init();
        this.mouse = new Mouse();
        this.mouse.init();
        this.load();
        // tests Entity Class and Vilain and Hero Subclass
        // TODO :
        // * remove it once it will be ok
        // * create a method of class Level : createEntities which will create
        // all the entities of the level based on the json config file
        var dirt = new Entity(3.0,1.5,0.2);
        console.log(dirt);
        dirt.create();
        var glass = new Entity(2.4,0.4,0.15);
        console.log(glass);
        glass.create();
        var burger = new Vilain(1,0.5,0.4,40,{shape:"circle", radius:25});
        console.log(burger);
        burger.create();
        var sodacan = new Vilain(1,0.5,0.7,80,{shape:"reactangle", width:40, height:60});
        console.log(sodacan);
        sodacan.create();
        var orange = new Hero(1.5,0.5,0.4,{shape:"circle", radius:25});
        console.log(orange);
        orange.create();
    };

    Level.prototype.load = function() {
        $("score").html("Score: " + this.score);
        // Load the level assets (i.e: background, foreground and slingshot images)
        this.backgroundImage = this.loader.loadImage(this.assets.background);
        this.foregroundImage = this.loader.loadImage(this.assets.foreground);
        this.slingshotImage = this.loader.loadImage(this.assets.slingshotImage);
        this.slingshotFrontImage = this.loader.loadImage(this.assets.slingshotFrontImage);
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

    Level.prototype.animate = function() {
        // Animate the background
        this.handlePanning();

        // Animate the characters
        // TODO

        // Draw the background with parallax scrolling
        this.game.context.drawImage(this.backgroundImage, this.offsetLeft/4, 0, 640, 480, 0, 0, 640, 480);
        this.game.context.drawImage(this.foregroundImage, this.offsetLeft, 0, 640, 480, 0, 0, 640, 480);
        this.game.context.drawImage(this.slingshotImage, this.slingshotX - this.offsetLeft, this.slingshotY);
        this.game.context.drawImage(this.slingshotFrontImage, this.slingshotX - this.offsetLeft, this.slingshotY);

        if (!this.ended) {
            var self =  this;
            this.animationFrame = window.requestAnimationFrame(function() {
                                                                    self.animate();
                                                                }, self.canvas);
        }
    };

    // panTo function pans the screen to a given x coordinate and returns true if the coordinate
    // is near the center of the screen or if the screen has panned to the extreme left or right.
    // It also caps the panning speed using maxSpeed so that the panning never become too fast
    Level.prototype.panTo = function(newCenter) {
        // TODO: Hugly code, please refactor
        if (Math.abs(newCenter-this.offsetLeft-this.game.canvas.width/4)>0 
            && this.offsetLeft <= this.maxOffset && this.offsetLeft >= this.minOffset){
            var deltaX = Math.round((newCenter-this.offsetLeft-this.game.canvas.width/4)/2);
            if (deltaX && Math.abs(deltaX)>this.maxSpeed){
                deltaX = this.maxSpeed*Math.abs(deltaX)/(deltaX);
            }
            this.offsetLeft += deltaX;
        } else {
            
            return true;
        }
        if (this.offsetLeft < this.minOffset){
            this.offsetLeft = this.minOffset;
            return true;
        } else if (this.offsetLeft > this.maxOffset){
            this.offsetLeft = this.maxOffset;
            return true;
        }        
        return false;
    };

    Level.prototype.handlePanning = function() {
        if(this.mode === "intro"){        
            if(this.panTo(700)){
                this.mode = "load-next-hero";
            }             
        }       

        if(this.mode === "wait-for-firing"){
            if (this.mouse.dragging){
                this.panTo(this.mouse.x + this.offsetLeft)
            } else {
                this.panTo(this.slingshotX);
            }
        }
        
        if (this.mode === "load-next-hero"){
            // TODO: 
            // Check if any villains are alive, if not, end the level (success)
            // Check if there are any more heroes left to load, if not end the level (failure)
            // Load the hero and set mode to wait-for-firing
            this.mode = "wait-for-firing";            
        }
        
        if(this.mode === "firing"){  
            this.panTo(this.slingshotX);
        }
        
        if (this.mode === "fired"){
            // TODO:
            // Pan to wherever the hero currently is
        }
    };

    Level.prototype.showEndingScreen = function() {
        if (this.mode === "level-success"){
            if(this.number < this.gameJSON.levels.length-1){
                $("#endingmessage").html("Level Complete. Well Done!!!");
                $("#playnextlevel").show();
            } else {
                $("#endingmessage").html("All Levels Complete. Well Done!!!");
                $("#playnextlevel").hide();
            }
        } else if (this.mode === "level-failure"){          
            $("#endingmessage").html("Failed. Play Again?");
            $("#playnextlevel").hide();
        }       
        $('#endingscreen').show();
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
    };

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
            // and call the level start method
            this.level.start();
        }
    };

    // Mouse Class
    var Mouse = function() {
        this.x = 0;
        this.y = 0;
        this.down = false;
        this.dragging = false;
        this.downX;
        this.downY;
    };

    Mouse.prototype.init = function () {
        // Set event handler for when the mouse is moved, is pressed and released
        //and when the mouse leave the canvas area
        $("#gamecanvas").mousemove(this, this.mousemovehandler);
        $("#gamecanvas").mousedown(this, this.mousedownhandler);
        $("#gamecanvas").mouseup(this, this.mouseuphandler);
        $("#gamecanvas").mouseout(this, this.mouseuphandler);
    };

    Mouse.prototype.mousemovehandler = function(ev) {
        var offset = $("#gamecanvas").offset();

        ev.data.x = ev.pageX - offset.left;
        ev.data.y = ev.pageY - offset.top;

        if(ev.data.down) {
            ev.data.dragging = true;
        }
    };

    Mouse.prototype.mousedownhandler = function(ev) {
        ev.data.down = true;
        ev.data.downX = this.x;
        ev.data.downY = this.y;
        ev.originalEvent.preventDefault();
    };

    Mouse.prototype.mouseuphandler = function(ev) {
        ev.data.down = false;
        ev.data.dragging = false;
    };

    // Entity Class
    var Entity = function(density, friction, restitution, fullHealth) {
        this.density = density;
        this.friction = friction;
        this.restitution = restitution;
        this.fullHealth = fullHealth || "undefined";
    };
    
    // Create a Box2D body and add it to the world
    Entity.prototype.create = function() {
        console.log("Ca marche ça mère");
    };

    // Draw the entity in to the game canvas
    Entity.prototype.draw = function() {

    };

    // Hero Class --> Subclass of Entity
    // stle = {shape: "circle", radius:25}
    var Hero = function(density, friction, restitution, style) {
        Entity.call(this,density,friction, restitution);
        this.style = style;
    };
    Hero.prototype=Object.create(Entity.prototype);
    Hero.prototype.constructor = Hero;

    // Vilains Class --> Subclass of Entity
    // style = {shape: "rectangle", width:40, height:50}
    var Vilain = function(density, friction, restitution, fullHealth, style) {
        Entity.call(this,density,friction, restitution, fullHealth);
        this.style = style;
    };
    Vilain.prototype=Object.create(Entity.prototype);
    Vilain.prototype.constructor = Vilain;

    //Main
    var game = new Game();
    //game.jsonLoad(jsonURL);
    game.init(jsonURL);
});