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
    res.status(200).send(val);
  })
  .catch((err) => {
    console.error(err);
  })
});

function getReactionsOfEmojiByPostAuthor(emoji) {
  return fetchHistory()
  .then((messages) => {
    authorToEmojiCount = {};

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
    return authorToEmojiCount;
  })
  .then((authorToEmojiCount) => {
    // replaces ids with names
    return getListWithNames(authorToEmojiCount);
  })
  .then((scoreList) => {
    // sorts reactions descending
    return scoreList.sort((a, b) =>  b.score - a.score);
  })

}

async function getListWithNames(userIdToReactCount) {
  promiseList = [];

  // creates a promise array for all user requests
  for (let userId of Object.keys(userIdToReactCount)) {
    promiseList.push(bolt.client.users.info({
      token: process.env.SLACK_BOT_TOKEN,
      user: userId
    }));
  }

  // once all promises are resolved, constructs a list of {name, score} objects
  return Promise.all(promiseList)
  .then ((userList) => {
    scoreList = [];

    for (userRes of userList) {
      scoreList.push({name: userRes.user.profile.real_name, score: userIdToReactCount[userRes.user.id]});
    }
    
    // build score list
    return scoreList;
  })
  .catch ((error) => {
    console.error(error);
  })

}

// flattens all channel history into a single array of messages
async function fetchHistory(id) {
  return bolt.client.conversations.list({token: process.env.SLACK_BOT_TOKEN})
  .then(async (channelResults) => {
    let promiseList = [];

    for (let channel of channelResults.channels) {
      promiseList.push(bolt.client.conversations.history({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channel.id
      }));
    }

    return Promise.all(promiseList);
  })
  .then((histories) => {
    messages = [];
    for (let history of histories) {
      messages.push(...history.messages)
    }
    return messages;
  })
  .catch ((error) => {
    console.error(error);
  });
}

module.exports = router;