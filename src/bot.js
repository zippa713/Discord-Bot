const { Client, Intents } = require('discord.js')
const { updatePresence } = require('./utils/presence')
const getDb = require('./managers/database')
const loadCogs = require('./managers/cogs')
const loadCommands = require('./managers/commands')
const loadJobs = require('./managers/jobs')
const config = require('./config.json')
const { passedCooldown, setCommandCooldown } = require('./utils/cooldown')
/* inlineReply */ require('discord-reply')

// Create our bot client
const client = new Client({
  ws: {
    intents: new Intents(Intents.ALL)
  }
})

/**
 * Bot is ready
 */
client.on('ready', async () => {
  console.log(client.user.tag + ' has logged in.')

  // Initialise database
  client.db = await getDb()

  // Update Presence (and start interval)
  await updatePresence(client)
  
  // Load cogs, commands & jobs
  await loadCogs(client)
  await loadCommands(client)
  await loadJobs(client)
});

/**
 * Message handling
 */
client.on('message', async (message) => {
  // Command handler loaded
  const { commands } = client
  if (!commands) return

  // Ignore messages from bots
  if (message.author.bot) return

  // Ignore non-text channels
  if (!['text', 'news'].includes(message.channel.type)) return
  
  // Ignore all messages that don't start with our prefix
  if (!message.content.startsWith(config.prefix)) return

  // Attempt to handle the command
  const args = message.content.slice(config.prefix.length).trim().split(/ +/)
  const command = args.shift().toLowerCase()
  const run = commands.find((cmd) => cmd.meta.commands.includes(command))
  if (run) {
    // Check if this command can be run within the relative guild
    const guildEnabled = run.meta.guilds.length > 0 ? run.meta.guilds.includes(message.guild.id) : true
    if (!guildEnabled) {
      return await message.reply(`:x: You are unable to run this command in this guild.`)
    }

    // Check to see if the user running this command has
    // all of the required permissions to run it
    let userCanRun = run.meta.permissions.every((perm) => message.member.hasPermission(perm))
    if (!userCanRun) {
      return await message.channel.send(`:x: You do not have permission to run the "${config.prefix}${command}" command.`)
    }

    // Don't run the command if we're in a cooldown for this channel
    if (!passedCooldown(run, message)) {
      message.react('⏱️')
      return console.warn('Not running', run.meta.name, 'due to cooldown')
    }

    // Cooldown passed, execute command
    console.log('Running command:', run.meta.name)
    await setCommandCooldown(run, message.channel.id)
    await run.run(client, run.cache, message, run)
  }
})

// Login
client.login(config.token)
