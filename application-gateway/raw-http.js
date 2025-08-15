const http = require('http');
http.createServer((req, res) => {
  res.end('pong');
}).listen(3000, () => console.log('Server up'));
