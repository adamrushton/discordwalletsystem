require('dotenv').config();

/*
Remaining
Withdraw should check balance to make sure that they have enough balance to withdraw the amount they've said
Any commands have their own meethod so the switch is clean
Clean up code (object oriented)
*/

const { Client, Intents, Permissions, MessageEmbed } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const CasinoUser = require('./schemas/casinouserschema');
const mongoose = require('mongoose');

const NO_PERMISSIONS = 'You do not have permission to use this command in this channel';
const NO_PENDING_STAKE = 'has not created a pending stake. They need to use stake <amount> to create one';
const USER_DOESNT_EXIST = 'User not found in database, please deposit first';
const DICE_DRAW = ':yellow_circle: **Draw**';
const coinflip = ['Heads', 'Tails']

var percentage = 0;
var multiplier = 0;
var amountToSubtract = 0;
var potAmount = 0;
var cent = 100;

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
        case 'help':
        case 'commands':
            commands(message);
            break;

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

        case 'withdraw':
            withdraw(args, message);
            break;

        case 'balance':
            displayBalance(args, message);
            break;

        case 'allbalances':
            if (message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
                allBalances(message);
            } else {
                message.channel.send(NO_PERMISSIONS);
            }
            break;

        case 'flip':
            var choice = args[0];
            var amount = parseFloat(args[1]);
            var customer = await CasinoUser.findOne({ uniqueid: message.member.id });
            if (isTicketChannel(message.channel.name) && args.length == 2 && customer != null && customer.balance >= amount && isHeadsOrTails(args[0])) {
                var flipResult = flip();
                var mainFlipMessage = '**' + message.member.user.username + '** flipped a coin and landed on **' + flipResult + '**';
                message.channel.send(mainFlipMessage);
                if (choice.toLowerCase() === flipResult.toLowerCase()) {
                    userWins(message, command, customer, amount);
                } else {
                    userLoses(message, customer, amount);
                }
            } else if (!isHeadsOrTails(args[0])) {
                message.channel.send('Invalid choice: ' + args[0] + ' you have to write heads or tails');
            } else {
                writeInvalidBet(args, 2, message, amount, customer);
            }
            break;

        case 'higher':
            var amount = parseFloat(args[0]);
            var customer = await CasinoUser.findOne({ uniqueid: message.member.id });
            if (isTicketChannel(message.channel.name) && args.length == 1 && customer != null && customer.balance >= amount) {
                higher(message, command, customer, amount);
            } else {
                writeInvalidBet(args, 1, message, amount, customer);
            }
            break;

        case 'lower':
            var amount = parseFloat(args[0]);
            var customer = await CasinoUser.findOne({ uniqueid: message.member.id });
            if (isTicketChannel(message.channel.name) && args.length == 1 && customer != null && customer.balance >= amount) {
                lower(message, command, customer, amount);
            } else {
                writeInvalidBet(args, 1, message, amount, customer);
            }
            break;

        case '55x2':
            var amount = parseFloat(args[0]);
            var customer = await CasinoUser.findOne({ uniqueid: message.member.id });
            if (isTicketChannel(message.channel.name) && args.length == 1 && customer != null && customer.balance >= amount) {
                fivefivex2(message, command, customer, amount);
            } else {
                writeInvalidBet(args, 1, message, amount, customer);
            }
            break;

        case 'stake':
            var amount = parseFloat(args[0]);
            var customer = await CasinoUser.findOne({ uniqueid: message.member.id });
            if (isTicketChannel(message.channel.name) && args.length == 1 && customer != null && customer.balance >= amount) {
                stake(message, customer, amount);
            } else {
                writeInvalidBet(args, 1, message, amount, customer);
            }
            break;

        case 'win':
            if (args.length == 1) {
                var customer = await CasinoUser.findOne({ uniqueid: getUserID(args[0]) });
                if (customer == null) {
                    message.channel.send(USER_DOESNT_EXIST);
                }
                if (message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR) && customer != null) {
                    if (isNumber(getUserID(args[0])) && parseFloat(customer.pendingstake) > 0) {
                        userWins(message, command, customer, customer.pendingstake);
                        clearPendingStake(getUserID(args[0]));
                    } else {
                        message.channel.send(args[0] + ' ' + NO_PENDING_STAKE);
                    }
                } else if (customer != null) {
                    writeInvalidBet(args, 1, message, customer.pendingstake, customer);
                }
            }
            break;

        case 'loss':
            if (args.length == 1) {
                var customer = await CasinoUser.findOne({ uniqueid: getUserID(args[0]) });
                if (customer == null) {
                    message.channel.send(USER_DOESNT_EXIST);
                }
                if (message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR) && customer != null) {
                    if (isNumber(getUserID(args[0])) && customer.pendingstake > 0) {
                        userLoses(message, customer, customer.pendingstake);
                        clearPendingStake(getUserID(args[0]));
                    } else {
                        message.channel.send(args[0] + ' ' + NO_PENDING_STAKE);
                    }
                } else if (customer != null) {
                    writeInvalidBet(args, 1, message, customer.pendingstake, customer);
                }
            }
            break;

        case 'streak':
            streak(message, args);
            break;

        case 'leaderboard':
            totalWageredLeaderboard(message);
            break;

        case 'depositleaderboard':
            depositLeaderboard(message);
            break;

        case 'withdrawleaderboard':
            withdrawLeaderboard(message);
            break;

        // Misc commands
        case 'hello':
            message.channel.send('hello johnny');
            break;

        case 'johnny':
            message.channel.send('johnny isnt home right now, he is dropping the kids off at the pool');
            break;

        case 'id':
            message.channel.send('your id is ' + message.member.id);
            break;

        case 'johnny':
            message.channel.send('johnny isnt home right now, he is dropping the kids off at the pool');
            break;

        default:
            break;
    }
});

async function updatebalance(args, message) {
    const userID = getUserID(args[0]);
    if (!isNumber(userID)) {
        message.channel.send('Invalid user input');
        return;
    }
    var customer = await CasinoUser.findOne({ uniqueid: userID });

    if (customer == null) {
        if (args.length > 0) {
            createNewUser(userID, message, parseFloat(args[1]));
        }
        return;
    }
    if (args.length > 0 && customer != null) {
        var depositAmount = parseFloat(args[1]);
        customer.balance += depositAmount;
        if (depositAmount > 0) {
            customer.totaldeposited += depositAmount;
            await CasinoUser.findOneAndUpdate({ uniqueid: userID }, { balance: customer.balance, totaldeposited: customer.totaldeposited });
            message.channel.send('Deposited ' + args[1] + ' to the bank of ' + args[0] + ' New balance: ' + customer.balance);
        } else {
            customer.totalwithdrawn += depositAmount;
            await CasinoUser.findOneAndUpdate({ uniqueid: userID }, { balance: customer.balance, totaldeposited: customer.totaldeposited });
            message.channel.send('Withdrawn ' + args[1] + ' from the bank of ' + args[0] + ' New balance: ' + customer.balance);
        }
    } else if (customer != null) {
        message.channel.send('Invalid deposit: ' + args[1]);
    }
}

async function displayBalance(args, message) {
    switch (args.length) {
        case 0:
            var customer = await CasinoUser.findOne({ uniqueid: message.member.id });
            if (customer == null) {
                message.channel.send('User ' + message.member.user.username + ' (' + message.member.id + ') not found in the database, you need to deposit first.');
                return;
            }
            message.channel.send('Balance of ' + getUserTag(message.member.id) + ' is ' + customer.balance);
            break;

        case 1:
            if (message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
                const userID = getUserID(args[0]);
                if (!isNumber(userID)) {
                    message.channel.send('Invalid user input');
                    return;
                }
                if (CasinoUser.exists({ uniqueid: userID })) {
                    customer = await CasinoUser.findOne({ uniqueid: userID });
                } else {
                }
                if (customer == null) {
                    message.channel.send('User ' + args[0] + ' not found in the database, they need to deposit first.');
                    return;
                }
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
    message.channel.send('New user ' + getUserTag(userID) + ' created with a first wager of ' + firstWager + 'm');
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

async function depositLeaderboard(message) {
    var sampleText = '';
    const sorted = CasinoUser.find().sort({ totaldeposited: -1 });
    const cursor = sorted.cursor();
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        sampleText += getUserTag(doc.uniqueid) + '**' + doc.totaldeposited + 'm**\n';
    }
    message.channel.send('**CUSTOMERS TOTAL DEPOSITED TABLE**\n' + sampleText);
}

async function withdrawLeaderboard(message) {
    var sampleText = '';
    const sorted = CasinoUser.find().sort({ totalwithdrawn: -1 });
    const cursor = sorted.cursor();
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        sampleText += getUserTag(doc.uniqueid) + '**' + doc.totalwithdrawn + 'm**\n';
    }
    message.channel.send('**CUSTOMERS TOTAL WITHDRAWN TABLE**\n' + sampleText);
}

async function userWins(message, command, customer, amount) {
    var takeBetFromBalance = customer.balance - amount;
    var updatedWager = customer.totalwagered + amount;
    var streakToSet = 0;
    await CasinoUser.findOneAndUpdate({ uniqueid: message.member.id }, { balance: takeBetFromBalance, totalwagered: updatedWager });
    var updatedBalance = takeBetFromBalance + getVictoryAmount(command, amount);
    if (customer.streak >= 1) {
        streakToSet = customer.streak + 1;
    } else {
        streakToSet = 1;
    }
    await CasinoUser.findOneAndUpdate({ uniqueid: message.member.id }, { balance: updatedBalance, totalwagered: updatedWager, streak: streakToSet });
    if (command != '55x2') {
        message.channel.send(':green_circle: **Win**! New balance: ' + updatedBalance + 'm (' + percentage + '%)');
    } else {
        message.channel.send(':green_circle: **Win**! New balance: ' + updatedBalance + 'm');
    }
}

async function userLoses(message, customer, amount) {
    var updatedBalance = customer.balance - parseFloat(amount);
    var updatedWager = customer.totalwagered + amount;
    if (customer.streak <= 1) {
        streakToSet = customer.streak - 1;
    } else {
        streakToSet = -1;
    }
    await CasinoUser.findOneAndUpdate({ uniqueid: message.member.id }, { balance: updatedBalance, totalwagered: updatedWager, streak: streakToSet });
    message.channel.send(':red_circle: **Loss**! New balance: ' + updatedBalance + 'm');
}

async function fivefivex2(message, command, customer, amount) {
    var diceResult = dice(1, 100);
    message.channel.send('**' + getUserTag(message.member.id) + '** rolled a **' + diceResult + '**');
    if (diceResult >= 55) { // User win if 55 or higher
        userWins(message, command, customer, amount);
    } else {
        userLoses(message, customer, amount);
    }
}

async function stake(message, customer, amount) {
    if (customer.balance > amount) {
        await CasinoUser.findOneAndUpdate({ uniqueid: message.member.id }, { pendingstake: amount })
        message.channel.send(getUserTag(message.member.id) + ' is looking to stake ' + amount);
    } else {
        message.channel.send(getUserTag(message.member.id) + ' you need to deposit more to stake ' + amount + ' the maximum you can do right now is ' + customer.balance);
    }
}

async function clearPendingStake(id) {
    await CasinoUser.findOneAndUpdate({ uniqueid: id }, { pendingstake: 0 });
}

async function streak(message, args) {
    var idToCheck = 0;
    if (args.length == 0) {
        idToCheck = message.member.id;
    } else {
        idToCheck = getUserID(args[0]);
    }
    var customer = await CasinoUser.findOne({ uniqueid: idToCheck });
    if (customer != null) {
        message.channel.send(getUserTag(idToCheck) + ' Streak: ' + customer.streak);
    } else {
        message.channel.send(USER_DOESNT_EXIST);
    }
}

function roll(username, message) {
    var result = dice(1, 100);
    message.channel.send('**' + username + '** rolled a **' + result + '**');
    return result;
}

function higher(message, command, customer, amount) {
    var hostResult = roll('Host', message);
    var userResult = roll(getUserTag(message.member.id), message);
    if (userResult > hostResult) { // User win
        userWins(message, command, customer, amount);
    } else if (userResult == hostResult) { // Draw, both rolling same number
        message.channel.send(DICE_DRAW);
    } else { // Otherwise it's a loss, (rolled lower)
        userLoses(message, customer, amount);
    }
}

function lower(message, command, customer, amount) {
    var hostResult = roll('Host', message);
    var userResult = roll(getUserTag(message.member.id), message);
    if (userResult < hostResult) { // User win
        userWins(message, command, customer, amount);
    } else if (userResult == hostResult) { // Draw, both rolling same number
        message.channel.send(DICE_DRAW);
    } else { // Otherwise it's a loss, (rolled higher)
        userLoses(message, customer, amount)
    }
}

function getVictoryAmount(command, bet) {
    potAmount = bet + bet;
    if (command != '55x2') {
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
    } else {
        return parseFloat(potAmount);
    }
}

function deposit(args, message) {
    switch (args.length) {
        case 0:
            message.channel.send('@here ' + getUserTag(message.member.id) + ' is looking to deposit');
            break;
        case 1:
            if (isNumber(args[0]) || args[0].toLowerCase().endsWith('m') || args[0].toLowerCase().endsWith('b')) {
                message.channel.send('@here ' + getUserTag(message.member.id) + ' is looking to deposit ' + args[0]);
            }

            break;
    }
}

function withdraw(args, message) {
    switch (args.length) {
        case 0:
            message.channel.send('@here ' + getUserTag(message.member.id) + ' is looking to withdraw');
            break;
        case 1:
            if (isNumber(args[0]) || args[0].toLowerCase().endsWith('m') || args[0].toLowerCase().endsWith('b')) {
                message.channel.send('@here ' + getUserTag(message.member.id) + ' is looking to withdraw ' + args[0]);
            }
            break;
    }
}

function writeInvalidBet(args, amountOfArgsThereShouldBe, message, amount, customer) {
    if (args.length != amountOfArgsThereShouldBe) {
        message.channel.send('Invalid command syntax. Type help or commands to see how to use commands');
    } else if (customer == null) {
        message.channel.send(USER_DOESNT_EXIST);
    } else if (customer.balance < amount) {
        message.channel.send('You need to deposit more to bet this amount');
    } else if (!isNumber(amount)) {
        message.channel.send('Invalid number: ' + amount);
    } else {
        message.channel.send(NO_PERMISSIONS);
    }
}

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

function commands(message) {
    const commandsListEmbed = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle('Discord Bot Wallet System with Games')
        .setURL('https://github.com/adamrushton/discordwalletsystem')
        .setAuthor({ name: 'Adam Rushton', iconURL: 'https://i.imgur.com/AfFp7pu.png', url: 'https://acornserver.com' })
        .setDescription('Discord Bot Wallet System')
        .setThumbnail('https://i.imgur.com/AfFp7pu.png')
        .addFields(
            { name: 'Commands List', value: 'Find below a list of all commands' },
            { name: 'Update a users balance', value: 'updatebalance <tagged user> <amount>', },
            { name: 'Clear a users balance', value: 'clearbalance <tagged user>', },
            { name: 'Clear your balance', value: 'clearbalance', },
            { name: 'Display all recorded balances', value: 'allbalances', },
            { name: 'User Deposit', value: 'deposit', },
            { name: 'User Deposit a specific amount', value: 'deposit <amount>', },
            { name: 'User Withdraw', value: 'withdraw', },
            { name: 'User Withdraw a specific amount', value: 'withdraw <amount>', },
            { name: 'Display your balance', value: 'balance', },
            { name: 'Display a tagged users balance', value: 'balance <tagged user>', },
            { name: 'Wagered Leaderboard', value: 'leaderboard', },
            { name: 'Coinflipping', value: 'flip <heads/tails> <amount>', },
            { name: 'Dicing Highest Wins Game', value: 'higher <amount>', },
            { name: 'Dicing Lowest Wins Game', value: 'lower <amount>', },
            { name: 'Dicing 55x2 Game', value: '55x2 <amount>', },
            { name: 'User wins a Duel', value: 'win <tagged user>', },
            { name: 'User loses a Duel', value: 'loss <tagged user>', },
            { name: 'Your win or loss streak', value: 'streak', },
            { name: 'Win or loss streak of a tagged user', value: 'streak <tagged user>', },
            { name: 'Deposit Leaderboard', value: 'depositleaderboard', },
            { name: 'Withdraw Leaderboard', value: 'withdrawleaderboard', },

            { name: 'Miscellaneous Commands', value: 'Find below a list of none-related commands', },
            { name: 'Obtain your Unique ID', value: 'id', },
            { name: 'Johnny Related', value: 'johnny | hello', },
            { name: 'Get Help/Display Commands', value: 'help | commands', },

        )
        .setImage('https://i.imgur.com/AfFp7pu.png')
        .setTimestamp()
        .setFooter({ text: 'RIP Duel Arena 17-11-2021', iconURL: 'https://i.imgur.com/AfFp7pu.png' });

    message.channel.send({ embeds: [commandsListEmbed] });
}