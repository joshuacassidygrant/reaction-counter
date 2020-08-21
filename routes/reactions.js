const express = require('express');
const router = express.Router();
const e = require('express');
const { json } = require('express');
const jsonWriter = require('../services/jsonWriter');
const getReactionsOfEmojiByPostAuthor = require('../services/reactionCounter');


router.get('/:emoji', function(req, res, next) {
  res.status(200).send("Received; JSON file will be generated in the app.");
  getReactionsOfEmojiByPostAuthor(req.params.emoji)
  .then((val) => {
    // TODO: this is clearly not the best way to get information, but the file can be huge and take forever, so it was difficult to respond to a GET request with it.
    jsonWriter.writeFile("count-" + req.params.emoji, val); 
    res.status(200).send(val);
  })
  .catch((err) => {
    console.error(err);
  })
});

module.exports = router;