
var PORT = 8000;
var http = require("http");
var url = require("url");
var fs = require("fs");
var path = require("path");
var mime = require("./mime").types;
var config = require("./config");
var zlib = require("zlib");
var fileList = [];
function walk(path){
	var dirList = fs.readdirSync(path);
	console.log(path);
	dirList.forEach(function(item){
		if(fs.statSync(path + '/' + item).isFile()){
			fileList.push(path + '/' + item);
		}
	});

	dirList.forEach(function(item){
		if(fs.statSync(path + '/' + item).isDirectory()){
					//walk(path + '/' + item);

					fileList.push(path + '/' + item);
				}
			});
}
var server = http.createServer(function(request, response) {

	var pathname = url.parse(request.url).pathname;
	//console.log(request.url);
	if (pathname.slice(-1) === "/") {

		pathname = pathname + config.Welcome.file;

		 walk(request.url);
		// console.log(fileList);

	}

	var realPath = path.join("assets", path.normalize(pathname.replace(/…/g, "")));



	var pathHandle = function (realPath) {

		fs.stat(realPath, function (err, stats) {

			if (err) {

				response.writeHead(404, "Not Found", {'Content-Type': 'text/plain'});

				response.write("This request URL " + pathname + " was not found on this server.");

				response.end();

			} else {

				if (stats.isDirectory()) {

					realPath = path.join(realPath, "/", config.Welcome.file);

					pathHandle(realPath);

				} else {

					var ext = path.extname(realPath);

					ext = ext ? ext.slice(1) : 'unknown';

					var contentType = mime[ext] || "text/plain";

					response.setHeader("Content-Type", contentType);



					var lastModified = stats.mtime.toUTCString();

					var ifModifiedSince = "If-Modified-Since".toLowerCase();

					response.setHeader("Last-Modified", lastModified);



					if (ext.match(config.Expires.fileMatch)) {

						var expires = new Date();

						expires.setTime(expires.getTime() + config.Expires.maxAge * 1000);

						response.setHeader("Expires", expires.toUTCString());

						response.setHeader("Cache-Control", "max-age=" + config.Expires.maxAge);

					}



					if (request.headers[ifModifiedSince] && lastModified == request.headers[ifModifiedSince]) {

						response.writeHead(304, "Not Modified");

						response.end();

					} else {

						var raw = fs.createReadStream(realPath);

						var acceptEncoding = request.headers['accept-encoding'] || "";

						var matched = ext.match(config.Compress.match);



						if (matched && acceptEncoding.match(/\bgzip\b/)) {

							response.writeHead(200, "Ok", {'Content-Encoding': 'gzip'});

							raw.pipe(zlib.createGzip()).pipe(response);

						} else if (matched && acceptEncoding.match(/\bdeflate\b/)) {

							response.writeHead(200, "Ok", {'Content-Encoding': 'deflate'});

							raw.pipe(zlib.createDeflate()).pipe(response);

						} else {

							response.writeHead(200, "Ok");

							raw.pipe(response);

						}

					}

				}

			}

		});

};



pathHandle(realPath);

});
server.listen(PORT);