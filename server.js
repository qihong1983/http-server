/**
 * author: oldj
 *
 **/
var http = require("http"),
 url = require("url"),
 path = require("path"),
 fs = require("fs"),
 local_folders,
 base_url;
local_folders = [ // 本地路径，代理将在这个列表中的目录下寻找文件，如果没有找到则转到线上地址
 "D:/AppServ/www/combo"
];
base_url = "http://www.baidu.com"; // 线上路径，如果找不到文件，则转向到这个地址

function loadFile(pathname, response) {
 var i, l = local_folders.length,
  fn;
 console.log("try to load " + pathname);
 for (i = 0; i < l; i++) {
  fn = local_folders[i] + pathname;
  if (path.existsSync(fn) && fs.statSync(fn).isFile()) {
   fs.readFile(fn, function (err, data) {
    response.writeHead(200);
    response.write(data);
    response.end();
   });
   return;
  }
 }
 response.writeHead(302, {
  "Location":base_url + pathname
 });
 response.end();
}
http.createServer(
 function (request, response) {
  var req_url = request.url,
   pathname;
  // 处理类似 http://a.tbcdn.cn/??p/global/1.0/global-min.css,tbsp/tbsp.css?t=20110920172000.css 的请求
  pathname = req_url.indexOf("??") == -1 ? url.parse(request.url).pathname : req_url;
  console.log("Request for '" + pathname + "' received.");
  loadFile(pathname, response);
 }).listen(3000);
console.log("started Server.");