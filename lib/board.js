const EventEmitter = require('events');

module.exports = class Board extends EventEmitter{
	constructor(db, data){
		super();
		let objThis = this;
		this.db = db;
		this.mac = data.mac;
		this.ip = data.ip;
		this.name = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5);
		this.digital_pins = data.digital;
		this.analog_pins = data.analog;
		this.pins = {analog: {}, digital: {}};
		this.states = {};

		this.db.update(
				{mac: this.mac}, 
				{$set: {ip: this.ip, digital_pins: this.digital_pins, analog_pins: this.analog_pins}}, 
				{upsert: true}, 
				function(err, numReplaced){
					objThis.db.findOne({mac: objThis.mac}, function(err, doc){
						objThis.pins = doc.pins;
						if (doc.name) objThis.name = doc.name;
						objThis.emit('update_configuration', objThis);
					});
				});
	}
	
	pinChange(pin, val){
		console.warn("Pin Changed, do something!", pin, val);
		this.states[pin] = val;
		this.emit('pin_change', this, pin, val);
	}
	
	reboot(){
		this.emit('request_reboot', this);
	}
	
	pulse(pin){
		let objThis = this;
		this.setPinState(pin, 1);
		setTimeout(function(){
			objThis.setPinState(pin, 0);
		}, 2000);
	}
	
	setPinState(pin, state){
		let objThis = this;
		if (this.pins.digital[pin] == 2){
			this.states[pin] = state; 
			objThis.emit('set_pin_mode', objThis, pin, state);
		} else {
			console.error("Pin is not configured for output", pin, state);
		}
	}
	
	setPinMode(pin, mode){
		if (!this.pins) this.pins = {};
		if (!this.pins.digital) this.pins.digital = {};
		if (mode == 0){
			delete this.pins.digital[pin];
		} else {
			this.pins.digital[pin]=mode;
		}
		let objThis = this;
		console.log('setPinMode', this.pins.digital);
		this.db.update({mac: this.mac}, {$set:{pins: this.pins}}, {}, function(err, rows){
			console.log('pinmode update: ', err, rows);
			objThis.emit('update_configuration', objThis);
		});
	}
	
	setName(name){
		this.name = name;
		this.db.update({mac: this.mac}, {$set:{name: this.name}}, {}, function (err, rows){
			console.warn('name updated to ', name);
		});
	}
	
	getMac(){
		return this.mac;
	}
	
	getData(cb){
		this.db.findOne({mac: this.mac}, function(err, doc){
			cb(doc);
		});
	}
	
	update(data){
		this.ip = data.ip;
		this.digital_pins = data.digital;
		this.analog_pins = data.analog;
	}
}