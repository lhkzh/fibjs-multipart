# fibjs-multipart
multipart-form for fibjs  

import {Multipart} from "fibjs-multipart";  
let multipart = new Multipart();  
multipart.file("pic", "/tmp/a.jpg");  
multipart.field("token", "balala");  
let res = multipart.post(url);  
console.log(res.data)
