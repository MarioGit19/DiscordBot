require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const axios = require("axios"); // Make sure to install this: npm install axios

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Use environment variables instead of hardcoded values
const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

// For arrays, split the string by commas
const PERMANENT_ADMINS = process.env.PERMANENT_ADMIN_IDS?.split(",") || [
  "447910254114766848",
];

// Path to configuration file
const CONFIG_PATH = path.join(__dirname, "config.json");

// Load or create configuration
let config = {
  userReactions: {}, // Map of user IDs to their specific reactions
  messages: [
    "There's a ginger lad in here, whom I'd love to shag!",
    "Yasen should be perma muted",
    "Send Feet pics",
    "Carl is the most magnificent ginger leprechaun in the world.",
    "Foot Fetishers unite!",
    "Seyo stop eating please.",
    "Anyone wants to get his toes sucked?",
    "Madi was banned, and there is no going back.",
  ],
  messageChannels: [],
  messageInterval: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
  adminUsers: ["447910254114766848"], // DEFAULT ADMIN: Your ID is added by default
  scheduledMessages: [], // NEW: Array to store scheduled messages
  activeMessageIndex: null,
  activeMessageInterval: null,
};

// Load configuration if exists
if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    console.log("Configuration loaded successfully");
  } catch (error) {
    console.error("Error loading configuration:", error);
  }
}

// Save configuration
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log("Configuration saved successfully");
  } catch (error) {
    console.error("Error saving configuration:", error);
  }
}

// Helper function to format messages with line breaks
function formatMessage(message) {
  if (!message) return message;

  // Replace \n with actual line breaks
  let formatted = message.replace(/\\n/g, "\n");

  // Also replace {br} with line breaks (alternative notation)
  formatted = formatted.replace(/{br}/gi, "\n");

  return formatted;
}

// Function to register commands to a specific guild (server) - faster for testing
async function registerGuildCommands(guildId) {
  const commandData = [
    {
      name: "setreactions",
      description: "Set reactions for a specific user",
      options: [
        {
          name: "user",
          description: "The user to set reactions for",
          type: 6, // USER type
          required: true,
        },
        {
          name: "reactions",
          description: "Space-separated emojis to react with",
          type: 3, // STRING type
          required: true,
        },
      ],
    },
    {
      name: "listreactions",
      description: "List all users and their configured reactions",
    },
    {
      name: "clearreactions",
      description: "Remove all reactions for a user",
      options: [
        {
          name: "user",
          description: "The user to clear reactions for",
          type: 6, // USER type
          required: true,
        },
      ],
    },
    {
      name: "settings",
      description: "View current bot settings",
    },
    {
      name: "addmessage",
      description: "Add a message to the random message pool",
      options: [
        {
          name: "message",
          description: "The message to add",
          type: 3, // STRING type
          required: true,
        },
      ],
    },
    {
      name: "removemessage",
      description: "Remove a message from the pool by index",
      options: [
        {
          name: "index",
          description:
            "The index of the message to remove (use /listmessages to see indices)",
          type: 4, // INTEGER type
          required: true,
        },
      ],
    },
    {
      name: "listmessages",
      description: "List all messages in the pool with their indices",
    },
    {
      name: "setinterval",
      description: "Set the interval for random messages (in hours)",
      options: [
        {
          name: "hours",
          description: "Hours between messages",
          type: 10, // NUMBER type
          required: true,
        },
        {
          name: "message_index",
          description:
            "Index of a specific message to set interval for (leave empty for all messages)",
          type: 4, // INTEGER type
          required: false,
        },
      ],
    },
    {
      name: "setchannel",
      description: "Set a channel for random messages",
      options: [
        {
          name: "channel",
          description: "The channel to send messages in",
          type: 7, // CHANNEL type
          required: true,
        },
      ],
    },
    {
      name: "removechannel",
      description: "Remove a channel from the random message list",
      options: [
        {
          name: "channel",
          description: "The channel to remove",
          type: 7, // CHANNEL type
          required: true,
        },
      ],
    },
    {
      name: "addadmin",
      description: "Add a user as an admin who can use bot commands",
      options: [
        {
          name: "user",
          description: "The user to add as admin",
          type: 6, // USER type
          required: true,
        },
      ],
    },
    {
      name: "removeadmin",
      description: "Remove a user from the admin list",
      options: [
        {
          name: "user",
          description: "The user to remove from admins",
          type: 6, // USER type
          required: true,
        },
      ],
    },
    {
      name: "listadmins",
      description: "List all users who have admin permissions",
    },
    {
      name: "addreaction",
      description: "Add a reaction to a user's existing reactions",
      options: [
        {
          name: "user",
          description: "The user to add reactions for",
          type: 6, // USER type
          required: true,
        },
        {
          name: "reaction",
          description: "The emoji to add",
          type: 3, // STRING type
          required: true,
        },
      ],
    },
    {
      name: "sendnow",
      description: "Send a message to a channel immediately",
      options: [
        {
          name: "message",
          description: "The message to send (can include line breaks)",
          type: 3, // STRING type
          required: false,
        },
        {
          name: "message_index",
          description:
            "Index of a message from the pool to send (use /listmessages to see indices)",
          type: 4, // INTEGER type
          required: false,
        },
        {
          name: "channel",
          description:
            "The channel to send the message to (defaults to current channel)",
          type: 7, // CHANNEL type
          required: false,
        },
      ],
    },
    {
      name: "schedulemessage",
      description:
        "Schedule a message to be sent at a specific time (CET/GMT+1)",
      options: [
        {
          name: "message",
          description: "The message to send",
          type: 3, // STRING type
          required: true,
        },
        {
          name: "date",
          description: "Date (DD-MM-YYYY)",
          type: 3, // STRING type
          required: true,
        },
        {
          name: "time",
          description: "Time in 24h format (HH:MM) in CET/GMT+1",
          type: 3, // STRING type
          required: true,
        },
        {
          name: "channel",
          description:
            "The channel to send the message to (defaults to current channel)",
          type: 7, // CHANNEL type
          required: false,
        },
      ],
    },
    {
      name: "listscheduled",
      description: "List all scheduled messages",
    },
    {
      name: "cancelscheduled",
      description: "Cancel a scheduled message by its ID",
      options: [
        {
          name: "id",
          description: "ID of the scheduled message to cancel",
          type: 3, // STRING type
          required: true,
        },
      ],
    },
    {
      name: "armory",
      description: "Look up a character on Warmane's Icecrown server",
      options: [
        {
          name: "character",
          description: "Character name to look up",
          type: 3, // STRING type
          required: true,
        },
      ],
    },
    {
      name: "guild",
      description: "Look up a guild on Warmane's Icecrown server",
      options: [
        {
          name: "name",
          description: "Guild name to look up",
          type: 3, // STRING type
          required: true,
        },
        {
          name: "filter",
          description: "Filter results (online/all)",
          type: 3, // STRING type
          required: false,
          choices: [
            { name: "Online Only", value: "online" },
            { name: "All Members", value: "all" },
          ],
        },
      ],
    },
    {
      name: "clearinterval",
      description: "Clear the current scheduled message interval",
    },
  ];

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log(`Started registering commands to guild ${guildId}`);

    // This registers commands to a specific guild (faster updates)
    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
      body: commandData,
    });

    console.log(`Successfully registered commands to guild ${guildId}`);
  } catch (error) {
    console.error(`Error registering commands to guild ${guildId}:`, error);
  }
}

// Store the active message timer
let activeMessageTimer = null;
let activeMessageIndex = null;

// Function to send the active message
async function sendActiveMessage() {
  if (
    activeMessageIndex === null ||
    !config.messages ||
    !config.messages[activeMessageIndex] ||
    !config.messageChannels ||
    config.messageChannels.length === 0
  ) {
    console.log("No active message or channels configured");
    return;
  }

  const message = formatMessage(config.messages[activeMessageIndex]);

  // Send to each configured channel
  for (const channelId of config.messageChannels) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        await channel.send(message);
        console.log(
          `Sent scheduled message #${activeMessageIndex + 1} to ${
            channel.name
          }: ${message}`
        );
      }
    } catch (error) {
      console.error(`Error sending message to channel ${channelId}:`, error);
    }
  }
}

// Function to start the message timer
function startMessageTimer() {
  // Clear any existing timer
  stopMessageTimer();

  if (activeMessageIndex === null || !config.activeMessageInterval) {
    console.log("No active message or interval configured");
    return;
  }

  // Start a new timer
  console.log(
    `Starting timer for message #${activeMessageIndex + 1} with interval ${
      config.activeMessageInterval / (60 * 60 * 1000)
    } hours`
  );
  activeMessageTimer = setInterval(
    sendActiveMessage,
    config.activeMessageInterval
  );

  // Send immediately on startup
  sendActiveMessage();
}

// Function to stop the message timer
function stopMessageTimer() {
  if (activeMessageTimer) {
    clearInterval(activeMessageTimer);
    activeMessageTimer = null;
    console.log("Message timer stopped");
  }
}

// Function to check if a user has admin permissions
function isAdmin(userId) {
  // Permanent admins always have admin permissions
  if (PERMANENT_ADMINS.includes(userId)) {
    return true;
  }
  // Otherwise check the config
  return config.adminUsers && config.adminUsers.includes(userId);
}

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;
  const userId = interaction.user.id;

  // Log the command attempt
  console.log(
    `Received command: ${commandName} from ${interaction.user.tag} (${userId})`
  );

  try {
    // PUBLIC COMMANDS - Available to everyone
    if (commandName === "guild" || commandName === "armory") {
      // These commands are already handled in their respective cases
      // Let them proceed without admin check
    }
    // ADMIN COMMANDS - Special case for empty admin list
    else if (
      (!config.adminUsers || config.adminUsers.length === 0) &&
      (commandName === "addadmin" || commandName === "listadmins")
    ) {
      // Let these specific commands through if no admins exist yet
      // This allows initial setup
    }
    // ADMIN COMMANDS - Require admin permissions
    else if (!config.adminUsers.includes(userId)) {
      await interaction.reply({
        content: "You don't have permission to use this command.",
        ephemeral: true,
      });
      return;
    }

    // Process commands based on name
    switch (commandName) {
      // NEW ADMIN MANAGEMENT COMMANDS
      case "addadmin":
        const userToAdd = interaction.options.getUser("user");

        if (!config.adminUsers) {
          config.adminUsers = [];
        }

        if (!config.adminUsers.includes(userToAdd.id)) {
          config.adminUsers.push(userToAdd.id);
          saveConfig();
          await interaction.reply({
            content: `Added ${userToAdd.username} to admin users`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `${userToAdd.username} is already an admin`,
            ephemeral: true,
          });
        }
        break;

      case "removeadmin":
        const userToRemove = interaction.options.getUser("user");

        // Prevent removing permanent admins
        if (PERMANENT_ADMINS.includes(userToRemove.id)) {
          await interaction.reply({
            content: `${userToRemove.username} is a permanent admin and cannot be removed.`,
            ephemeral: true,
          });
          return;
        }

        if (
          !config.adminUsers ||
          !config.adminUsers.includes(userToRemove.id)
        ) {
          await interaction.reply({
            content: `${userToRemove.username} is not an admin`,
            ephemeral: true,
          });
          return;
        }

        // Don't allow removing the last admin
        const removableAdmins = config.adminUsers.filter(
          (id) => !PERMANENT_ADMINS.includes(id)
        );
        if (
          removableAdmins.length <= 1 &&
          removableAdmins.includes(userToRemove.id)
        ) {
          await interaction.reply({
            content: "Cannot remove the last non-permanent admin",
            ephemeral: true,
          });
          return;
        }

        const index = config.adminUsers.indexOf(userToRemove.id);
        config.adminUsers.splice(index, 1);
        saveConfig();
        await interaction.reply({
          content: `Removed ${userToRemove.username} from admin users`,
          ephemeral: true,
        });
        break;

      case "listadmins":
        if (!config.adminUsers || config.adminUsers.length === 0) {
          await interaction.reply({
            content: "No admin users configured",
            ephemeral: true,
          });
          return;
        }

        let adminList = "**Admin Users:**\n";

        for (const adminId of config.adminUsers) {
          try {
            const user = await client.users.fetch(adminId);
            adminList += `- ${user.username} (${adminId})\n`;
          } catch (error) {
            adminList += `- Unknown User (${adminId})\n`;
          }
        }

        await interaction.reply({
          content: adminList,
          ephemeral: true,
        });
        break;

      case "setreactions":
        const user = interaction.options.getUser("user");
        const reactionsString = interaction.options.getString("reactions");

        // Split the reactions string by spaces, ensuring we get all emojis
        const reactions = reactionsString.trim().split(/\s+/);

        if (reactions.length === 0) {
          await interaction.reply({
            content: "Please provide at least one valid emoji",
            ephemeral: true,
          });
          return;
        }

        // Make sure userReactions exists
        if (!config.userReactions) {
          config.userReactions = {};
        }

        // Set reactions for this user
        config.userReactions[user.id] = reactions;
        saveConfig();

        await interaction.reply({
          content: `Set ${reactions.length} reactions for ${
            user.username
          }:\n${reactions.join(
            " "
          )}\n\nThese reactions will be added in this order.`,
          ephemeral: true,
        });
        break;

      case "listreactions":
        if (
          !config.userReactions ||
          Object.keys(config.userReactions).length === 0
        ) {
          await interaction.reply({
            content: "No users have configured reactions",
            ephemeral: true,
          });
          return;
        }

        let responseText = "**User Reactions Configuration**\n";

        for (const [userId, reactions] of Object.entries(
          config.userReactions
        )) {
          try {
            const user = await client.users.fetch(userId);
            responseText += `**${user.username}** (${userId}): ${reactions.join(
              " "
            )}\n`;
          } catch (error) {
            responseText += `**Unknown User** (${userId}): ${reactions.join(
              " "
            )}\n`;
          }
        }

        await interaction.reply({
          content: responseText,
          ephemeral: true,
        });
        break;

      case "clearreactions":
        const userToClear = interaction.options.getUser("user");

        if (config.userReactions && config.userReactions[userToClear.id]) {
          delete config.userReactions[userToClear.id];
          saveConfig();
          await interaction.reply({
            content: `Cleared all reactions for ${userToClear.username}`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `${userToClear.username} doesn't have any configured reactions`,
            ephemeral: true,
          });
        }
        break;

      case "settings":
        // Format the data
        let userCount = Object.keys(config.userReactions || {}).length;
        let messageCount = (config.messages || []).length;
        let channelCount = (config.messageChannels || []).length;

        let activeMessageInfo = "No active scheduled message";
        if (
          config.activeMessageIndex !== undefined &&
          config.activeMessageIndex !== null
        ) {
          const messageText = config.messages[config.activeMessageIndex];
          const intervalHours = config.activeMessageInterval / (60 * 60 * 1000);
          activeMessageInfo = `Message #${
            config.activeMessageIndex + 1
          }: "${messageText}" (every ${intervalHours} hours)`;
        }

        const settingsInfo = [
          `**Current Bot Settings**`,
          `**Users with configured reactions:** ${userCount}`,
          `**Messages in pool:** ${messageCount}`,
          `**Message channels:** ${channelCount}`,
          `**Active scheduled message:** ${activeMessageInfo}`,
        ].join("\n");

        await interaction.reply({
          content: settingsInfo,
          ephemeral: true,
        });
        break;

      case "addmessage":
        const newMessage = interaction.options.getString("message");

        // Add the raw message to the config (line breaks will be processed when sending)
        config.messages.push(newMessage);
        saveConfig();

        // Show a formatted preview
        const formattedPreview = formatMessage(newMessage);

        await interaction.reply({
          content: `Added new message:\n"${formattedPreview}"\n\nNote: Use \\n or {br} in your message to create line breaks.`,
          ephemeral: true,
        });
        break;

      case "removemessage":
        const messageIndex = interaction.options.getInteger("index") - 1; // Convert from 1-based to 0-based
        if (messageIndex >= 0 && messageIndex < config.messages.length) {
          const removedMessage = config.messages.splice(messageIndex, 1)[0];
          saveConfig();
          await interaction.reply({
            content: `Removed message: "${removedMessage}"`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `Invalid message index. Use /listmessages to see valid indices.`,
            ephemeral: true,
          });
        }
        break;

      case "listmessages":
        if (!config.messages || config.messages.length === 0) {
          await interaction.reply({
            content: "No messages in the pool",
            ephemeral: true,
          });
          return;
        }

        let messageList = "**Messages:**\n";
        config.messages.forEach((message, index) => {
          messageList += `${index + 1}. ${message}\n`;
        });

        await interaction.reply({
          content: messageList,
          ephemeral: true,
        });
        break;

      case "setinterval":
        const hours = interaction.options.getNumber("hours");
        const intervalMsgIndex =
          interaction.options.getInteger("message_index");

        if (intervalMsgIndex === null) {
          await interaction.reply({
            content: "Please specify a message_index to schedule.",
            ephemeral: true,
          });
          return;
        }

        const actualMsgIndex = intervalMsgIndex - 1; // Convert from 1-based to 0-based

        if (actualMsgIndex < 0 || actualMsgIndex >= config.messages.length) {
          await interaction.reply({
            content: `Invalid message index. Use /listmessages to see valid indices (1-${config.messages.length}).`,
            ephemeral: true,
          });
          return;
        }

        // If hours is 0, stop the timer
        if (hours <= 0) {
          config.activeMessageIndex = null;
          config.activeMessageInterval = null;
          stopMessageTimer();
          activeMessageIndex = null;
          saveConfig();

          await interaction.reply({
            content: "Stopped the scheduled message timer.",
            ephemeral: true,
          });
          return;
        }

        // Store the new active message and interval
        const milliseconds = hours * 60 * 60 * 1000; // Convert hours to milliseconds
        config.activeMessageIndex = actualMsgIndex;
        config.activeMessageInterval = milliseconds;
        activeMessageIndex = actualMsgIndex;
        saveConfig();

        // Start or restart the timer
        if (config.messageChannels && config.messageChannels.length > 0) {
          startMessageTimer();
          await interaction.reply({
            content: `Now sending message "${config.messages[actualMsgIndex]}" every ${hours} hours. The message has been sent now and will repeat at the set interval.`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `Set message "${config.messages[actualMsgIndex]}" to send every ${hours} hours, but no channels are configured. Use /setchannel to add a channel.`,
            ephemeral: true,
          });
        }
        break;

      case "setchannel":
        const channel = interaction.options.getChannel("channel");

        if (!channel.isTextBased()) {
          await interaction.reply({
            content: "The selected channel must be a text channel",
            ephemeral: true,
          });
          return;
        }

        if (!config.messageChannels) {
          config.messageChannels = [];
        }

        if (!config.messageChannels.includes(channel.id)) {
          config.messageChannels.push(channel.id);
          saveConfig();

          // Start the timer if this is the first channel and we have an active message
          if (
            config.messageChannels.length === 1 &&
            config.activeMessageIndex !== undefined &&
            config.activeMessageInterval
          ) {
            activeMessageIndex = config.activeMessageIndex;
            startMessageTimer();
          }

          await interaction.reply({
            content: `Added ${channel.name} to message channels`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `${channel.name} is already a message channel`,
            ephemeral: true,
          });
        }
        break;

      case "removechannel":
        const channelToRemove = interaction.options.getChannel("channel");

        if (!config.messageChannels) {
          await interaction.reply({
            content: "No message channels configured",
            ephemeral: true,
          });
          return;
        }

        const channelIndex = config.messageChannels.indexOf(channelToRemove.id);
        if (channelIndex !== -1) {
          config.messageChannels.splice(channelIndex, 1);
          saveConfig();

          // Stop timer if no channels left
          if (config.messageChannels.length === 0) {
            stopMessageTimer();
          }

          await interaction.reply({
            content: `Removed ${channelToRemove.name} from message channels`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `${channelToRemove.name} is not a message channel`,
            ephemeral: true,
          });
        }
        break;

      case "addreaction":
        const userToAddReaction = interaction.options.getUser("user");
        const newReaction = interaction.options.getString("reaction").trim();

        if (!newReaction) {
          await interaction.reply({
            content: "Please provide a valid emoji",
            ephemeral: true,
          });
          return;
        }

        // Make sure userReactions exists
        if (!config.userReactions) {
          config.userReactions = {};
        }

        // If user doesn't have any reactions yet, create an empty array
        if (!config.userReactions[userToAddReaction.id]) {
          config.userReactions[userToAddReaction.id] = [];
        }

        // Add the new reaction to the existing array
        config.userReactions[userToAddReaction.id].push(newReaction);
        saveConfig();

        await interaction.reply({
          content: `Added reaction ${newReaction} to ${
            userToAddReaction.username
          }'s reactions.\nCurrent reactions: ${config.userReactions[
            userToAddReaction.id
          ].join(" ")}`,
          ephemeral: true,
        });
        break;

      case "sendnow":
        const messageToSend = interaction.options.getString("message");
        const sendNowMsgIndex = interaction.options.getInteger("message_index");
        const targetChannel =
          interaction.options.getChannel("channel") || interaction.channel;

        // Check if at least one of message or message_index is provided
        if (!messageToSend && sendNowMsgIndex === null) {
          await interaction.reply({
            content: "You must provide either a message or a message index.",
            ephemeral: true,
          });
          return;
        }

        if (!targetChannel.isTextBased()) {
          await interaction.reply({
            content: "The selected channel must be a text channel",
            ephemeral: true,
          });
          return;
        }

        let finalMessage = messageToSend;

        // If message_index is provided, use that message from the pool
        if (sendNowMsgIndex !== null) {
          const actualIndex = sendNowMsgIndex - 1; // Convert from 1-based to 0-based
          if (actualIndex < 0 || actualIndex >= config.messages.length) {
            await interaction.reply({
              content: `Invalid message index. Use /listmessages to see valid indices (1-${config.messages.length}).`,
              ephemeral: true,
            });
            return;
          }

          finalMessage = config.messages[actualIndex];

          // Ensure the message is not empty
          if (!finalMessage || finalMessage.trim() === "") {
            await interaction.reply({
              content: `Error: Message at index ${sendNowMsgIndex} is empty. Please check your messages.`,
              ephemeral: true,
            });
            return;
          }
        }

        // Ensure the final message is not empty before sending
        if (!finalMessage || finalMessage.trim() === "") {
          await interaction.reply({
            content:
              "Cannot send an empty message. Please provide a valid message.",
            ephemeral: true,
          });
          return;
        }

        // Format the message to handle line breaks
        finalMessage = formatMessage(finalMessage);

        try {
          await targetChannel.send(finalMessage);

          await interaction.reply({
            content: `Message sent to ${targetChannel.name}:\n"${finalMessage}"`,
            ephemeral: true,
          });
        } catch (error) {
          console.error("Error sending immediate message:", error);
          await interaction.reply({
            content: `Failed to send message: ${error.message}. Make sure the bot has permissions to send messages in that channel.`,
            ephemeral: true,
          });
        }
        break;

      case "schedulemessage":
        const msgToSchedule = interaction.options.getString("message");
        const targetChan =
          interaction.options.getChannel("channel") || interaction.channel;
        const dateStr = interaction.options.getString("date");
        const timeStr = interaction.options.getString("time");

        if (!targetChan.isTextBased()) {
          await interaction.reply({
            content: "The selected channel must be a text channel",
            ephemeral: true,
          });
          return;
        }

        // Validate date format (DD-MM-YYYY)
        const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
        const dateMatch = dateStr.match(dateRegex);
        if (!dateMatch) {
          await interaction.reply({
            content:
              "Invalid date format. Please use DD-MM-YYYY (e.g., 25-12-2023)",
            ephemeral: true,
          });
          return;
        }

        // Validate time format (HH:MM)
        const timeRegex = /^(\d{2}):(\d{2})$/;
        const timeMatch = timeStr.match(timeRegex);
        if (!timeMatch) {
          await interaction.reply({
            content:
              "Invalid time format. Please use HH:MM in 24-hour format (e.g., 14:30)",
            ephemeral: true,
          });
          return;
        }

        // Extract date and time components
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1; // JS months are 0-indexed
        const year = parseInt(dateMatch[3]);
        const hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2]);

        // Create Date object in CET
        const scheduledDate = new Date(
          Date.UTC(year, month, day, hour - 1, minute)
        ); // -1 hour to convert CET to UTC

        // Validate that the date is in the future
        const now = new Date();
        if (scheduledDate <= now) {
          await interaction.reply({
            content: "Scheduled time must be in the future",
            ephemeral: true,
          });
          return;
        }

        // Create unique ID for this scheduled message
        const msgId =
          Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        // Create the scheduled message object
        const scheduledMessage = {
          id: msgId,
          message: msgToSchedule, // Store raw message, will be formatted when sending
          channelId: targetChan.id,
          timestamp: scheduledDate.toISOString(),
          createdBy: interaction.user.id,
          createdAt: now.toISOString(),
        };

        // Add to scheduled messages
        if (!config.scheduledMessages) {
          config.scheduledMessages = [];
        }

        config.scheduledMessages.push(scheduledMessage);
        saveConfig();

        // Format date and time in CET for display
        const cetOptions = {
          timeZone: "Europe/Paris",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        };
        const formattedDate = scheduledDate.toLocaleString("en-US", cetOptions);

        await interaction.reply({
          content: `Message scheduled for ${formattedDate} CET in #${targetChan.name}\nMessage ID: \`${msgId}\`\nContent: "${msgToSchedule}"`,
          ephemeral: true,
        });
        break;

      case "listscheduled":
        if (
          !config.scheduledMessages ||
          config.scheduledMessages.length === 0
        ) {
          await interaction.reply({
            content: "There are no scheduled messages",
            ephemeral: true,
          });
          return;
        }

        let scheduledList = "**Scheduled Messages:**\n";

        for (const scheduledMsg of config.scheduledMessages) {
          const scheduledTime = new Date(scheduledMsg.timestamp);
          const cetOptions = {
            timeZone: "Europe/Paris",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          };
          const formattedDate = scheduledTime.toLocaleString(
            "en-US",
            cetOptions
          );

          const channel = client.channels.cache.get(scheduledMsg.channelId);
          const channelName = channel ? channel.name : "Unknown Channel";

          scheduledList += `**ID:** \`${scheduledMsg.id}\`\n`;
          scheduledList += `**When:** ${formattedDate} CET\n`;
          scheduledList += `**Channel:** #${channelName}\n`;
          scheduledList += `**Message:** ${scheduledMsg.message}\n\n`;
        }

        await interaction.reply({
          content: scheduledList,
          ephemeral: true,
        });
        break;

      case "cancelscheduled":
        const idToCancel = interaction.options.getString("id");

        if (
          !config.scheduledMessages ||
          config.scheduledMessages.length === 0
        ) {
          await interaction.reply({
            content: "There are no scheduled messages",
            ephemeral: true,
          });
          return;
        }

        const msgIndex = config.scheduledMessages.findIndex(
          (msg) => msg.id === idToCancel
        );

        if (msgIndex === -1) {
          await interaction.reply({
            content: `No scheduled message found with ID \`${idToCancel}\``,
            ephemeral: true,
          });
          return;
        }

        const canceledMsg = config.scheduledMessages.splice(msgIndex, 1)[0];
        saveConfig();

        await interaction.reply({
          content: `Canceled scheduled message:\n**ID:** \`${canceledMsg.id}\`\n**Message:** "${canceledMsg.message}"`,
          ephemeral: true,
        });
        break;

      case "guild":
        const guildName = interaction.options.getString("name");
        const filter = interaction.options.getString("filter") || "all";

        // IMMEDIATELY defer the reply to prevent timeout
        await interaction.deferReply();

        try {
          console.log(`Looking up guild: ${guildName}, filter: ${filter}`);

          // Format the API URL with the guild name
          const apiUrl = `https://armory.warmane.com/api/guild/${encodeURIComponent(
            guildName
          )}/Icecrown/summary`;

          // Make the API request with timeout
          const response = await axios.get(apiUrl, { timeout: 10000 });
          const data = response.data;

          if (!data || !data.name) {
            await interaction.editReply({
              content: `Guild "${guildName}" not found on Icecrown realm.`,
            });
            return;
          }

          // Filter members if needed
          let filteredRoster = data.roster || [];
          if (!filteredRoster || !Array.isArray(filteredRoster)) {
            console.error("Invalid roster data:", filteredRoster);
            filteredRoster = [];
          }

          if (filter === "online") {
            filteredRoster = filteredRoster.filter(
              (member) => member.online === true
            );

            if (filteredRoster.length === 0) {
              await interaction.editReply({
                content: `No online members found in guild "${data.name}" on Icecrown.`,
              });
              return;
            }
          }

          // Store the filtered roster in a temporary collection for pagination
          const guildData = {
            guildInfo: {
              name: data.name,
              realm: data.realm,
              faction: data.faction,
              membercount: data.membercount || filteredRoster.length,
              pvepoints: data.pvepoints,
              leader: data.leader || {
                name: "Unknown",
                level: "??",
                race: "Unknown",
                class: "Unknown",
              },
            },
            roster: filteredRoster,
            page: 1,
            filter: filter,
            userId: interaction.user.id,
          };

          // Initialize guild lookup cache if needed
          if (!client.guildLookupCache) {
            client.guildLookupCache = new Map();
          }

          const cacheKey = `${interaction.user.id}-${Date.now()}`;
          client.guildLookupCache.set(cacheKey, guildData);

          // Create and send the first page
          try {
            const embedResponse = createGuildEmbed(guildData, cacheKey);
            await interaction.editReply(embedResponse);
          } catch (embedError) {
            console.error("Error creating guild embed:", embedError);
            await interaction.editReply({
              content:
                "Error formatting guild data. The guild might be too large to display properly.",
            });
          }
        } catch (error) {
          console.error("Error fetching guild data:", error);
          await interaction.editReply({
            content: `Failed to fetch data for guild "${guildName}". The API might be down or the guild doesn't exist.`,
          });
        }
        break;

      case "armory":
        const characterName = interaction.options.getString("character");

        // IMMEDIATELY defer the reply to prevent timeout
        await interaction.deferReply();

        try {
          console.log(`Looking up character: ${characterName}`);

          // Format the API URL with the character name
          const apiUrl = `https://armory.warmane.com/api/character/${encodeURIComponent(
            characterName
          )}/Icecrown/summary`;

          // Make the API request with timeout
          const response = await axios.get(apiUrl, { timeout: 10000 });
          const data = response.data;

          if (!data || !data.name) {
            await interaction.editReply({
              content: `Character "${characterName}" not found on Icecrown realm.`,
            });
            return;
          }

          // Format the character data into a nice embed
          const characterEmbed = {
            color: data.faction === "Horde" ? 0xcc0000 : 0x0066cc, // Red for Horde, Blue for Alliance
            title: `${data.name} - Level ${data.level} ${data.race} ${data.class}`,
            url: `https://armory.warmane.com/character/${data.name}/Icecrown/summary`,
            thumbnail: {
              url: `https://armory.warmane.com/api/character/${data.name}/Icecrown/avatar`,
            },
            fields: [
              {
                name: "Basic Info",
                value: `**Faction:** ${data.faction}\n**Guild:** ${
                  data.guild || "None"
                }\n**Achievement Points:** ${
                  data.achievementpoints
                }\n**Honorable Kills:** ${data.honorablekills}`,
                inline: true,
              },
              {
                name: "Professions",
                value:
                  data.professions && data.professions.length > 0
                    ? data.professions
                        .map((p) => `${p.name} (${p.skill})`)
                        .join("\n")
                    : "None",
                inline: true,
              },
            ],
            footer: {
              text: `Online: ${data.online ? "Yes" : "No"}`,
            },
          };

          // Add equipment section if available
          if (data.equipment && data.equipment.length > 0) {
            // Get notable equipment (weapons, trinkets)
            const weapons = data.equipment.filter(
              (item) =>
                item.name.includes("sword") ||
                item.name.includes("axe") ||
                item.name.includes("mace") ||
                item.name.includes("staff") ||
                item.name.includes("bow") ||
                item.name.includes("gun") ||
                item.name.includes("dagger") ||
                item.name.includes("wand")
            );

            if (weapons.length > 0) {
              characterEmbed.fields.push({
                name: "Weapons",
                value:
                  weapons
                    .map((w) => w.name)
                    .join("\n")
                    .substring(0, 1020) || "None",
                inline: true,
              });
            }

            characterEmbed.fields.push({
              name: "Equipment",
              value: `[View Full Equipment](https://armory.warmane.com/character/${data.name}/Icecrown/summary)`,
              inline: true,
            });
          }

          // Add PVP section if available
          if (data.pvpteams && data.pvpteams.length > 0) {
            const pvpInfo = data.pvpteams
              .map((team) => `**${team.type}**: ${team.name} (${team.rating})`)
              .join("\n")
              .substring(0, 1020);

            characterEmbed.fields.push({
              name: "PVP Teams",
              value: pvpInfo || "None",
              inline: false,
            });
          }

          // Add talents section if available
          if (data.talents && data.talents.length > 0) {
            const talentInfo = data.talents
              .map(
                (spec, index) =>
                  `**Spec ${index + 1}**: ${spec.tree} (${spec.points.join(
                    "/"
                  )})`
              )
              .join("\n")
              .substring(0, 1020);

            characterEmbed.fields.push({
              name: "Talent Specs",
              value: talentInfo || "None",
              inline: false,
            });
          }

          // Send the formatted response
          await interaction.editReply({
            content: `Character information for **${data.name}** on Icecrown:`,
            embeds: [characterEmbed],
          });
        } catch (error) {
          console.error("Error fetching character data:", error);
          await interaction.editReply({
            content: `Failed to fetch data for "${characterName}". The API might be down or the character doesn't exist.`,
          });
        }
        break;

      case "clearinterval":
        // Check if there's an active interval
        if (
          config.activeMessageIndex === null ||
          config.activeMessageIndex === undefined
        ) {
          await interaction.reply({
            content: "There is no active scheduled message to clear.",
            ephemeral: true,
          });
          return;
        }

        // Get info about the message being cleared for feedback
        const messageBeingCleared = config.messages[config.activeMessageIndex];
        const intervalBeingCleared =
          config.activeMessageInterval / (60 * 60 * 1000); // Convert to hours

        // Clear the active message settings
        config.activeMessageIndex = null;
        config.activeMessageInterval = null;

        // Stop the timer
        stopMessageTimer();
        activeMessageIndex = null;

        // Save the changes
        saveConfig();

        await interaction.reply({
          content: `Cleared scheduled message: "${messageBeingCleared}" that was set to send every ${intervalBeingCleared} hours.`,
          ephemeral: true,
        });
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    await interaction
      .reply({
        content: "An error occurred while executing this command.",
        ephemeral: true,
      })
      .catch(console.error);
  }
});

// When a message is received
client.on("messageCreate", async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Check if the message author has configured reactions
  const userId = message.author.id;

  if (config.userReactions && config.userReactions[userId]) {
    try {
      const userReactions = config.userReactions[userId];
      console.log(
        `Attempting to add ${userReactions.length} reactions to message from ${
          message.author.username
        }: ${userReactions.join(", ")}`
      );

      // Add each configured reaction for this specific user
      for (const reaction of userReactions) {
        try {
          await message.react(reaction);
          console.log(`Successfully added reaction "${reaction}"`);
          // Add a longer delay between reactions to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (reactionError) {
          console.error(`Failed to add reaction "${reaction}":`, reactionError);
          // Continue with other reactions even if one fails
          continue;
        }
      }
    } catch (error) {
      console.error("Error in reaction process:", error);
    }
  }
});

// Add this function to check for scheduled messages
function checkScheduledMessages() {
  const now = new Date();

  // If no scheduled messages, return early
  if (!config.scheduledMessages || config.scheduledMessages.length === 0) {
    return;
  }

  // Check each scheduled message
  const remainingMessages = [];

  for (const scheduledMsg of config.scheduledMessages) {
    const scheduledTime = new Date(scheduledMsg.timestamp);

    // If it's time to send this message
    if (now >= scheduledTime) {
      // Try to send the message
      try {
        const channel = client.channels.cache.get(scheduledMsg.channelId);
        if (channel && channel.isTextBased()) {
          // Format the message before sending
          const formattedMessage = formatMessage(scheduledMsg.message);

          channel
            .send(formattedMessage)
            .then(() =>
              console.log(`Sent scheduled message: ${scheduledMsg.id}`)
            )
            .catch((err) =>
              console.error(
                `Failed to send scheduled message ${scheduledMsg.id}:`,
                err
              )
            );
        } else {
          console.error(
            `Channel not found or not text-based for scheduled message ${scheduledMsg.id}`
          );
        }
      } catch (error) {
        console.error(
          `Error sending scheduled message ${scheduledMsg.id}:`,
          error
        );
      }
    } else {
      // Keep this message for future sending
      remainingMessages.push(scheduledMsg);
    }
  }

  // Update the scheduled messages list
  config.scheduledMessages = remainingMessages;
  saveConfig();
}

// Update the createGuildEmbed function to handle large member lists
function createGuildEmbed(guildData, cacheKey) {
  const { guildInfo, roster, page, filter } = guildData;

  // Calculate pagination
  const membersPerPage = 10; // Further reduced to avoid any issues
  const startIndex = (page - 1) * membersPerPage;
  const endIndex = startIndex + membersPerPage;
  const currentPageMembers = roster.slice(startIndex, endIndex);
  const totalPages = Math.ceil(roster.length / membersPerPage);

  // Create a simpler guild embed to avoid Discord limits
  const guildEmbed = {
    color:
      guildInfo.faction === "Horde"
        ? 0xcc0000
        : guildInfo.faction === "Alliance"
        ? 0x0066cc
        : 0x808080,
    title: `${guildInfo.name} - ${guildInfo.realm}`,
    url: `https://armory.warmane.com/guild/${encodeURIComponent(
      guildInfo.name
    )}/Icecrown/summary`,
    description: `**Faction:** ${guildInfo.faction}\n**Total Members:** ${
      guildInfo.membercount
    }\n**Guild Leader:** ${
      guildInfo.leader?.name || "Unknown"
    }\n\n**Showing Page ${page}/${totalPages || 1}** (${
      filter === "online" ? "Online only" : "All members"
    })`,
    fields: [],
    footer: {
      text: `${roster.length} ${
        filter === "online" ? "online " : ""
      }members • Use the buttons below to navigate`,
    },
  };

  // Add member list in a more compact format
  if (currentPageMembers.length > 0) {
    // Create chunks of 5 members per field to stay within limits
    let memberChunks = [];
    for (let i = 0; i < currentPageMembers.length; i += 5) {
      memberChunks.push(currentPageMembers.slice(i, i + 5));
    }

    memberChunks.forEach((chunk, chunkIndex) => {
      let memberList = "";

      chunk.forEach((member) => {
        const onlineStatus = member.online ? "🟢" : "⚪";
        memberList += `${onlineStatus} **${member.name}** - ${member.level} ${member.race} ${member.class}\n`;
      });

      guildEmbed.fields.push({
        name: `Members ${startIndex + chunkIndex * 5 + 1}-${
          startIndex + chunkIndex * 5 + chunk.length
        }`,
        value: memberList,
      });
    });
  } else {
    guildEmbed.fields.push({
      name: "Members",
      value: "No members to display.",
    });
  }

  // Create pagination buttons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`guild_prev_${cacheKey}`)
      .setLabel("Previous Page")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`guild_next_${cacheKey}`)
      .setLabel("Next Page")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages),
    new ButtonBuilder()
      .setCustomId(`guild_toggle_${cacheKey}`)
      .setLabel(filter === "online" ? "Show All Members" : "Show Online Only")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [guildEmbed],
    components: [row],
  };
}

// Add this to handle button interactions
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [command, action, cacheKey] = interaction.customId.split("_");

  if (command === "guild") {
    // Get the cached guild data
    if (!client.guildLookupCache || !client.guildLookupCache.has(cacheKey)) {
      await interaction.reply({
        content:
          "This guild lookup has expired. Please use the /guild command again.",
        ephemeral: true,
      });
      return;
    }

    const guildData = client.guildLookupCache.get(cacheKey);

    // Verify that the user who clicked is the one who ran the command
    if (interaction.user.id !== guildData.userId) {
      await interaction.reply({
        content:
          "You can't interact with someone else's guild lookup. Use the /guild command yourself.",
        ephemeral: true,
      });
      return;
    }

    // Handle the different button actions
    if (action === "prev") {
      if (guildData.page > 1) {
        guildData.page--;
      }
    } else if (action === "next") {
      const maxPages = Math.ceil(guildData.roster.length / 20);
      if (guildData.page < maxPages) {
        guildData.page++;
      }
    } else if (action === "toggle") {
      // Toggle between all and online members
      try {
        // Need to refetch the data to toggle
        const apiUrl = `https://armory.warmane.com/api/guild/${encodeURIComponent(
          guildData.guildInfo.name
        )}/Icecrown/summary`;
        const response = await axios.get(apiUrl);
        const data = response.data;

        if (guildData.filter === "all") {
          // Switch to online only
          guildData.filter = "online";
          guildData.roster = data.roster.filter(
            (member) => member.online === true
          );
        } else {
          // Switch to all members
          guildData.filter = "all";
          guildData.roster = data.roster;
        }

        // Reset to page 1 when toggling
        guildData.page = 1;
      } catch (error) {
        console.error("Error refetching guild data for toggle:", error);
        await interaction.reply({
          content: "Failed to update the guild roster. Please try again.",
          ephemeral: true,
        });
        return;
      }
    }

    // Update the cache
    client.guildLookupCache.set(cacheKey, guildData);

    // Update the message
    const updatedResponse = createGuildEmbed(guildData, cacheKey);
    await interaction.update(updatedResponse);
  }
});

// Add this to your client.once("ready") to clean up expired cache entries
setInterval(() => {
  if (client.guildLookupCache) {
    const now = Date.now();
    const expiryTime = 10 * 60 * 1000; // 10 minutes

    client.guildLookupCache.forEach((value, key) => {
      const [userId, timestamp] = key.split("-");
      if (now - Number(timestamp) > expiryTime) {
        client.guildLookupCache.delete(key);
      }
    });
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// When the bot is ready
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register commands globally
  const rest = new REST({ version: "10" }).setToken(token);

  const commandData = [
    // ... existing commands ...

    // Make sure this is included in the global commands too
    {
      name: "clearinterval",
      description: "Clear the current scheduled message interval",
    },

    // ... existing commands ...
  ];

  try {
    console.log("Started refreshing global application commands");

    // Register commands globally
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: commandData,
    });

    console.log(
      "Successfully registered global commands (may take up to an hour to appear)"
    );

    // Get all guilds the bot is in and register commands to each one
    // This is faster for testing as guild commands update instantly
    client.guilds.cache.forEach((guild) => {
      registerGuildCommands(guild.id);
    });

    // ... existing code ...
  } catch (error) {
    console.error("Error registering global commands:", error);
  }
});

// Log in to Discord with your client's token
client.login(token);
