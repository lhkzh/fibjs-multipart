/// <reference types="@fibjs/types" />

import fs=require("fs");
import path=require("path");
import io=require("io");
import util=require("util");
import mime_types=require("mime-types");

let LINE_BREAK = '\r\n';
let LINE_BREAK_BUF = Buffer.from(LINE_BREAK);

/**
 * http-form Multipart
 */
export class Multipart {
    private fields:{name:string,value:string}[];
    private files:{name:string,path?:string,data?:Class_Buffer,fileName:string, mimeType:string}[];
    private querys:any;
    private headers:any;
    private _boundary:string;
    private _partBoundary:string;
    private _endBoundary:string;

    /**
     * 构造函数
     * @param opts 参数选项
     */
    constructor(opts:{get?:any, post?:any, headers?:any}={}){
        this._boundary = generateBoundary();
        this._partBoundary = '--' + this._boundary + LINE_BREAK;
        this._endBoundary = '--' + this._boundary + '--' + LINE_BREAK;

        this.fields=[];
        this.files=[];
        this.headers = opts.headers||{};
        this.querys = opts.get||{};
        var post = opts.post||{};
        for (var k in post){
            var v:string=this.fields[k];
            if(util.isString(v)&&v.charAt(0)=='@' && fs.exists(v.substr(1))){
                delete post[k];
                this.file(k, v.substr(1));
            }else{
                this.field(k,v);
            }
        }
    }

    /**
     * 添加header参数
     * @param name
     * @param value
     */
    public header(name:string, value:any){
        this.headers[name] = String(value);
        return this;
    }
    /**
     * 添加get参数
     * @param name
     * @param value
     */
    public query(name:string, value:any){
        if((util.isArray(value) || util.isTypedArray(value)) && !name.endsWith("[]")){
            name+="[]";
        }
        this.querys[name]=value;
        return this;
    }
    /**
     * 添加post键值对
     * @param name
     * @param value
     */
    public field(name:string, value:any){
        this.fields.push({name:name,value:String(value)});
        return this;
    }

    /**
     * 添加文件
     * @param name
     * @param filePath
     * @param fileName
     */
    public file(name:string, filePath:string, fileName?:string){
        if(!fs.exists(filePath)){
            throw new Error("file_not_found:"+filePath);
        }
        if(!fileName){
            fileName=path.basename(filePath);
        }
        var mimeType = getMimeType(filePath)||getMimeType(fileName, 'application/octet-stream');
        this.files.push({name:name,path:filePath,fileName:fileName,mimeType:mimeType});
        return this;
    }
    /**
     * 添加文件
     * @param name
     * @param fileData
     * @param fileName
     */
    public fileData(name:string, fileData:Class_Buffer, fileName:string){
        var mimeType = getMimeType(fileName, 'application/octet-stream');
        this.files.push({name:name,data:fileData,fileName:fileName,mimeType:mimeType});
        return this;
    }

    /**
     * 编码为buffer
     */
    public toBuffer():Class_Buffer{
        return this.toStream().readAll();
    }

    /**
     * 编码为stream
     */
    public toStream():Class_MemoryStream{
        let mbs = new io.MemoryStream();
        this.fields.forEach(e=>{
            mbs.write(Buffer.from(`${this._partBoundary}Content-Disposition: form-data; name="${e.name}"${LINE_BREAK}${LINE_BREAK}${e.value}${LINE_BREAK}`));
        });
        this.files.forEach(e=>{
            let header = `${this._partBoundary}Content-Disposition: form-data; name="${e.name}"; filename="${e.fileName}"${LINE_BREAK}Content-Type: ${e.mimeType}${LINE_BREAK}${LINE_BREAK}`
            mbs.write(Buffer.from(header));
            if(e.path){
                let stream = fs.openFile(e.path);
                stream.copyTo(mbs);
                stream.close();
            }else{
                mbs.write(e.data);
            }
            mbs.write(LINE_BREAK_BUF);
        });
        mbs.write(Buffer.from(this._endBoundary));
        mbs.rewind();
        // console.log(mbs.tell(),mbs.size())
        return mbs;
    }

    /**
     * 打包为http的参数选项
     */
    public toOpts(){
        // console.log(body.toString())
        this.headers['Content-Type']='multipart/form-data; boundary=' + this._boundary;
        return {
            headers:this.headers,
            query:this.querys,
            body:this.toStream()
        }
    }

    /**
     * 提交http的post请求，带上编码数据
     * @param url
     */
    public post(url:string):Class_HttpResponse{
        return require("http").post(url, this.toOpts());
    }
}

function getMimeType(fileName:string, defaultMt?:string){
    return mime_types.lookup(fileName)||defaultMt;
}
function generateBoundary() {
    var boundary = '------------------------';
    for (var i = 0; i < 16; i++) {
        boundary += Math.floor(Math.random() * 10).toString(16);
    }
    return boundary;
}