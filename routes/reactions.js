var express = require('express');
var router = express.Router();

/* GET listing. */
router.get('/:emoji', function(req, res, next) {
  res.send(req.params.emoji);
});

module.exports = router;
