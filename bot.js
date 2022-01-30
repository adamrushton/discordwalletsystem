require('dotenv').config();

const { Client, Intents, Permissions } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

const mongo = require('./mongo');
const mongoose = require('mongoose');
const Customers = require('./balanceschema');

const NO_PERMISSIONS = 'You do not have permission to use this command';

client.on('ready', async () => {
    await mongo();
    console.log(client.user.username + ' is online');
});

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

function getUserID(userTagged) {
    return userTagged.slice(3, userTagged.length - 1);
}

client.on('message', async (message) => {
    const args = message.content.slice().trim().split(' ');
    const command = args.shift().toLowerCase();
    if (message.author.bot) return; // stop bot from spamming

    console.log('args: ' + args);
    console.log('command: ' + command);
    console.log('message content: ' + message.content);

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
                clearBalance(args, message, message.member);
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
            if (message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
                message.channel.send('**' + message.member.user.username + '** flipped a coin and landed on **' + flip() + '**');
            } else {
                message.channel.send(NO_PERMISSIONS);
            }
            break;

        case 'dice':
            message.channel.send('** ' + message.member.user.username + ' ** rolled a **' + dice(1, 100) + '**');
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

        case 'total':
            break;

        case 'wageredleaderboard':
            totalWageredLeaderboard();
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

const updatebalance = async (args, message) => {
    console.log('User ID: ' + args[0]);
    console.log('Amount: ' + args[1]);
    const userID = getUserID(args[0]);
    if (!isNumber(userID)) {
        message.channel.send('Invalid user input');
        return;
    }
    console.log('Looking for ID: ' + userID);

    var customer = await Customers.findOne({ unique_id: userID });

    if (customer == null) {
        console.log('ID Doesnt exist, creating & reassigning customer...');
        createNewUser(userID, message);
        customer = await Customers.findOne({ unique_id: userID });
    }
    if (args[1] > 0) {
        console.log('Updating balance of ' + userID + ' by adding ' + args[1]);
        customer.balance += parseFloat(args[1]);
        const updateCustomer = await Customers.findOneAndUpdate({ unique_id: userID }, { balance: customer.balance });
        message.channel.send('Added ' + args[1] + ' to the balance of ' + args[0] + ' (' + args[0] + ') New balance: ' + customer.balance);
    } else {
        message.channel.send('Invalid deposit: ' + args[1]);
    }
}

const displayBalance = async (args, message) => {
    console.log('display balance - args length' + args.length);
    switch (args.length) {
        case 0:
            console.log('no parameters found, searching for the user who typed the command');
            var customer = await Customers.findOne({ unique_id: message.member.id });
            if (customer == null) {
                message.channel.send('User ' + message.member.user.username + ' (' + message.member.id + ') not found in the database, you need to deposit first.');
                return;
            }
            console.log(customer.balance);
            message.channel.send('Balance of ' + member.user.username + ' is ' + customer.balance);
            break;

        case 1:
            const userID = getUserID(args[0]);
            console.log('User ID: ' + userID);

            if (!isNumber(userID)) {
                message.channel.send('Invalid user input');
                return;
            }
            customer = await Customers.findOne({ unique_id: userID });
            if (customer == null) {
                message.channel.send('User ' + args[0] + ' (' + userID + ') not found in the database, you need to deposit first.');
                return;
            }
            console.log(customer.balance);
            message.channel.send('Balance of ' + args[0] + ' is ' + customer.balance);
            break;
    }
}

const clearBalance = async (args, message, member) => {
    console.log('start of remove balance');
    console.log('args0 ' + args[0]);

    if (args.length == 0) {
        console.log('no parameters found ,searching the for user who typed the command');
        await Customers.findOneAndUpdate({ unique_id: member.id, balance: 0 });
        const checkCustomerBalance = await Customers.findOne({ unique_id: member.id });
        message.channel.send('Balance of ' + member.user.username + ' is now ' + checkCustomerBalance.balance);
    }
}

const createNewUser = async (userID, message) => {
    try {
        console.log('start of createnewuser: userid: ' + userID);
        const newCustomer = await Customers.create({
            unique_id: userID,
            balance: 0
            //    total_wagered: 0,
            //    total_deposited: 0,
            //     total_withdrawn: 0,
            //     largest_bet: 0
        });
        console.log('new customer formed');
        await newCustomer.save();

        console.log('new customer created');
        message.channel.send('New user ' + userID + ' created');
    } catch (error) {
        console.log('error' + error);
    } finally {
        console.log('well finally ended');
    }
}

const totalWageredLeaderboard = async (userID, message) => {
    // await 
}
const depositWageredLeaderboard = async (userID, message) => {
    //  await 
}
const withdrawWageredLeaderboard = async (userID, message) => {
    //  await 
}
client.login(process.env.TRUSTEDDUELS_BOT_TOKEN);
