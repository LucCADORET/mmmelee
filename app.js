var express = require('express');
var http = require('http');

var app = express();

app.use(express.static(__dirname + '/public'));

/* Configuration du répertoire publique */
/*app.configure(function(){
    app.use(express.static(__dirname + '/public'));
});*/

app.get('/',function(req,res){
  res.set('Content-Type', 'text/html'); // 'text/html' => mime type
  res.sendfile(__dirname + '/index.html');
});

/*app.get('/data/images/:imagename', function(req, res) {
    res.setHeader('Content-Type', 'image/png');
    res.sendfile(__dirname + '/' + req.params.imagename);
});

app.get('/data/javascripts/:filename', function(req, res) {
    res.setHeader('Content-Type', 'text/javascript');
    res.sendfile(__dirname + '/' + req.params.filename);
});

app.get('/data/json/:jsonname', function(req, res) {
    res.setHeader('Content-Type', 'text/javascript');
    res.sendfile(__dirname + '/' + req.params.filename);
});*/

var server = http.createServer(app);
var io = require('socket.io').listen(server);

io.sockets.on('connection', function (socket) {
  // Mes évènements lorsque le client est connecté !
	console.log('Un client est connecté !');
	socket.broadcast.emit('p2Connected'); // le deuxieme argument est facultatif
	
	socket.on('move', function (playerData) {
			socket.broadcast.emit('updatePositions',playerData);
	});
});

server.listen(process.env.PORT || 8888);