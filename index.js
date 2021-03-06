#!/usr/bin/env node

import {install} from 'source-map-support'
install()

import fs from 'fs'
import path from 'path'
import minimist from 'minimist'
import vorpal from 'vorpal'
import RPC from './lib/rpc'
import Contract from './lib/contract'
import utils from './lib/utils'
import {} from 'babel-polyfill'

// args

var argv = minimist(process.argv.slice(2), {string: ['a', 'address']})

if (argv.h || argv.help) {
  console.log('Not implemented!')
  process.exit()
}

if (!argv.f && !argv.file) {
  console.log('Specify contract file')
  process.exit()
}

// logger

var cli = vorpal()

function log (type, value, json) {
  cli.log.apply(cli, utils.log(type, value, json))
}

// RPC

var rpc = new RPC({host: argv.host, port: argv.p || argv.port})

rpc.on('connection', function (connected) {
  if (connected) {
    log('RPC', 'Connected!')
  }
  else {
    log('RPC', 'Disconnected!')
  }
})

log('RPC', rpc.url)
log('RPC', 'Disconnected!')
var web3 = rpc.connect()
utils.promisify(web3)
rpc.watch()

// Contract

var source = fs.readFileSync(path.join(process.cwd(), argv.f || argv.file), 'utf8')
var contract = new Contract(web3, source)

contract.on('deploying', function (contract) {
  log('Contract', 'Transaction sent!')
  log('Transaction', contract.transactionHash) // waiting to be mined...
})

contract.on('deployed', function (contract) {
  log('Contract', 'Mined!')
  log('Contract', contract, true)
})
contract.on('error', function (err) {
  log('Error', err.message)
})

// Account

var account = {}

// CLI

cli
  .command('compile', 'Compile contract')
  .action(async (args, done) => {
    try {
      var compiled = await contract.compile()
      log('Contract', compiled, true)
    }
    catch (err) {
      log('Error', err.message)
    }
    done()
  })
cli
  .command('deploy', 'Deploy contract')
  .option('-a, --address', 'Account address')
  .option('-g, --gas', 'Gas amount')
  .types({string: ['a', 'address']})
  .action(function (args, done) {
    var accountAddress = utils.pick(args.options.a || args.options.address)
      || web3.eth.accounts[0]
    var gasAmount = utils.pick(args.options.g || args.options.gas)
      || 1000000
    // currently stored on deploy
    account.address = accountAddress
    contract.deploy(accountAddress, gasAmount)
    done()
  })
cli
  .command('init', 'Instantiate contract')
  .option('-a, --address', 'Contract address')
  .types({string: ['a', 'address']})
  .action(function (args, done) {
    var input = utils.pick(args.options.a || args.options.address)
    var contractAddress = input
    contract.init(contractAddress)
    done()
  })
cli
  .command('name <name>', 'Specify contract name')
  .action(function (args, done) {
    registerREPL(args.name)
    contract.name = args.name
    done()
  })
cli
  .delimiter('contract$')
  .show()


function registerREPL (name) {
  cli
    .mode(name)
    .delimiter(name + ':')
    .action(function (input, done) {
      input = 'contract.instance.' + input
      if (/.*\.watch$/.test(input)) {
        input += '(' + contractWatch.toString() + ')'
      }
      eval(input)
      done()
    })
}

// used for watching contract filters
function contractWatch (err, result) {
  if (err) {
    console.log(err)
  }
  else {
    log('Event', result, true)
  }
}
