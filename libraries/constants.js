const fs = require('fs');
const path = require('path');
const readline = require('readline');
const pino = require('pino');
const crypto = require('crypto');
let b;
function lb () {
    if (!b) b = import('@qwerty-xcv/baileys');
    return b
}
const baileys = lb();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise(resolve => rl.question(text, resolve));
module.exports = {
    path,
    fs,
    lb,
    baileys,
    question,
    pino,
    crypto
}