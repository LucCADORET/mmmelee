console.log("Starting mmmelee game");

var game = new Phaser.Game(
	800, 
	600, 
	Phaser.CANVAS, 
	'phaser-example',
	{ 
		preload: preload, 
		create: create, 
		update: update, 
		render: render 
	}
);


var textName; // The name of the player used by the client
var clientPlayersView = {}; // hash table of the "view" version of the client players
var socket;
var mario;
var goomba;
var facing = "right";
var map;
var bg;
var layer;
var bullet;
var bullets;
var bulletTime = 0;
var firingTimer = 0;
var fireButton;


function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function getTimestamp(){
	var timeStampInMs = window.performance && window.performance.now && window.performance.timing && window.performance.timing.navigationStart ? window.performance.now() + window.performance.timing.navigationStart : Date.now();
	return timeStampInMs;
}

function client(name) {
	this.name = name;
	this.x = 0;
	this.y = 0;
	this.facing = "right";
	this.stanging = 1;
	this.shooting = 0;
	this.guid=guid();
}

var userData = new client(prompt("Pseudo :"));

/* Cette fonction pré-charge les éléments à utiliser pour le jeu */

function preload() {
	/* Définis le monde. Ne peut pas être plus petit que le Game. */
	game.world.setBounds(0,0,1280, 600);

	/* Chargement des niveaux */
	game.load.tilemap('mario','json/level1.json',null,Phaser.Tilemap.TILED_JSON);
	game.load.image('tiles1','images/super_mario.png')

	/* Chargement des images du jeu */
	game.load.image('background', 'images/bkg.png');
	game.load.spritesheet('mario_moves', 'images/mario.spritesheet_gun.png', 29, 28);
	game.load.spritesheet('mario_alt_moves', 'images/mario_alt.spritesheet_gun.png', 29, 28);
	game.load.spritesheet('goomba', 'images/goomba.spritesheet.png',16,16);
	game.load.image('bullet', 'images/bullet.png');

}

/* Cette fonction "créé" le jeu, place les éléments etc. */

function create() {

	game.physics.startSystem(Phaser.Physics.ARCADE);
	game.physics.arcade.gravity.y = 1000;
	
	// background images
	bg = game.add.tileSprite(0, 0,1280,600, 'background');
	bg.fixedToCamera = true;

	map = game.add.tilemap('mario');

	map.addTilesetImage('super_mario', 'tiles1');

	map.setCollisionBetween(15, 16);
	map.setCollisionBetween(20, 25);
	map.setCollisionBetween(27, 29);
	map.setCollision(40);

	layer = map.createLayer('calque1');

	layer.resizeWorld();

	//  Un-comment this on to see the collision tiles
	//layer.debug = true;

	// Create a mario sprite as player.
	mario = game.add.sprite(50, 50, 'mario_moves');
	game.physics.enable(mario, Phaser.Physics.ARCADE);
	mario.anchor.setTo(0.5, 0.5);

	mario.body.bounce.y = 0.01;
	// linearDamping is used to calculate friction on the body as it moves through the world. For example, this might be used to simulate air or water friction.
	mario.body.linearDamping = 1;
	mario.body.collideWorldBounds = true;
	//  Here we add a new animation called 'run'
	//  We create an animation from the sprite sheet : add(name, frames, frameRate, loop, useNumericIndex) 
	mario.animations.add('run_right',[1,2],10,true);
	mario.animations.add('run_left',[4,5],10,true);
	mario.animations.add('stand_right',[0],1,false);
	mario.animations.add('stand_left',[3],1,false);

	// Make the default camera follow the mario.
	game.camera.follow(mario);

	// Creation of the goomba
	goomba = game.add.sprite(100, 100, 'goomba');
	goomba.animations.add('walk',[0,1],10,false);
	game.physics.enable(goomba, Phaser.Physics.ARCADE);
	
	//  Our bullet group
	bullets = game.add.group();
	bullets.enableBody = true;
	bullets.physicsBodyType = Phaser.Physics.ARCADE;
	bullets.createMultiple(30, 'bullet');
	bullets.setAll('anchor.x', 0.5);
	bullets.setAll('anchor.y', 1);
	bullets.setAll('outOfBoundsKill', true);
	bullets.setAll('checkWorldBounds',true);
	bullets.setAll('body.allowGravity', false);

	// The style of the font above the characters
	let style = { font: "20 Arial", fill: "#ff0000", align: "center" };
	textName = game.add.text(mario.body.x, mario.body.y - 20, userData.name, style);

	let textPing = game.add.text(0, 0, "999 ms", style);

	//  Stop the following keys from propagating up to the browser
	game.input.keyboard.addKeyCapture([ Phaser.Keyboard.LEFT, Phaser.Keyboard.RIGHT, Phaser.Keyboard.SPACEBAR ]);
	fireButton = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);


	// On invoque socket.io DANS la méthode create, sinon il se lance avant et p2 n'existera pas déjà...
	socket = io.connect();

	socket.on('connect', function () {

		/* We send our datas to the server */
		socket.emit("newClient",userData);

		/*On this signal, the client takes all the players already in game and create the correspondings
					sprites*/
		socket.on('playersInGame', function(serverPlayer) {
			for(let player of serverPlayer)
			{
				clientPlayersView[player.guid] = createPlayer(player.name, style);
				updateClientPlayerView(player);
			}

		});

		/* When a new player arrives, we also create it's corresponding sprite */
		socket.on('newPlayerInGame', function (data) {
			clientPlayersView[data.guid] = createPlayer(data.name, style); 
		});

		socket.on('pingClient', function(timestamp){
			let ping = getTimestamp() - timestamp;
			textPing.setText(ping+' ms');

		});

		socket.on('playerLeft', function(data){
			// TODO : delete player
			let clientPlayerView = clientPlayersView[data.guid];	
			clientPlayerView.nameText.kill();
			clientPlayerView.kill();
			delete clientPlayersView[data.guid];
			console.log("Player disconnected: "+data.name);	
		});

		socket.on('updatePositions',function(data){
			updateClientPlayerView(data);
		});		

	});

}	

function updateClientPlayerView(playerData){
	let clientPlayerView = clientPlayersView[playerData.guid];
	clientPlayerView.x = playerData.x;
	clientPlayerView.y = playerData.y;
	clientPlayerView.nameText.x = clientPlayerView.x;
	clientPlayerView.nameText.y = clientPlayerView.y-25;
	console.log("Facing:"+playerData.facing);

	if(playerData.standing == 0)
	{
		clientPlayerView.animations.play('run_'+playerData.facing, 10, true);
	}
	else if (playerData.standing == 1);
	{
		clientPlayerView.animations.play('stand_'+playerData.facing, 10, false);
	}
}

/*
 * Creates a new player visually : adds animation, body specs etc.
 */
function createPlayer(name, style){
	let spriteName = 'mario_alt_moves';

	let player = game.add.sprite(50,50,'mario_alt_moves'); // we associate the sprite of the new player with a name in the hash table
	// Creation of the second player
	game.physics.enable(player, Phaser.Physics.ARCADE);
	player.anchor.setTo(0.5, 0.5);
	player.body.allowGravity = false;

	player.animations.add('run_right',[1,2],10,true);
	player.animations.add('run_left',[4,5],10,true);
	player.animations.add('stand_right',[0],1,false);
	player.animations.add('stand_left',[3],1,false);

	player.nameText = game.add.text(player.body.x, player.body.y - 20, name, style);

	return player;
}

function update() {

	game.physics.arcade.collide(mario, layer);
	game.physics.arcade.collide(goomba, layer);
	game.physics.arcade.collide(bullets, layer);
	//game.physics.collide(p2, layer);

	mario.body.velocity.x = 0;

	userData.standing = 0;

	textName.x = mario.x;
	textName.y = mario.y - 25;

	goomba.animations.play('walk',10,true);

	if (game.input.keyboard.isDown(Phaser.Keyboard.UP))
	{
		if (mario.body.onFloor())
		{
			mario.body.velocity.y = -500;
		}
	}

	// Check key states every frame.
	// Move ONLY one of the left and right key is hold.
	if (game.input.keyboard.isDown(Phaser.Keyboard.LEFT))
	{
		facing = "left";
		mario.animations.play('run_left', 10, true);
		mario.body.velocity.x = -300;
	}
	else if (game.input.keyboard.isDown(Phaser.Keyboard.RIGHT))
	{
		//  And this starts the animation playing by using its key ("walk")
		//  30 is the frame rate (30fps)
		//  true means it will loop when it finishes
		facing = "right";
		mario.animations.play('run_right', 10, true);
		mario.body.velocity.x = 300;
	}
	else
	{
		mario.animations.play('stand_'+facing,10,false);
		userData.standing = 1;
	}

	//  Firing?
	if (fireButton.isDown)
	{
		fireBullet();
	}

	//  Run collision
	//game.physics.overlap(bullets, goomba, collisionHandler, null, this);

	bullets.forEach(function (bullet) {
		if (bullet.body.velocity.x == 0 && bullet.body.velocity.y == 0) {
			bullet.kill();
		}
	})

	userData.facing = facing;

	/* Cette condition permet de n'émettre un broadcast seulement si la position de l'autre joueur a changé par
					rapport à l'update précédente, permettant d'éviter les "tempêtes" de broadcast
					On arrondit les positions x et y à deux décimales près, parce que sinon elles sont TOUJOURS différentes (bug de Phaser.js ?)
					*/
	if((userData.x.toFixed(2) != mario.x.toFixed(2)) || (userData.y.toFixed(2) != mario.y.toFixed(2)))
	{
		userData.x = mario.x;
		userData.y = mario.y;
		socket.emit('move',userData);
	}

}

function render() {

	//game.debug.renderCameraInfo(game.camera, 420, 320);
	//game.debug.renderPhysicsBody(mario.body);

}

function fireBullet () {

	//  To avoid them being allowed to fire too fast we set a time limit
	if (game.time.now > bulletTime)
	{
		//  Grab the first bullet we can from the pool
		bullet = bullets.getFirstExists(false);

		if (bullet)
		{
			//  And fire it
			bullet.reset(mario.x, mario.y + 8);
			if(facing == "right") bullet.body.velocity.x = 1000;
			else bullet.body.velocity.x = -1000;
			bulletTime = game.time.now + 100;
		}
	}

}

function resetBullet (bullet) {
	//  Called if the bullet goes out of the screen
	bullet.kill();
}

function collisionHandler (bullet, goomba) {
	//  When a bullet hits a goomba we kill them both
	bullet.kill();
	goomba.kill();
}

/* Periodic call to shot server ping */
let intervalID = setInterval(
	function(){
		socket.emit('pingServer', getTimestamp());
	}, 
	2000);
