require('dotenv').config();
const Homenet = require('./lib/homenet.js');

var net = new Homenet(process.env.LOCAL_PORT);