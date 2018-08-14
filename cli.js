require('dotenv').config();
var readline = require('readline');
const Homenet = require('./lib/homenet.js');

var net = new Homenet(process.env.LOCAL_PORT);


var rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt(process.env.PLATFORM_NAME+'> ');
rl.prompt();

rl.on('line', function(line) {
    if (line === "exit") rl.close();
    var tkn = line.split(" ");
    switch (tkn[0]){
    	case 'boards':
    		console.log("Registered Boards: ", net.getBoards());
    		break;
    	case 'device':
    		switch(tkn[1]){
    			case 'create':
    				let d;
    				if (d = net.createDevice(tkn[2])){
    					console.log('created device: ', d);
    				} else {
    					console.error('error creating device');
    				}
    				break;
    			case 'list':
    				console.log('Device Listing: ', net.listDevices());
    				break;
    			default:
    				let di = net.getDevice(tkn[1]);
	    			switch(tkn[2]){
	    				default:
	    					console.error("Unknown Device Sub-Command");
	    					break;
	    			}
    				console.error('Unknown Device Command');
    				break;
    		}
    		break;
    	case 'board':
    		if (d = net.getBoard(tkn[1])){
    			switch(tkn[2]){
    			case 'pinmode':
    				d.setPinMode(parseInt(tkn[3],10), parseInt(tkn[4],10));
    				break;
    			case 'data':
    				d.getData((d)=>{
        				console.log('Saved Board Data: ', d);
    				});
    				break;
    			case 'name':
    				d.setName(tkn[3]);
    				break;
    			case 'reboot':
    				d.reboot();
    				break;
    			case 'pulse':
    				d.pulse(parseInt(tkn[3], 10));
    				break;
    			case 'set':
    				d.setPinState(parseInt(tkn[3], 10), parseInt(tkn[4],10));
    				break;
    			default:
    				console.log('Unknown board command', line);
    			}
    		}
    		break;
    	case 'ip':
    		console.log("Local UDP IP: ", net.getIP());
    		break;
    	case 'port':
    		console.log("Local UDP Port: ", net.getPort());
    		break;
    	case 'exit':
    		rl.close();
    		break;
    	default:
    		console.log('Unknown Command: ', line);
    }
    rl.prompt();
}).on('close',function(){
    process.exit(0);
});