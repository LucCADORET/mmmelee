var express = require('express');
var http = require('http');
var port = process.env.PORT || 8888;
var app = express();

app.use(express.static(__dirname + '/public'));

app.get('/',function(req,res){
  res.set('Content-Type', 'text/html'); // 'text/html' => mime type
  res.sendfile(__dirname + '/index.html');
});

var server = http.createServer(app);
var io = require('socket.io').listen(server);

/* /!\ AVEC HEROKU, IL FAUT ACTIVER LES WEBSOCKET : heroku labs:enable websockets -a myapp */

io.sockets.on('connection', function (socket) {

	console.log('New client');
	socket.broadcast.emit('p2Connected',playerData);
	
	socket.on('move', function (playerData) {
			socket.broadcast.emit('updatePositions',playerData);
	});
});

/* We have to let Heroku choose the port he wants to listen, hence the "process.env.PORT" */
server.listen(port);