const mongoose = require('mongoose');

const casinoSchema = new mongoose.Schema({
    uniqueid: {
        type: String,
        require: true,
        unique: true
    },
    balance: {
        type: Number,
        require: true
    },
    pendingstake: {
        type: Number,
        require: true
    },
    totaldeposited: {
        type: Number,
        require: true
    },
    totalwithdrawn: {
        type: Number,
        require: true
    },
    totalwagered: {
        type: Number,
        require: true
    },
    largestbet: {
        type: Number,
        require: true
    },
    streak: {
        type: Number,
        require: true
    }
},
    { collection: process.env.CASINO_DATABASE_NAME }
);

module.exports = mongoose.model('casinouser', casinoSchema);