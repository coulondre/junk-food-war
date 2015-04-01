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
    // Box2D global variables defined for convenience
    var b2Vec2 = Box2D.Common.Math.b2Vec2;
    var b2BodyDef = Box2D.Dynamics.b2BodyDef;
    var b2Body = Box2D.Dynamics.b2Body;
    var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
    var b2Fixture = Box2D.Dynamics.b2Fixture;
    var b2World = Box2D.Dynamics.b2World;
    var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
    var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
    var b2DebugDraw = Box2D.Dynamics.b2DebugDraw;

    // Game Class
    var Game = function() {
        this.gameJSON;
        this.physicEngine;
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

    var Box2DEngine = function() {
        this.scale = 30;
        this.world;
    };

    Box2DEngine.prototype.init = function(){
        // Setup the box2d World that will do most of they physics calculation
        var gravity = new b2Vec2(0,9.8); //declare gravity as 9.8 m/s^2 downwards
        var allowSleep = true; //Allow objects that are at rest to fall asleep and be excluded from calculations
        this.world = new b2World(gravity,allowSleep);

        // Setup debug draw
        var debugContext = document.getElementById('debugcanvas').getContext('2d');
        var debugDraw = new b2DebugDraw();
        debugDraw.SetSprite(debugContext);
        debugDraw.SetDrawScale(this.scale);
        debugDraw.SetFillAlpha(0.3);
        debugDraw.SetLineThickness(1.0);
        debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);    
        this.world.SetDebugDraw(debugDraw);
    };

    Box2DEngine.prototype.createRectangle = function(entity) {
        var bodyDef = new b2BodyDef;
        if(entity.isStatic){
            bodyDef.type = b2Body.b2_staticBody;
        } else {
            bodyDef.type = b2Body.b2_dynamicBody;
        }
        
        bodyDef.position.x = entity.position.x/this.scale;
        bodyDef.position.y = entity.position.y/this.scale;
        if (entity.shape.angle) {
            bodyDef.angle = Math.PI*entity.shape.angle/180;
        }
        
        var fixtureDef = new b2FixtureDef;
        fixtureDef.density = entity.definition.density;
        fixtureDef.friction = entity.definition.friction;
        fixtureDef.restitution = entity.definition.restitution;

        fixtureDef.shape = new b2PolygonShape;
        fixtureDef.shape.SetAsBox(entity.shape.width/2/this.scale,entity.shape.height/2/this.scale);
        
        var body = this.world.CreateBody(bodyDef); 
        body.SetUserData(entity);
        
        var fixture = body.CreateFixture(fixtureDef);
        return body;
    };

    Box2DEngine.prototype.createCircle = function(entity) {
        var bodyDef = new b2BodyDef;
        if(entity.isStatic){
            bodyDef.type = b2Body.b2_staticBody;
        } else {
            bodyDef.type = b2Body.b2_dynamicBody;
        }
        
        bodyDef.position.x = entity.position.x/this.scale;
        bodyDef.position.y = entity.position.y/this.scale;
        
        if (entity.shape.angle) {
            bodyDef.angle = Math.PI*entity.shape.angle/180;
        }           
        var fixtureDef = new b2FixtureDef;
        fixtureDef.density = entity.definition.density;
        fixtureDef.friction = entity.definition.friction;
        fixtureDef.restitution = entity.definition.restitution;

        fixtureDef.shape = new b2CircleShape(entity.shape.radius/this.scale);
        
        var body = this.world.CreateBody(bodyDef); 
        body.SetUserData(entity);

        var fixture = body.CreateFixture(fixtureDef);
        return body;
    };

    // Level Class
    var Level = function(number, game) {
        this.game = game;
        this.loader; // loader object that will load all the assets
        this.mouse;
        this.engine;
        this.number = number;
        this.assets = game.gameJSON.levels[number];
        this.entities = [];
        this.mode = "intro";
        // the following 4 attributes will be initialize during loadStaticObjects method
        this.slingshotX;
        this.slingshotY;
        this.slingshotFrontX;
        this.slingshotFrontY;
        this.offsetLeft = 0; // Variable defined for screen panning and parallax
        this.ended = false;
        this.score = 0;
        this.maxSpeed = 3;
        this.minOffset = 0;
        this.maxOffset = 300;

        this.animationFrame; // Will be initialize in start() method
        this.background; // Will be initialize in load method
        this.foreground; // Will be initialize in load method
        this.slingshotImage; // Will be initialize in load method
        this.slingshotFrontImage; // Will be initialize in load method
       
    };

    Level.prototype.init = function() {
        this.loader = new Loader(this);
        this.loader.init();
        this.mouse = new Mouse();
        this.mouse.init();
        this.engine = new Box2DEngine();
        this.engine.init();
        this.load();
    };

    Level.prototype.load = function() {
        $("score").html("Score: " + this.score);
        // Will create the Box2D object if necessary and load all the necessary images for the level 
        this.loadStaticObjects();
        this.createEntities();
    };

    // Load the statics objects : background, foreground ans slingshotS
    Level.prototype.loadStaticObjects = function() {
        this.backgroundImage = this.loader.loadImage(this.assets.background.url);
        this.foregroundImage = this.loader.loadImage(this.assets.foreground.url);
        // Initialize the x an y of the slingshot and load the assets
        this.slingshotX = this.assets.slingshotImage.position.x;
        this.slingshotY = this.assets.slingshotImage.position.y;
        this.slingshotImage = this.loader.loadImage(this.assets.slingshotImage.url);

        this.slingshotFrontX = this.assets.slingshotFrontImage.position.x;
        this.slingshotFrontY = this.assets.slingshotFrontImage.position.y;
        this.slingshotFrontImage = this.loader.loadImage(this.assets.slingshotFrontImage.url);
    };

    // create the entities for the current level and load the associated assets
    Level.prototype.createEntities = function() {
        var entitiesProp = this.assets.entities
        var entitiesLength = entitiesProp.length;
        for (var i = 0; i < entitiesLength; i++) {
            this.createEntity(entitiesProp[i]);
        };
    };

    // Create an entity
    Level.prototype.createEntity = function(entity) {
        // create the definition, i.e: density, friction, restitution of the entity
        var definition = new EntityDef(entity.definition.name, entity.definition.density, entity.definition.friction, entity.definition.restitution);
        if(!definition){
            console.log ("Undefined entity name",entity.definition.name);
            return;
        }
        // create the entity based on his type
        switch(entity.type){
            case "ground":
                var newEntity = new Ground(definition, entity.shape, entity.position, entity.url);
                this.engine.createRectangle(newEntity);              
                break;  
            case "block":
                var newEntity = new Block(definition, entity.shape, entity.position,entity.url, entity.fullHealth);
                this.engine.createRectangle(newEntity);           
                break;
            case "hero":
                var newEntity = new Hero(definition, entity.shape, entity.position, entity.url);
                newEntity.radius = entity.shape.radius;
                this.engine.createCircle(newEntity);
                break;
            case "villain": // can be circles or rectangles
                var newEntity = new Villain(definition, entity.shape, entity.position, entity.url, entity.fullHealth, entity.calories);
                if(entity.shape.type === "circle"){
                    newEntity.radius = entity.shape.radius;
                    this.engine.createCircle(newEntity);                  
                } else if(entity.shape.type === "rectangle"){
                    newEntity.width = entity.shape.width;
                    newEntity.height = entity.shape.height;
                    this.engine.createRectangle(newEntity);                   
                };
                break;                          
            default:
                console.log("Undefined entity type",entity.type);
                break;
        }
        // load the image if necessary
        if (newEntity.toBeDrawn) {
                    newEntity.sprite = this.loader.loadImage(entity.url);
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

    Level.prototype.animate = function() {
        // Animate the background
        this.handlePanning();

        // Animate the characters
        // TODO

        // Draw the statics objects (background, foreground, slingshot) with parallax scrolling
        this.game.context.drawImage(this.backgroundImage, this.offsetLeft/4, 0, 640, 480, 0, 0, 640, 480);
        this.game.context.drawImage(this.foregroundImage, this.offsetLeft, 0, 640, 480, 0, 0, 640, 480);
        this.game.context.drawImage(this.slingshotImage, this.slingshotX - this.offsetLeft, this.slingshotY);
        this.game.context.drawImage(this.slingshotFrontImage, this.slingshotFrontX - this.offsetLeft, this.slingshotFrontY);

        // Draw all the bodies
        this.drawAllBodies();

        if (!this.ended) {
            var self =  this;
            this.animationFrame = window.requestAnimationFrame(function() {
                                                                    self.animate();
                                                                }, self.canvas);
        }
    };

    Level.prototype.drawAllBodies = function() {
        this.engine.world.DrawDebugData();

        // Iterate through all the bodies and draw them on the canvas
        for (var body = this.engine.world.GetBodyList(); body; body = body.GetNext()) {
            var entity = body.GetUserData();
    
            if (entity != null && entity.toBeDrawn) {
                var position = body.GetPosition();
                var angle = body.GetAngle();
                // Translate and rotate the canvas context to the position and angle of the entity
                this.game.context.translate(position.x*this.engine.scale-this.offsetLeft, position.y*this.engine.scale);
                this.game.context.rotate(angle);
                // Draw the entity
                entity.draw(this.game.context);
                // Translate and rotate the context back to the original position
                this.game.context.rotate(-angle);
                this.game.context.translate(-position.x*this.engine.scale+this.offsetLeft, -position.y*this.engine.scale);
            }
        };
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

    Loader.prototype.countAssets = function() { // This method need to be refactor
        var currentLevel = this.level.assets;

        var staticObjectsArray = currentLevel.staticObjects;
        var staticObjectsArrayLength = staticObjectsArray.length;
        for (var i = 0; i < staticObjectsArrayLength; i++) {
            if(staticObjectsArray[i].url != "undefined") { this.totalCount++; }
        };
        console.log(this.totalCount);

        var entityArray = currentLevel.entities;
        var entityArrayLength = entityArray.length;
        for (var i = 0; i < entityArrayLength; i++) {
            if(entityArray[i].url != "undefined") { this.totalCount++; }
        };
        console.log(this.totalCount);
        /*var nbAssets = Object.keys(this.level.assets).length; // Warning this is not compatible w/ IE < IE9+
        // WARNING: BAD CODE, NEED TO BE FIXED
        this.totalCount = 12;*/
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
    var Entity = function(definition, shape, position, url) {
        this.definition = definition;
        this.shape = shape;
        this.position = position;
        this.url = url;
        this.isStatic = false; // By default an entity is dynamic
        if (this.url === "undefined") {
            this.toBeDrawn = false;    
        } else {
            this.toBeDrawn = true; // By default an entity will be drawn in the canvas
        }
        this.sprite; // Will be initialize in method createEntity of class Level
    };

    Entity.prototype.draw = function(context) {
        if (this.shape.type === "circle"){
            context.drawImage(this.sprite,0,0,this.sprite.width,this.sprite.height,
                    -this.shape.radius-1,-this.shape.radius-1,this.shape.radius*2+2,this.shape.radius*2+2); 
        } else if (this.shape.type=="rectangle"){
            context.drawImage(this.sprite,0,0,this.sprite.width,this.sprite.height,
                    -this.shape.width/2-1,-this.shape.height/2-1,this.shape.width+2,this.shape.height+2);
        }
    };

    // Ground Class --> Subclass of Entity
    var Ground = function(definition, shape, position, url) {
        Entity.call(this, definition, shape, position, url);
        this.isStatic = true;
    };
    Ground.prototype = Object.create(Entity.prototype);
    Ground.prototype.constructor = Ground;

    Ground.prototype.draw = function(context) {
        Entity.prototype.draw.call(this, context); // Call the method draw of the super class
    };

    // Block Class --> Subclass of Entity
    var Block = function(definition, shape, position, url, fullHealth) {
        Entity.call(this, definition, shape, position, url);
        this.fullHealth = fullHealth;
    };
    Block.prototype = Object.create(Entity.prototype);
    Block.prototype.constructor = Block;

    Block.prototype.draw = function(context) {
        Entity.prototype.draw.call(this, context); // Call the method draw of the super class
    };

    // Hero Class --> Subclass of Entity
    var Hero = function(definition, shape, position, url) {
        Entity.call(this, definition, shape, position, url);
    };
    Hero.prototype = Object.create(Entity.prototype);
    Hero.prototype.constructor = Hero;

    Hero.prototype.draw = function(context) {
        Entity.prototype.draw.call(this, context); // Call the method draw of the super class
    };

    // Villains Class --> Subclass of Entity
    var Villain = function(definition, shape, position, url, fullHealth, calories) {
        Entity.call(this, definition, shape, position, url);
        this.fullHealth = fullHealth;
        this.calories = calories;
    };
    Villain.prototype = Object.create(Entity.prototype);
    Villain.prototype.constructor = Villain;

    Villain.prototype.draw = function(context) {
        Entity.prototype.draw.call(this, context); // Call the method draw of the super class
    };
    
    // EntityType Class
    // Define the fixtures parameters of an Entity for the Physic Engine, the url of the image asset and the details on the shape
    // style = {shape: "rectangle", width:40, height:50}
    // style = {shape: "circle", radius:25}
    var EntityDef = function(name, density, friction, restitution) {
        this.name = name;
        this.density = density;
        this.friction = friction;
        this.restitution = restitution;
    };

    //Main
    var game = new Game();
    //game.jsonLoad(jsonURL);
    game.init(jsonURL);
});