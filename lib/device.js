const EventEmitter = require('events');

module.exports = class Device extends EventEmitter{
	constructor(db, net){
		super();
		this.net = net;
		this.arrBindings = [];
		this.boardBindings = [];
		this.db = db;
	}
	
	setName(strName){
		this.name = strName;
		this.save();
	}
	
	load(doc){
		this.name = doc.name;
	}
	
	bind(net, board, pin){
		
	}
	
	save(){
		console.log('saving device');
		let objThis = this;
		this.db.update(
				{name: this.name}, 
				{$set: {name: this.name}}, 
				{upsert: true}, 
				function(err, numReplaced){
					console.warn('Device Updates: ', numReplaced);
					objThis.db.findOne({name: objThis.name}, function(err, doc){
						console.log('db device', doc);
					});
				});
	}
}