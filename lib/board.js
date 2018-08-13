const EventEmitter = require('events');

module.exports = class Board extends EventEmitter{
	constructor(db, data){
		super();
		let objThis = this;
		this.db = db;
		this.mac = data.mac;
		this.ip = data.ip;
		this.digital_pins = data.digital;
		this.analog_pins = data.analog;
		this.pins = {analog: {}, digital: {}};

		this.db.update(
				{mac: this.mac}, 
				{$set: {ip: this.ip, digital_pins: this.digital_pins, analog_pins: this.analog_pins}}, 
				{upsert: true}, 
				function(err, numReplaced){
					console.warn('Boards Updates: ', numReplaced);
					objThis.db.findOne({mac: objThis.mac}, function(err, doc){
						objThis.pins = doc.pins;
						objThis.emit('update_configuration', objThis);
						console.log('db board', doc);
						
					});
				});
	}
	pinChange(pin, val){
		console.warn("Pin Changed, do something!", pin, val);
	}
	
	reboot(){
		this.emit('request_reboot', this);
	}
	
	pulse(pin){
		let objThis = this;
		this.setPinState(pin, 1);
		setTimeout(function(){
			objThis.setPinState(pin, 0);
		}, 4000);
	}
	
	setPinState(pin, state){
		let objThis = this;
		if (this.pins.digital[pin] == 2){
			objThis.emit('set_pin_mode', objThis, pin, state);
		} else {
			console.error("Pin is not configured for output", pin, state);
		}
	}
	
	setPinMode(pin, mode){
		if (!this.pins) this.pins = {};
		if (!this.pins.digital) this.pins.digital = {};
		this.pins.digital[pin]=mode;
		let objThis = this;
		console.log('setPinMode', this.pins.digital);
		this.db.update({mac: this.mac}, {$set:{pins: this.pins}}, {}, function(err, rows){
			console.log('pinmode update: ', err, rows);
			objThis.emit('update_configuration', objThis);
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