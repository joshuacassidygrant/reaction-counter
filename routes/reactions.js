const express = require('express');
const router = express.Router();
const {App} = require('@slack/bolt'); 
const e = require('express');
const { json } = require('express');
const jsonWriter = require('../services/jsonWriter');

const bolt = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const MESSAGE_RESULTS_PER_PAGE = 200; // Slack hard limits history to 1000 messages per call, recommends 200
const REQUEST_DELAY_MS = 1000; // API limit is 50 calls per minute; we want to stay around this.

router.get('/:emoji', function(req, res, next) {
  //res.status(200).send("Received");
  getReactionsOfEmojiByPostAuthor(req.params.emoji)
  .then((val) => {
    jsonWriter.writeFile("count-" + req.params.emoji, val);
    res.status(200).send(val);
  })
  .catch((err) => {
    console.error(err);
  })
});

function getReactionsOfEmojiByPostAuthor(emoji) {
  return fetchHistory()
  .then((messages) => {
    console.log("History fetched, attributing reactions");
    jsonWriter.writeFile("messageDump", messages);
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
    console.log(`Found ${Object.keys(authorToEmojiCount).length} users with reactions, finding names`)
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
  let mainMessageList = []; // only top-level messages
  let completeMessageList = []; // includes replies
  return bolt.client.conversations.list({token: process.env.SLACK_BOT_TOKEN})
  .then(async (channelResults) => {
    let promiseList = [];

    for (let i = 0; i < channelResults.channels.length; i++) {
      let channel = channelResults.channels[i];
      promiseList.push(fetchPageRecursive(channel.id, null, mainMessageList, i));
    }

    return Promise.all(promiseList);
  })
  .then(() => {
    let replyPromises = [];
    let countNoReplies = 0;

    // Get replies
    for (let i = 0; i < mainMessageList.length; i++) {
      let message = mainMessageList[i];
      // as above, but we are now going to fetch the replies of every item and place them in completeMessageList
      if (message.reply_count > 0) {
        replyPromises.push(fetchRepliesRecursive(message.channel_id, message.ts, null, completeMessageList, i));
        countNoReplies++;
      } else {
        // if no replies, we can just put the message itself in completeMessageList
        completeMessageList.push(message);
      }
    }

    console.log(`Found ${countNoReplies} messages with no replies, adding them immediately; waiting on reply data from ${mainMessageList.length - countNoReplies} messages`);

    return Promise.all(replyPromises);
  })
  .then(() => {
    // Complete messageList is finished and ready for processing!
    return completeMessageList;
  })
  .catch ((err) => {
    console.error(err);
  });
}

function fetchPageRecursive(channel_id, next, messageArray, index) {
  return new Promise(resolve => setTimeout(resolve, index * REQUEST_DELAY_MS))
  .then(() => { 
  return bolt.client.conversations.history({
    token: process.env.SLACK_BOT_TOKEN,
    channel: channel_id,
    cursor: next,
    limit: MESSAGE_RESULTS_PER_PAGE
  })})
  .then((results) => {
    // messages should retain their channel's id for later lookup
    let messages = results.messages.map((message) => ({
      ...message,
      channel_id
    })); 

    messageArray.push(...messages);
    console.log(`Found ${messageArray.length} main-thread messages`);
    if (results.response_metadata.next_cursor) {
      // If there are more than MESSAGE_RESULTS_PER_PAGE, we can page using this
      return fetchPageRecursive(channel_id, results.response_metadata.next_cursor, messageArray);
    } else {
      return null;
    }
  })
  .catch ((err) => {
    console.log(err);
  })
}

function fetchRepliesRecursive(channel_id, timestamp, next, messageArray, index) {
  return new Promise(resolve => setTimeout(resolve, index * REQUEST_DELAY_MS))
  .then(() => { 
  return bolt.client.conversations.replies({
    token: process.env.SLACK_BOT_TOKEN,
    channel: channel_id,
    cursor: next,
    ts: timestamp,
    limit: MESSAGE_RESULTS_PER_PAGE
  })})
  .then((results) => {
    messageArray.push(...results.messages);
    console.log(`Found ${messageArray.length} total messages`);
    if (results.response_metadata.next_cursor) {
      // If there are more than MESSAGE_RESULTS_PER_PAGE, we can page using this
      return fetchRepliesRecursive(channel_id, timestamp, results.response_metadata.next_cursor, messageArray);
    } else {
      return null;
    }
  })
  .catch ((err) => {
    console.log(err);
  })
}

module.exports = router;