require('dotenv').config();

/*
TO-DO List
Dice and Coinflip should update balance
stake <amount> should be added
win/loss should update balance
dice amount gamenumber
coinflip amount heads/tails
- check for enough funds
*/
const NO_PERMISSIONS = 'You do not have permission to use this command';
const { Client, Intents, Permissions } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const CasinoUser = require('./schemas/casinouserschema');
const mongoose = require('mongoose');

/*
service fee vars
*/
var percentage = 0;
var multiplier = 0;
var amountToSubtract = 0;
var potAmount = 0;
var cent = 100;
// end

mongoose.connect(process.env.CASINO_MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then((m) => {
    console.log('Connected to DB');
}).catch((err) => console.log(err));

client.login(process.env.CASINO_TOKEN);

client.on('ready', async () => {
    console.log(client.user.username + ' has logged in.');
});

client.on('message', async (message) => {
    const args = message.content.slice().trim().split(' ');
    const command = args.shift().toLowerCase();
    if (message.author.bot) return; // stop bot from spamming

    switch (command) {
        case 'updatebalance':
            if (message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
                updatebalance(args, message);
            } else {
                message.channel.send(NO_PERMISSIONS);
            }
            break;

        case 'clearbalance':
            if (message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
                clearBalance(args, message);
            } else {
                message.channel.send(NO_PERMISSIONS);
            }
            break;

        case 'deposit':
            deposit(args, message);
            break;

        case 'balance':
            displayBalance(args, message);
            break;

        case 'leaderboard':
            totalWageredLeaderboard(message);
            break;

        case 'johnny':
            message.channel.send('johnny isnt home right now, he is dropping the kids off at the pool');
            break;

        case 'flip':
            var choice = args[0];
            var amount = parseFloat(args[1]);
            var customer = await CasinoUser.findOne({ uniqueid: message.member.id });
            var takeBetFromBalance = customer.balance - amount;
            var updatedWager = customer.totalwagered + amount;
            if (isTicketChannel(message.channel.name) && args.length == 2 && customer != null && isHeadsOrTails(args[0]) && customer.balance >= amount) {
                var flipResult = flip();
                var mainFlipMessage = '**' + message.member.user.username + '** flipped a coin and landed on **' + flipResult + '**';
                if (choice.toLowerCase() === flipResult.toLowerCase()) {
                    await CasinoUser.findOneAndUpdate({ uniqueid: message.member.id }, { balance: takeBetFromBalance, totalwagered: updatedWager });
                    console.log('set their balance from: ' + takeBetFromBalance + ' to ' + takeBetFromBalance);
                    console.log('victory amount: ' + getVictoryAmount(amount));
                    var updatedBalance = takeBetFromBalance + getVictoryAmount(amount);
                    console.log('updated balance: ' + updatedBalance);
                    await CasinoUser.findOneAndUpdate({ uniqueid: message.member.id }, { balance: updatedBalance, totalwagered: updatedWager });
                    message.channel.send(':green_circle: ' + mainFlipMessage + ' **Win**! New balance: ' + updatedBalance + '(' + percentage + '%)');
                } else {
                    var updatedBalance = customer.balance - parseFloat(amount);
                    await CasinoUser.findOneAndUpdate({ uniqueid: message.member.id }, { balance: updatedBalance });
                    message.channel.send(':red_circle:' + mainFlipMessage + ' **Loss**! New balance: ' + updatedBalance);
                }
            } else if (customer.balance < amount) {
                message.channel.send('You need to deposit more to bet this amount');
            } else if (!isHeadsOrTails(args[0])) {
                message.channel.send('Invalid choice: ' + args[0] + ' you have to write heads or tails');
            } else if (args.length > 2) {
                message.channel.send('Invalid command syntax, example usage: flip 50 heads');
            } else if (customer == null) {
                message.channel.send('User not found in database, please deposit first');
            } else {
                message.channel.send(NO_PERMISSIONS);
            }
            break;

        case 'dice':
            if (isTicketChannel(message.channel.name)) {
                message.channel.send('** ' + message.member.user.username + ' ** rolled a **' + dice(1, 100) + '**');
            } else {
                message.channel.send('You can only perform this command within tickets');
            }
            break;

        case 'hello':
            message.channel.send('hello johnny');
            break;

        case 'id':
            message.channel.send('your id is ' + message.member.id);
            break;

        case 'win':
            if (message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
                message.channel.send('win, balanced now ')
            } else {
                message.channel.send(NO_PERMISSIONS);
            }
            break;

        case 'loss':
            if (message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
                message.channel.send('loss, balanced now ')
            } else {
                message.channel.send(NO_PERMISSIONS);
            }
            break;

        case 'allbalances':
            if (message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
                allBalances(message);
            } else {
                message.channel.send(NO_PERMISSIONS);
            }
            break;

        case 'depositleaderboard':
            depositLeaderboard();
            break;

        case 'withdrawleaderboard':
            withdrawLeaderboard();
            break;

        default:
            break;
    }
});

function isHeadsOrTails(option) {
    return option.toLowerCase() == 'heads' || option.toLowerCase() == 'tails';
}

function isTicketChannel(channelName) {
    return channelName.startsWith('ticket');
}

function isNumber(userID) {
    return /^\d+$/.test(userID);
}

function dice(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}

var coinflip = ['Heads', 'Tails']

function flip() {
    return coinflip[dice(0, 1)];
}

// Note this function is not to be called for message.member.id, only when dealing players @
function getUserID(userTagged) {
    return userTagged.slice(3, userTagged.length - 1);
}

function getUserTag(unique_id) {
    return '<@' + unique_id + '>';
}

async function updatebalance(args, message) {
    console.log('User ID: ' + args[0]);
    console.log('Amount: ' + args[1]);
    const userID = getUserID(args[0]);
    if (!isNumber(userID)) {
        message.channel.send('Invalid user input');
        return;
    }
    console.log('Looking for ID: ' + userID);
    var customer = await CasinoUser.findOne({ uniqueid: userID });

    if (customer == null) {
        if (args.length > 0) {
            console.log('ID Doesnt exist, creating & updating balance of a new customer...');
            createNewUser(userID, message, parseFloat(args[1]));
        }
        customer = await CasinoUser.findOne({ uniqueid: userID });
    }
    if (args.length > 0 && customer != null) {
        console.log('Updating balance of ' + userID + ' by adding ' + args[1]);
        customer.balance += parseFloat(args[1]);
        await CasinoUser.findOneAndUpdate({ uniqueid: userID }, { balance: customer.balance });
        message.channel.send('Added ' + args[1] + ' to the balance of ' + args[0] + ' New balance: ' + customer.balance);
    } else if (customer != null) {
        message.channel.send('Invalid deposit: ' + args[1]);
    }
}

async function displayBalance(args, message) {
    console.log('display balance - args length' + args.length);
    switch (args.length) {
        case 0:
            console.log('no parameters found, searching for the user who typed the command');
            var customer = await CasinoUser.findOne({ uniqueid: message.member.id });
            if (customer == null) {
                message.channel.send('User ' + message.member.user.username + ' (' + message.member.id + ') not found in the database, you need to deposit first.');
                return;
            }
            console.log(customer.balance);
            message.channel.send('Balance of ' + message.member.user.username + ' is ' + customer.balance);
            break;

        case 1:
            if (message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
                console.log('searching a balance of another user');
                const userID = getUserID(args[0]);
                console.log('User ID: ' + userID);

                if (!isNumber(userID)) {
                    message.channel.send('Invalid user input');
                    return;
                }
                if (CasinoUser.exists({ uniqueid: userID })) {
                    console.log('customer found');
                    customer = await CasinoUser.findOne({ uniqueid: userID });
                } else {
                    console.log('customer not found with ID ' + userID);
                }
                if (customer == null) {
                    message.channel.send('User ' + args[0] + ' (' + userID + ') not found in the database, you need to deposit first.');
                    return;
                }
                console.log(customer.balance);
                message.channel.send('Balance of ' + args[0] + ' is ' + customer.balance);
            } else {
                message.channel.send(NO_PERMISSIONS);
            }
            break;
    }
}

async function resetBalance(unique_id, message) {
    await CasinoUser.findOneAndUpdate({ uniqueid: unique_id, balance: 0 });
    const checkCustomerBalance = await CasinoUser.findOne({ uniqueid: unique_id });
    message.channel.send('Balance of ' + getUserTag(unique_id) + ' is now ' + checkCustomerBalance.balance);
}

async function clearBalance(args, message) {
    switch (args.length) {
        case 0: // clearing own balance as an admin
            resetBalance(message.member.id, message);
            break;
        case 1: // clearing a users balance
            resetBalance(getUserID(args[0]), message);
            break;
    }
}

async function createNewUser(userID, message, firstWager) {
    const newCustomer = await CasinoUser.create({
        uniqueid: userID,
        balance: firstWager,
        totaldeposited: 0,
        totalwithdrawn: 0,
        totalwagered: 0,
        largestbet: 0
    });

    await newCustomer.save();
    message.channel.send('New user ' + userID + ' created with a first wager of ' + firstWager);
}

async function allBalances(message) {
    var sampleText = '';
    const sorted = CasinoUser.find().sort({ balance: -1 });
    const cursor = sorted.cursor();
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        sampleText += getUserTag(doc.uniqueid) + '**' + doc.balance + 'm**\n';
    }
    message.channel.send('**CUSTOMERS BALANCE TABLE**\n' + sampleText);
}

async function totalWageredLeaderboard(message) {
    var sampleText = '';
    const sorted = CasinoUser.find().sort({ totalwagered: -1 });
    const cursor = sorted.cursor();
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        sampleText += getUserTag(doc.uniqueid) + '**' + doc.totalwagered + 'm**\n';
    }
    message.channel.send('**CUSTOMERS TOTAL WAGERED TABLE**\n' + sampleText);
}

async function depositLeaderboard(userID, message) {
    //  await 
}
async function withdrawLeaderboard(userID, message) {
    //  await 
}

function getVictoryAmount(bet) {
    potAmount = bet + bet;
    if (potAmount >= 0.0 && potAmount < 1000.0) {
        percentage = 5;
    } else if (potAmount >= 1000.0 && potAmount < 2000.0) {
        percentage = 7.5;
    } else if (potAmount >= 2000.0 && potAmount < 10000.0) {
        percentage = 10;
    } else if (potAmount >= 10000.0) {
        percentage = 12.5;
    }
    multiplier = percentage / cent;
    amountToSubtract = potAmount * multiplier;
    return parseFloat(potAmount - amountToSubtract);
}

function deposit(args, message) {
    switch (args.length) {
        case 0:
            message.channel.send('@here ' + message.member + ' is looking to deposit');
            break;
        case 1:
            if (isNumber(args[0])) {
                message.channel.send('@here ' + message.member + ' is looking to deposit ' + args[0] + 'm');
            }
            break;
    }
}