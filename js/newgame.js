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

        // listener for world collisions damage
        var listener = new Box2D.Dynamics.b2ContactListener;
        listener.PostSolve = function(contact,impulse){
            var body1 = contact.GetFixtureA().GetBody();
            var body2 = contact.GetFixtureB().GetBody();
            var entity1 = body1.GetUserData();
            var entity2 = body2.GetUserData();

            var impulseAlongNormal = Math.abs(impulse.normalImpulses[0]);
            // This listener is called a little too often. Filter out very tiny impulses.
            // After trying different values, 5 seems to work well 
            if(impulseAlongNormal>5){
                // If objects have a health, reduce health by the impulse value             
                if (entity1.health){
                    entity1.health -= impulseAlongNormal;
                }   

                if (entity2.health){
                    entity2.health -= impulseAlongNormal;
                }
            } 
        };
        this.world.SetContactListener(listener);
    };

    Box2DEngine.prototype.createEntity = function(entity) {
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

        if (entity.shape.type === "rectangle") {
            fixtureDef.shape = new b2PolygonShape;
            fixtureDef.shape.SetAsBox(entity.shape.width/2/this.scale,entity.shape.height/2/this.scale);
        } else if (entity.shape.type === "circle") {
            fixtureDef.shape = new b2CircleShape(entity.shape.radius/this.scale);
        }

        var body = this.world.CreateBody(bodyDef); 
        body.SetUserData(entity);
        
        var fixture = body.CreateFixture(fixtureDef);
        return body;
    };

    // As per the Box2D manual recommendation:
    // 1/ we should use a fixed time step because variable time steps are hard to debug
    // 2/ Box2D work best with a time step around 1/60 and no larger than 1/30 because if
    //    time step becomes very large Box2D starts having problems with collision
    // 3/ values of 8 and 3 for velocity and position iterations
    Box2DEngine.prototype.step = function(timeStep) {
        // velocity iterations = 8
        // position iterations = 3
        if (timeStep > 1/30) {
            timeStep= 1/30;
        }
        this.world.Step(timeStep,8,3);
    };

    // Level Class
    var Level = function(number, game) {
        this.game = game;
        this.loader; // loader object that will load all the assets
        this.mouse;
        this.engine;
        this.number = number;
        this.assets = game.gameJSON.levels[number];
        this.graphics = []; // Array of the graphics objects, i.e background, foreground, slingshot
        this.heroes = []; // Array of the heroes of the level
        this.villains = []; // Array of the villains of the level
        this.mode = "intro";
        
        this.offsetLeft = 0; // Variable defined for screen panning and parallax
        this.nbDisplayStates = 3; // Variable defined for ordering the display of the graphics. i.e: the diffrents backgrounds, foregroud and other object
        this.ended = false;
        this.score = 0;
        this.maxSpeed = 3;
        this.minOffset = 0;
        this.maxOffset = 300;
        this.lastUpdateTime; // will be initialized in the animate method
        this.startX; // startX will be the starting point of the panning
        this.slingshotX;
        this.slingshotY;
        this.maxWidth; //after this width the elements will be out of bounds

        this.animationFrame; // Will be initialize in start() method

        this.currentHero;
        /*this.background; // Will be initialize in load method
        this.foreground; // Will be initialize in load method
        this.slingshotImage; // Will be initialize in load method
        this.slingshotFrontImage; // Will be initialize in load method*/
       
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
        // Create all the Graphics object and load the associated images
        this.createGraphics(); 
        // Create the Entity objects and the associated Box2D object and then load all the necessary images
        this.createEntities();
        // Initialize the Heroes and Villains array of the level
        this.InitHeroesAndVillains();
    };

    // Create and load the graphics objects : background, foreground ans slingshotS
    Level.prototype.createGraphics = function() {
        // create and load the graphics and put it in the graphics array of the level
        var graphics = this.assets.graphics;
        var graphicsLength = graphics.length;
        for (var i = 0; i < graphicsLength; i++) {
            switch(graphics[i].type) {
                case "slingshot":
                    var newGraphic = new Slingshot(graphics[i].url, graphics[i].position);
                    this.startX = newGraphic.position.x;
                    this.slingshotX = this.startX;
                    this.slingshotY = newGraphic.position.y;
                    break;
                case "foreground":
                    var newGraphic = new Foreground(graphics[i].url);
                    break;
                case "background":
                    var newGraphic = new Background(graphics[i].url, graphics[i].parallax);
                    break;
                default:
                    console.log("Undefined graphic type",graphics[i].type);
                    break;
            }
            newGraphic.sprite = this.loader.loadImage(newGraphic.url);
            this.graphics.push(newGraphic);
            if (newGraphic.type === "Foreground") { this.maxWidth = newGraphic.sprite.width; }
        };
        this.graphics.sort(function(a,b) {return a.displayOrder - b.displayOrder});
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
        if (entity.definition) {
            var definition = new EntityDef(entity.definition.name, entity.definition.density, entity.definition.friction, entity.definition.restitution);    
        }
        // create the corresponding object
        switch(entity.type){
            case "ground":
                var newEntity = new Ground(definition, entity.shape, entity.position, entity.url);              
                break;  
            case "block":
                var newEntity = new Block(definition, entity.shape, entity.position,entity.url, entity.fullHealth);        
                break;
            case "hero":
                var newEntity = new Hero(definition, entity.shape, entity.position, entity.url);
                break;
            case "villain": // can be circles or rectangles
                var newEntity = new Villain(definition, entity.shape, entity.position, entity.url, entity.fullHealth, entity.calories);
                break;                          
            default:
                console.log("Undefined entity type",entity.type);
                break;
        }
        // create the entity based on his type and the associated physic engine object
        this.engine.createEntity(newEntity);
        // Load the image if necessary
        if (newEntity.url) {
                    newEntity.sprite = this.loader.loadImage(newEntity.url);
                }
    };

    Level.prototype.InitHeroesAndVillains = function() {
        // Iterate through all the bodies and draw them on the canvas
        for (var body = this.engine.world.GetBodyList(); body; body = body.GetNext()) {
            var entity = body.GetUserData();
            if(entity) {
                if(entity.type === "Hero") {
                    this.heroes.push(body);
                } else if (entity.type === "Villain") {
                    this.villains.push(body);
                }
            }
        };
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
        var currentTime = new Date().getTime();
        var timeStep;
        if (this.lastUpdateTime) {
            timeStep = (currentTime - this.lastUpdateTime)/1000;
            this.engine.step(timeStep);
        }
        this.lastUpdateTime = currentTime;
        // Draw the statics objects (background, foreground, slingshot) with parallax scrolling
        this.drawAllGraphics();
        // Draw all the bodies
        this.drawAllBodies();

        if (!this.ended) {
            var self =  this;
            this.animationFrame = window.requestAnimationFrame(function() {
                                                                    self.animate();
                                                                }, self.canvas);
        }
    };

    Level.prototype.drawAllGraphics = function() {
        var graphics = this.graphics;
        var graphicsLength = graphics.length;
        for (var i = 0; i < graphicsLength; i++) {
            graphics[i].draw(this.game.context, this.offsetLeft);
        };
    };

    Level.prototype.drawAllBodies = function() {
        this.engine.world.DrawDebugData();

        // Iterate through all the bodies and draw them on the canvas
        for (var body = this.engine.world.GetBodyList(); body; body = body.GetNext()) {
            var entity = body.GetUserData();
    
            if (entity != null && entity.url) {
                var position = body.GetPosition();
                var angle = body.GetAngle();
                // Test if the entity should be drawn or destroyed
                var entityX = position.x*this.engine.scale;
                if (entityX < 0 || entityX > this.maxWidth || entity.health < 0) {
                    this.engine.world.DestroyBody(body);
                    if (entity.type === "Villain"){
                        this.score += entity.calories;
                        $('#score').html('Score: '+this.score);
                        this.villains.pop();
                    }
                } else {
                    // Translate and rotate the canvas context to the position and angle of the entity
                    this.game.context.translate(position.x*this.engine.scale-this.offsetLeft, position.y*this.engine.scale);
                    this.game.context.rotate(angle);
                    // Draw the entity
                    entity.draw(this.game.context);
                    // Translate and rotate the context back to the original position
                    this.game.context.rotate(-angle);
                    this.game.context.translate(-position.x*this.engine.scale+this.offsetLeft, -position.y*this.engine.scale);
                }
            }
        };
    };

    // This method calculate the distance between the current hero center
    // and the mouse location and compares it with the radius of the current hero
    // to check if the mouse is positioned over the hero.
    // WARNING : we can get away with using this simple check since all our heros
    // are circular. If we want to implement heroes with differents shapes we will need
    // to change this method 
    Level.prototype.mouseOnCurrentHero = function() {
        if(!this.currentHero) {
            return false;
        }
        var position = this.currentHero.GetPosition();
        var distanceSquared = Math.pow(position.x*this.engine.scale - this.mouse.x-this.offsetLeft,2) + Math.pow(position.y*this.engine.scale - this.mouse.y,2);
        var radiusSquared = Math.pow(this.currentHero.GetUserData().shape.radius,2);
        return(distanceSquared <= radiusSquared);
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
                if (this.mouseOnCurrentHero()) {
                    this.mode = "firing";
                } else {
                    this.panTo(this.mouse.x + this.offsetLeft);
                }
            } else {
                this.panTo(this.startX);
            }
        }
        
        if (this.mode === "load-next-hero"){
            // Check if any villains are alive, if not, end the level (success)
            if (this.villains.length === 0){
                this.mode = "level-success";
                return;
            }
            // Check if there are any more heroes left to load, if not end the level (failure)
            if (this.heroes.length === 0){
                this.mode = "level-failure" 
                return;     
            }
            // Load the hero and set mode to wait-for-firing
            // to refactor
            if(!this.currentHero){
                this.currentHero = this.heroes[this.heroes.length-1];
                this.currentHero.SetPosition({x:180/this.engine.scale,y:200/this.engine.scale});
                this.currentHero.SetLinearVelocity({x:0,y:0});
                this.currentHero.SetAngularVelocity(0);
                this.currentHero.SetAwake(true);       
            } else {
                // Wait for hero to stop bouncing and fall asleep and then switch to wait-for-firing
                this.panTo(this.startX);
                if(!this.currentHero.IsAwake()){
                    this.mode = "wait-for-firing";
                }
            }
        }
        
        if(this.mode === "firing"){
            if (this.mouse.down) {
                this.panTo(this.startX);
                this.currentHero.SetPosition({x:(this.mouse.x+this.offsetLeft)/this.engine.scale,y:this.mouse.y/this.engine.scale});
            } else {
                this.mode = "fired";
                var impulseScaleFactor = 0.75;
                // Coordinates of center of slingshot (where the band is tied to slingshot)
                var slingshotCenterX = this.slingshotX + 35;
                var slingshotCenterY = this.slingshotY + 25;
                var impulse = new b2Vec2((slingshotCenterX - this.mouse.x - this.offsetLeft)*impulseScaleFactor,(slingshotCenterY - this.mouse.y)*impulseScaleFactor);
                this.currentHero.ApplyImpulse(impulse,this.currentHero.GetWorldCenter());
            }
        }
        
        if (this.mode === "fired"){
            // Pan to wherever the hero currently is
            var heroX = this.currentHero.GetPosition().x*this.engine.scale;
            this.panTo(heroX);

            //and wait till he stops moving  or is out of bounds 
            if(!this.currentHero.IsAwake() || heroX < 0 || heroX > this.maxWidth ){
                // then delete the old hero
                this.engine.world.DestroyBody(this.currentHero);
                this.currentHero = undefined;
                // and load next hero
                this.heroes.pop();
                this.mode = "load-next-hero";
            }
        }

        if(this.mode === "level-success" || this.mode === "level-failure"){       
            if(this.panTo(0)){
                this.ended = true;                  
                this.showEndingScreen();
            }            
        }
    };

    Level.prototype.showEndingScreen = function() {
        if (this.mode === "level-success"){
            if(this.number < this.game.gameJSON.levels.length-1){
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
        var level = this.level.assets;
        // count the number of graphics to load
        var graphicsArray = level.graphics;
        var graphicsArrayLength = graphicsArray.length;
        for (var i = 0; i < graphicsArrayLength; i++) {
            if(graphicsArray[i].url != undefined) { this.totalCount++; }
        };
        // count the number of entities to load
        var entityArray = level.entities;
        var entityArrayLength = entityArray.length;
        for (var i = 0; i < entityArrayLength; i++) {
            if(entityArray[i].url != undefined) { this.totalCount++; }
        };
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

    // Graphic Class
    // A Graphic object is an object that will not be represented in the physic engine, i.e: background, foreground, slingshot
    var Graphic = function(url) {
        this.url = url;
        this.sprite;
        this.displayOrder;
    };

    Graphic.prototype.draw = function(context) {
    };

    var Slingshot = function(url, position) {
        Graphic.call(this, url);
        this.position = position;
        this.displayOrder = 3;
        this.type = "Slingshot";
    };
    Slingshot.prototype = Object.create(Graphic.prototype);
    Slingshot.prototype.constructor = Slingshot;

    Slingshot.prototype.draw = function(context, offsetLeft) {
        context.drawImage(this.sprite, this.position.x - offsetLeft, this.position.y);
    };

    var Foreground = function(url) {
        Graphic.call(this, url);
        this.displayOrder = 2;
        this.type = "Foreground";
    };
    Foreground.prototype = Object.create(Graphic.prototype);
    Foreground.prototype.constructor = Foreground;

    Foreground.prototype.draw = function(context, offsetLeft) {
        context.drawImage(this.sprite, offsetLeft, 0, 640, 480, 0, 0, 640, 480);
    };

    var Background = function(url, parallax) {
        Graphic.call(this, url);
        this.parallax = parallax;
        this.displayOrder = 1;
        this.type = "Background";
    };
    Background.prototype = Object.create(Graphic.prototype);
    Background.prototype.constructor = Background;

    Background.prototype.draw = function(context, offsetLeft) {
        context.drawImage(this.sprite, offsetLeft/this.parallax, 0, 640, 480, 0, 0, 640, 480);
    };

    // Entity Class
    // An Entity object is an object that will be represented in the physic engine. It means that this object
    // will have a physic definition (density, friction, restitution) associated with him.
    var Entity = function(definition, shape, position, url) {
        this.definition = definition;
        this.shape = shape;
        this.position = position;
        this.url = url || undefined;
        this.isStatic = false; // By default an entity is dynamic
        this.sprite; // Will be initialize in method createEntity of class Level
        this.type = "Entity";
    };

    // Note: Box2D create a "skin" around polygons. The skin is used in staking scenarios to keep polygons
    // slightly separated. This allows continuous collision to work against the core polygon. When drawing
    // Box2D objects, we need to compensate for this extra skin by drawing bodies slightly larger than their actual
    // dimensions; otherwise, stacked objects wil have unexplained gaps between them
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
        this.type = "Ground";
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
        this.type = "Block";
    };
    Block.prototype = Object.create(Entity.prototype);
    Block.prototype.constructor = Block;

    Block.prototype.draw = function(context) {
        Entity.prototype.draw.call(this, context); // Call the method draw of the super class
    };

    // Hero Class --> Subclass of Entity
    var Hero = function(definition, shape, position, url) {
        Entity.call(this, definition, shape, position, url);
        this.type = "Hero";
    };
    Hero.prototype = Object.create(Entity.prototype);
    Hero.prototype.constructor = Hero;

    Hero.prototype.draw = function(context) {
        Entity.prototype.draw.call(this, context); // Call the method draw of the super class
    };

    // Villains Class --> Subclass of Entity
    var Villain = function(definition, shape, position, url, fullHealth, calories) {
        Entity.call(this, definition, shape, position, url);
        this.health = fullHealth;
        this.calories = calories;
        this.type = "Villain";
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
    game.init(jsonURL);
});