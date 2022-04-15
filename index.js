'use strict';

require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client({ intents: ['GUILDS', 'GUILD_MESSAGES'] });
const axios = require('axios');
const schedule = require('node-schedule');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const TOKEN = process.env.TOKEN;
client.login(TOKEN);

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // If I don't set a delay with startTime, the task would not run for the first week.
  const startTime = new Date(Date.now() + 5000);
  schedule.scheduleJob(
    {
      start: startTime,
      dayOfWeek: startTime.getDay(),
      hour: startTime.getHours(),
      minute: startTime.getMinutes(),
      second: startTime.getSeconds(),
    },
    async () => {
      const games = await getKingsGamesThisWeek(new Date());
      games.forEach((gameInfo) => {
        // Only set up reminders for games that haven't already started
        if (gameInfo.period == 0) {
          // Although game date (`gameInfo.date) looks like UTC date, it is not actually the correct UTC-based date for the game.
          // It really shows the date of the game based on America/New_York timezone, thus I can just extract the date portion without having to consider the UTC & America/New_York time difference.
          // The time portion of the returned date is also not correct, so I just remove it and use the time from `gameInfo.status` (which is given in America/New_York timezone)

          // date of the game in 'YYYY-MM-DD h:mm A' format, America/New_York timezone. (e.g 2022-01-26 7:30 PM)
          const gameDateString =
            gameInfo.date.split('T')[0] + ' ' + gameInfo.status.replace(' ET', '');

          const gameDateLocalTimeZone = dayjs
            .tz(gameDateString, 'YYYY-MM-DD h:mm A', 'America/New_York')
            .local();

          const reminderDate = gameDateLocalTimeZone.subtract(1, 'hour');
          schedule.scheduleJob(
            {
              year: reminderDate.year(),
              month: reminderDate.month(),
              date: reminderDate.date(),
              hour: reminderDate.hour(),
              minute: reminderDate.minute(),
            },
            () => {
              const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
              let reminderMsg = '';
              if (gameInfo.visitor_team.name === 'Kings') {
                reminderMsg = `<@&935115932852977674> vs. **${gameInfo.home_team.name}**`;
              } else {
                reminderMsg = `**${gameInfo.visitor_team.name}** vs. <@&935115932852977674>`;
              }
              reminderMsg += `\n\`The ${gameInfo.visitor_team.name} vs. ${
                gameInfo.home_team.name
              } game will start at ${gameDateLocalTimeZone.format('h:mm A')}!\``;
              channel.send(reminderMsg);
            }
          );

          /*
          const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
          let msg = '';
          if (gameInfo.visitor_team.name === 'Kings') {
            msg = `<@&935115932852977674> vs. **${gameInfo.home_team.name}**`;
          } else {
            msg = `**${gameInfo.visitor_team.name}** vs. <@&935115932852977674>`;
          }
          msg += `\n\`The ${gameInfo.visitor_team.name} vs. ${
            gameInfo.home_team.name
          } game will start at ${gameDateLocalTimeZone.format('h:mm A')}!\``;
          channel.send(msg);
          */
        }
      });
    }
  );
});

async function getKingsGamesThisWeek(weekStart) {
  let weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const KINGS_ID = 26;
  const res = await axios.get(
    `https://www.balldontlie.io/api/v1/games?` +
      `team_ids[]=${KINGS_ID}` +
      `&start_date=${weekStart.toLocaleDateString('en-CA')}` +
      `&end_date=${weekEnd.toLocaleDateString('en-CA')}`
  );
  const games = res.data.data;
  return games;
}
