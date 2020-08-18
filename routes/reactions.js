const express = require('express');
const router = express.Router();
const {App} = require('@slack/bolt'); 
const e = require('express');

const bolt = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
})

router.get('/:emoji', function(req, res, next) {
  getReactionsOfEmojiByPostAuthor(req.params.emoji)
  .then((val) => {
    res.send(val);
  })
});

async function getReactionsOfEmojiByPostAuthor(emoji) {
  authorToEmojiCount = {};
  
  let messages = await fetchHistory();
  for (let message of messages) {
    
    // check if message has any reactions
    if (!("reactions" in message)) continue;

    // find index of given emoji
    let emojiIndex = message.reactions.findIndex(reaction => reaction.name == emoji);
    if (emojiIndex == -1) continue;

    // attribute reactions to post author
    if (!(message.user in authorToEmojiCount)) {
      authorToEmojiCount[message.user] = 0;
    }
    authorToEmojiCount[message.user] += message.reactions[emojiIndex].count;

  }

  let scoreList = await getListWithNames(authorToEmojiCount);
  scoreList = scoreList.sort((a, b) =>  b.score - a.score);
  return scoreList;
}


async function getListWithNames(userIdToReactCount) {
  scoreList = [];

  for (let userId of Object.keys(userIdToReactCount)) {
    let userRes = await bolt.client.users.info({
      token: process.env.SLACK_BOT_TOKEN,
      user: userId
    })
    scoreList.push({name: userRes.user.name, score: userIdToReactCount[userId]});
  }

  return scoreList;
}

// Fetch conversation history using ID from last example
async function fetchHistory(id) {
  
  try {

    const channelResults = await bolt.client.conversations.list({token: process.env.SLACK_BOT_TOKEN});
    const messageHistory = [];

    for (let channel of channelResults.channels) {
      const history = await bolt.client.conversations.history({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channel.id
      })
      for (let message of messageHistory) {
        message.channel = channel.id;
      }
      messageHistory.push(...history.messages);
    }

    return messageHistory;

  }
  catch (error) {
    console.error(error);
  }
}

module.exports = router;