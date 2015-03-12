/* 
 
    Node.js File Server 
    Andy Green 
    http://andygrn.co.uk 
    November 2011 
 
*/  
  
'use strict';  
  
// 配置对象。使用对象来配置，不错的编程方法！  
var CONFIG = {  
  
    'host': '127.0.0.1',            // 服务器地址  
    'port': 3000,             // 端口  
      
    'site_base': './assets',          // 根目录，虚拟目录的根目录  
      
    'file_expiry_time': 480,        // 缓存期限 HTTP cache expiry time, minutes  
      
    'directory_listing': true       // 是否打开 文件 列表  
  
};  
  
// 当前支持的 文件类型，你可以不断扩充。  
var MIME_TYPES = {  
  
    '.txt': 'text/plain',  
    '.md': 'text/plain',  
    '': 'text/plain',  
    '.html': 'text/html',  
    '.css': 'text/css',  
    '.js': 'application/javascript',  
    '.json': 'application/json',  
    '.jpg': 'image/jpeg',  
    '.png': 'image/png',  
    '.gif': 'image/gif'  
  
};  
  
// 缓存过期时限  
var EXPIRY_TIME = (CONFIG.file_expiry_time * 60).toString();  
  
// 依赖模块，注意 CUSTARD 是自定义的模块，不是 NODE 类库自带的。   
var HTTP = require('http');  
var PATH = require('path');  
var FS = require('fs');  
var CRYPTO = require('crypto');  
var CUSTARD = require('./custard');  
      
var template_directory = FS.readFileSync('./templates/blocks/listing.js');  
  
  
// 响应对象 An object representing a server response  
  
function ResponseObject( metadata ){  
  
    this.status = metadata.status || 200;  
    this.data = metadata.data || false;  
    this.type = metadata.type || false;  
  
}  
  
// 返回 HTTP Meta 的 Etag。可以了解 md5 加密方法  
ResponseObject.prototype.getEtag = function (){  
    var hash = CRYPTO.createHash( 'md5' );  
    hash.update( this.data );  
    return hash.digest( 'hex' );  
};  
  
  
// Filter server requests by type  
  
function handleRequest( url, callback ){  
    // 如果 url 只是 目录 的，则列出目录  
    if ( PATH.extname( url ) === '' ){  
        getDirectoryResponse( url, function ( response_object ){  
            callback( response_object );  
        } );  
    }  
    else {  
    // 如果 url 是 目录 + 文件名 的，则返回那个文件  
        getFileResponse( url, function ( response_object ){  
            callback( response_object );  
        } );  
    }  
  
}  
  
  
// 处理文件的函数 Creates a ResponseObject from a local file path  
  
function getFileResponse( path, callback ){  
  
    var path = CONFIG.site_base + path;  
  
    PATH.exists( path, function ( path_exists ){  
        if ( path_exists ){  
            FS.readFile( path, function ( error, data ){  
                if ( error ){  
//                  Internal error  
                    callback( new ResponseObject( {'data': error.stack, 'status': 500} ) );  
                }  
                else {  
                    // 读取 文件 返回 Response   
                    callback( new ResponseObject({  
                             'data': new Buffer( data )  
                            ,'type': MIME_TYPES[PATH.extname(path)]  
                        })   
                    );  
                }  
            } );  
        }  
        else {  
//          Not found  
            callback( new ResponseObject( {'status': 404} ) );  
        }  
    } );  
  
}  
  
  
// 处理目录的方法 Creates a ResponseObject from a local directory path  
  
function getDirectoryResponse( path, callback ){  
  
    var full_path = CONFIG.site_base + path;    // 完整路径  
    var template;  
    var i;  
  
    if ( CONFIG.directory_listing ){  
        PATH.exists( full_path, function ( path_exists ){  
            if ( path_exists ){  
                FS.readdir( full_path, function ( error, files ){  
                    if ( error ){  
//                      Internal error  
                        callback( new ResponseObject( {'data': error.stack, 'status': 500} ) );  
                    }  
                    else {  
                        // 列出结果  
//                      Custard template  
                        template = new CUSTARD;  
                          
                        template.addTagSet( 'h', require('./templates/tags/html') );  
                        template.addTagSet( 'c', {  
                            'title': 'Index of ' + path,  
                            'file_list': function ( h ){  
                                var items = [];  
                                var stats;  
                                for ( i = 0; i < files.length; i += 1 ){  
                                    stats = FS.statSync( full_path + files[i] );  
                                    if ( stats.isDirectory() ){  
                                        files[i] += '/';  
                                    }  
                                    items.push( h.el( 'li', [  
                                        h.el( 'a', {'href': path + files[i]}, files[i] )  
                                    ] ) );  
                                }  
                                return items;  
                            }  
                        } );  
                          
                        template.render( template_directory, function ( error, html ){  
                            if ( error ){  
//                              Internal error  
                                callback( new ResponseObject( {'data': error.stack, 'status': 500} ) );  
                            }  
                            else {  
                                callback( new ResponseObject( {'data': new Buffer( html ), 'type': 'text/html'} ) );  
                            }  
                        } );  
                    }  
                } );  
            }  
            else {  
                // 找不到 文件，就是 404  
//              Not found  
                callback( new ResponseObject( {'status': 404} ) );  
            }  
        } );  
    } else {  
        // 禁止 目录浏览，返回 403  
//      Forbidden  
        callback( new ResponseObject( {'status': 403} ) );  
    }  
  
}  
  
  
// 启动服务器 Start server  
  
HTTP.createServer( function ( request, response ){  
  
    var headers;  
    var etag;  
      
    if ( request.method === 'GET' ){ // 静态服务服务器都是 HTTP GET 方法的  
//      Get response object  
        handleRequest( request.url, function ( response_object ){  
            if ( response_object.data && response_object.data.length > 0 ){  
                etag = response_object.getEtag();  
                // 命中缓存，返回 304  
                if ( request.headers.hasOwnProperty('if-none-match') && request.headers['if-none-match'] === etag ){  
//                  Not Modified  
                    response.writeHead( 304 );  
                    response.end();  
                }  
                // 请求  
                else {  
                    headers = {  
                        'Content-Type': response_object.type,  
                        'Content-Length' : response_object.data.length,  
                        'Cache-Control' : 'max-age=' + EXPIRY_TIME,  
                        'ETag' : etag  
                    };  
                    response.writeHead( response_object.status, headers );  
                    response.end( response_object.data );  
                }  
            }  
            else {  
                response.writeHead( response_object.status );  
                response.end();  
            }  
        } );  
    }  
    else {  
//      Forbidden  
        response.writeHead( 403 );  
        response.end();  
    }  
  
} ).listen( CONFIG.port, CONFIG.host ); // 读取配置  
  
console.log( 'Site Online : http://' + CONFIG.host + ':' + CONFIG.port.toString() + '/' ); 