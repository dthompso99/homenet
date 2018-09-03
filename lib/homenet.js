require('dotenv').config();
var dgram = require('dgram');
var Datastore = require('nedb');
var HomeBoard = require('./board');
var HomeDevice = require('./device');

module.exports = class Homenet {
	constructor(port){
		this.boards = [];
		this.devices = [];
		this.boardDB = new Datastore({filename: process.env.DATA_DIR+'/'+process.env.PLATFORM_NAME+'_board.db', autoload: true});
		this.boardDB.ensureIndex({ fieldName: 'mac', unique: true }, function (err) {
			if (err) console.error("Unable to set index on mac", err);
		});
		this.deviceDB = new Datastore({filename: process.env.DATA_DIR+'/'+process.env.PLATFORM_NAME+'_device.db', autoload: true});
		this.deviceDB.ensureIndex({ fieldName: 'name', unique: true }, function (err) {
			if (err) console.error("Unable to set index on device name", err);
		});
		this.loadDevices();
		this.local_ip = process.env.LOCAL_IP,
		this.port = port;
		this.server = dgram.createSocket("udp4");
		this.server.bind(this.port);
		this.server.on("message", (msg)=>{this.onMessage(msg)});
		this.server.on("listening", ()=>{this.onListening()});
		this.server.on("error", (err)=>{this.onError(err)});
	}
	
	onError(err){
		console.warn('Socket Error', err);
	}
	onListening(){
	    var address = this.server.address(); 
	    console.log('UDP Server started and listening on ' + address.address + ":" + address.port);
	}
	
	onMessage(strMsg){
		console.warn('raw: ', strMsg.toString());
		let msg = this.decode(strMsg.toString());
		switch (msg.a){
			case 'register':
				console.warn('Register Board', msg);
				this.register(msg);
				break;
			case 'pinchange':
				console.log('ping change message', msg);
				this.findBoard(msg.d).pinChange(msg.pin, msg.state);
				break;
			default:
				console.warn("Unknown Action", msg['a'], msg);
		}
	}
	
	loadDevices(){
		let objThis = this;
		objThis.deviceDB.find({}, function(err, doc){
			for (var c in doc){
				var d = new HomeDevice(objThis, objThis.deviceDB);
				d.load(doc[c]);
				objThis.devices.push(d);
			}
			console.log('db board', doc);
		});
	}
	
	getDevice(name){
		for(var c in this.devices) {
			if (this.devices[c].name == name){
				return this.devices[c];
			}
		}
	}
	
	createDevice(name){
		for(var c in this.devices) {
			if (this.devices[c].name == name){
				console.error('Non Unique name!');
				return false;
			}
		}
		let d = new HomeDevice(objThis, this.deviceDB);
		d.setName(name);
		this.devices.push(d);
		return d;
	}
	listDevices(){
		return this.devices.map((d)=>{ return d.name; });
	}
	
	findBoard(mac){
		for(var i = 0; i < this.boards.length; i++){
			if (this.boards[i].mac == mac) return this.boards[i];
		}
	}
	
	getIP(){
		return this.local_ip;
	}
	
	getPort(){
		return this.port;
	}
	
	getBoards(){
		return this.boards;
	}
	
	getBoard(id){
		if (isNaN(id)) {
			for (var i=0; i < this.boards.length; i++){
				if (this.boards[i].name == id){
					return this.boards[i];
				}
			}
			return false;
		} else if (id > this.boards.length-1){
			console.error("Board out of range: ", id, this.boards.length);
			return false;
		} else {
			return this.boards[id];
		}
	}
	
	register(dev){
		let exists = false
		for (var i=0; i < this.boards.length; i++){
			if (this.boards[i] && this.boards[i].getMac() == dev.mac){
				this.boards[i].update(dev);
				this.configure_board(this.boards[i]);
				exists = true;
				break;
			}
		}
		
		if (!exists){
			var d = new HomeBoard(this.boardDB, dev);
			d.on('update_configuration', (board)=>{this.configure_board(board)});
			d.on('set_pin_mode', (board, pin, state)=>{ this.send_board_change(board, pin, state)});
			d.on('request_reboot', (board)=>{this.send_reboot(board);})
			d.on('pin_change', (board, pin, state)=>{this.process_pin_change(board, pin, state)});
			this.boards.push(d);
		}

	}
	
	process_pin_change(board, pin, state){
		console.warn("process pin change", board.mac, pin, state);
	}
	
	send_reboot(board){
		var msg = new Buffer.from('a^reboot');
		this.server.send(msg, 0, msg.length, this.port, board.ip);
	}
	
	send_board_change(board, pin, state){
		var msg = new Buffer.from('a^set|p^'+pin+'|s^'+state);
		this.server.send(msg, 0, msg.length, this.port, board.ip);
	}
	
	configure_board(board){
		var config = [];
		if (board.pins && board.pins.digital){
			var configured_pins = Object.keys(board.pins.digital).length;
			for (var k in board.pins.digital){
				if (board.pins.digital.hasOwnProperty(k)){
					config.push(k+"^"+board.pins.digital[k]);
				}
			}
		}
		var msg = new Buffer.from("a^register|server^"+this.local_ip+"|c^"+configured_pins+"|"+config.join("|"));
		this.server.send(msg, 0, msg.length, this.port, board.ip);
	}
	
	decode(msg){
		return msg.split('|').map((segment)=>{ 
			var i = segment.split('^'); 
			var ret = {};
			ret.key = i[0]; 
			ret.val = i[1];
			return ret;
		}).reduce((obj, item) =>{
			obj[item.key] = item.val;
			return obj;
		}, {});
	}
}