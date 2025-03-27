Discord Reaction Bot

A versatile Discord bot for automatic message reactions, scheduled messages, and Warmane Armory lookups.

Overview

This Discord bot is designed to enhance server interaction with several key features:

  Automatic Reactions: Configure the bot to automatically add specific reactions to messages from specific users
  Random Messages: Schedule random messages from a customizable pool to be sent at regular intervals
  Scheduled Messages: Plan specific messages to be sent at exact dates and times
  Warmane Armory Integration: Look up character and guild information from Warmane's Icecrown server
  Admin Management: Control who can access and configure the bot
  
Features & Commands
  Reaction System
        /setreactions - Configure reactions for a specific user
        /listreactions - View all configured user reactions
        /clearreactions - Remove all reactions for a user
        /addreaction - Add a single reaction to a user's existing reactions
        Once configured, the bot will automatically add the specified reactions to every message from that user.
  Random Message System
        /addmessage - Add a message to the random message pool
        /removemessage - Remove a message from the pool
        /listmessages - View all messages in the pool
        /setinterval - Set how often random messages should be sent (in hours)
        /setchannel - Add a channel where random messages will be sent
        /removechannel - Remove a channel from the random message list
  Scheduled Messages
        /schedulemessage - Schedule a specific message to be sent at a future date and time
        /listscheduled - View all scheduled messages
        /cancelscheduled - Cancel a scheduled message
        /sendnow - Send a message immediately to a specific channel
Warmane Armory Integration
    /armory - Look up character information on Warmane's Icecrown server
    /guild - Look up guild information with options to filter online members
Admin Management
    /addadmin - Add a user as an admin who can configure the bot
    /removeadmin - Remove admin privileges from a user
    /listadmins - List all users with admin privileges
    /settings - View current bot settings
Setup
    Install dependencies: npm install discord.js axios dotenv
    Create a .env file with:
             DISCORD_TOKEN=your_discord_bot_token
             GUILD_ID=optional_default_guild_id
             PERMANENT_ADMIN_IDS=your_discord_id,another_admin_id
    another_admin_id
    Run the bot: node bot.js
Example Usage:

Setting Up Reactions
  /setreactions user:@JohnDoe reactions:👍 🎉 🔥

This will make the bot automatically add 👍, 🎉, and 🔥 reactions to all messages from JohnDoe.
Scheduling a Message

  /schedulemessage message:Don't forget our guild raid tonight! date:25-11-2023 time:19:00 channel:#announcements
  This will schedule the message to be sent on November 25th, 2023 at 7:00 PM (CET time).

Looking Up Character Information
  
  /armory character:Healingtime
This will return character information from Warmane's Icecrown server.

Configuration
The bot stores its configuration in a config.json file, which is automatically created and maintained. This file includes all reaction settings, message pools, scheduled messages, and admin lists.

Permissions
Only users designated as admins can configure the bot. The initial admin is set via the PERMANENT_ADMIN_IDS environment variable.
