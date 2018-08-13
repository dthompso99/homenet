require('dotenv').config();
var dgram = require('dgram');
var myip = require('quick-local-ip');
var Datastore = require('nedb');
var HomeDevice = require('./device');

module.exports = class Homenet {
	constructor(port){
		this.devices = [];
		this.db = new Datastore({filename: './var/'+process.env.PLATFORM_NAME+'.db', autoload: true});
		this.db.ensureIndex({ fieldName: 'mac', unique: true }, function (err) {
			if (err) console.error("Unable to set index on mac", err);
		});
		this.local_ip = (process.env.LOCAL_IP?process.env.LOCAL_IP:myip.getLocalIP4()),
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
		let msg = this.decode(strMsg.toString());
		switch (msg.a){
			case 'register':
				console.warn('Register Device', msg);
				this.register(msg);
				break;
			case 'pinchange':
				this.findDevice(msg.d).pinChange(msg.pin, msg.state);
				break;
			default:
				console.warn("Unknown Action", msg['a'], msg);
		}
	}
	
	findDevice(mac){
		for(var i = 0; i < this.devices.length; i++){
			if (this.devices[i].mac == mac) return this.devices[i];
		}
	}
	
	getIP(){
		return this.local_ip;
	}
	
	getPort(){
		return this.port;
	}
	
	getDevices(){
		return this.devices;
	}
	
	getDevice(id){
		if (id > this.devices.length-1){
			console.error("Device out of range: ", id, this.devices.length);
			return false;
		} else {
			return this.devices[id];
		}
	}
	
	register(dev){
		let exists = false
		for (var i=0; i < this.devices.length; i++){
			if (this.devices[i] && this.devices[i].getMac() == dev.mac){
				this.devices[i].update(dev);
				this.configure_device(this.devices[i]);
				exists = true;
				break;
			}
		}
		
		if (!exists){
			var d = new HomeDevice(this.db, dev);
			d.on('update_configuration', (device)=>{this.configure_device(device)});
			d.on('set_pin_mode', (device, pin, state)=>{ this.send_device_change(device, pin, state)});
			d.on('request_reboot', (device)=>{this.send_reboot(device);})
			this.devices.push(d);
		}

	}
	
	send_reboot(device){
		var msg = new Buffer('a^reboot');
		this.server.send(msg, 0, msg.length, this.port, device.ip);
	}
	
	send_device_change(device, pin, state){
		var msg = new Buffer('a^set|p^'+pin+'|s^'+state);
		this.server.send(msg, 0, msg.length, this.port, device.ip);
	}
	
	configure_device(device){
		var config = [];
		if (device.pins && device.pins.digital){
			var configured_pins = Object.keys(device.pins.digital).length;
			for (var k in device.pins.digital){
				if (device.pins.digital.hasOwnProperty(k)){
					config.push(k+"^"+device.pins.digital[k]);
				}
			}
		}
		var msg = new Buffer("a^register|server^"+this.local_ip+"|c^"+configured_pins+"|"+config.join("|"));
		this.server.send(msg, 0, msg.length, this.port, device.ip);
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