var express = require('express');
var http = require('http');
var port = process.env.PORT || 8888;
var app = express();

console.log("Configuring express server.");
app.use(express.static(__dirname + '/public'));

app.get('/',function(req,res){
  res.set('Content-Type', 'text/html'); // 'text/html' => mime type
  res.sendFile(__dirname + '/index.html');
});

console.log("Starting express server");
var server = http.createServer(app);
console.log("Starting socket.io server");
var io = require('socket.io').listen(server);

var maxPlayers = 4; // The maximum number of players
var nbPlayers = 0;
var serverPlayers = [];
function serverPlayer(data, socketId) {
	this.name = data.name;
	this.x = data.x;
	this.y = data.y;
	this.facing = data.facing;
	this.standing = data.standing;
	this.shooting = data.shooting;
	this.guid = data.guid;
	this.socketId = socketId;
}

function updateServerPlayerPosition(data){
	for (let player of serverPlayers){
		if(player.guid == data.guid){
			player.x = data.x;
			player.y = data.y;
			player.facing = data.facing;
			player.standing = data.standing;
			player.shooting = data.shooting;
		}
	}
}

function indexOfPlayerBySocketId(socketId){
	let i = 0;
	for (let player of serverPlayers){
		if(player.socketId == socketId){
			return i;
		}
		i++;
	}
	return -1;
}


/* /!\ AVEC HEROKU, IL FAUT ACTIVER LES WEBSOCKET : heroku labs:enable websockets -a myapp */

io.sockets.on('connection', function (socket) {
	if(serverPlayers.length >= maxPlayers)
	{
			console.log('Maximum number of players ('+maxPlayers+') is attained');
	}
	else
	{
		
		console.log('New client');
		
		/* This function creates the player on the server-side, plus send them to all the clients */
		socket.on('newClient', function (playerData) {
				// We tell to the new client who's already in game
				socket.emit('playersInGame',serverPlayers);
				console.log("Connection : "+socket.id);

				// We add the new client to the list of players
				serverPlayers.push(new serverPlayer(playerData, socket.id));
				console.log("Server players : "+serverPlayers.length);
				//console.log(playerData);
				socket.broadcast.emit('newPlayerInGame',playerData);
		});
		
		socket.on('move', function (playerData) {
			updateServerPlayerPosition(playerData);		
			socket.broadcast.emit('updatePositions',playerData);
		});

		socket.on('pingServer', function(timestamp) {
			socket.emit('pingClient', timestamp);
		});
		
		socket.on('disconnect', function(reason) {
			console.log('Client disconnected');
			console.log("Deconnection : "+socket.id);
			let index = indexOfPlayerBySocketId(socket.id);
			socket.broadcast.emit('playerLeft', serverPlayers[index]);
			serverPlayers.splice(index, 1);	
			// TODO : Perte de m�moire par objet non supprim� ?
		});
	}
	
	
});


/* We have to let Heroku choose the port he wants to listen, hence the "process.env.PORT" */
console.log("Starting to listen on port "+port);
server.listen(port);
