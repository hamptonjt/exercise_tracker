const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const shortid = require('shortid')

const cors = require("cors");

const mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost/exercise-track", {useNewUrlParser: true, useUnifiedTopology: true});

var UserSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: shortid.generate
  },
  username: String,
  log: [
    {
      description: String,
      duration: Number,
      exerciseDate: {type: Date, default: Date.now()}
    }
  ]
})

var User = mongoose.model('User', UserSchema)
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// Not found middleware
// app.use((req, res, next) => {
//   return next({ status: 404, message: "not found" });
// });

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

app.post('/api/exercise/new-user', async function(req, res) {
  // First check to see if the username exists:
  const username = req.body.username
  var user = await User.find({username: username})
  if (user._id) {
    res.send(`username already taken: ${username}`)
  } else {
    // Now create a new record
    user = await User.create({
      _id: shortid.generate(),
      username: username
    })
    res.send({
      _id: user._id,
      username: username
    })
  }
})

app.post('/api/exercise/add', async function(req, res) {
  // create a new 
  const userId = req.body.userId
  const description = req.body.description
  const duration = req.body.duration
  var date

  if (!req.body.date) {
    date = Date.now()
  } else {
    date = req.body.date
  }
  
  var dateStr = new Date(date).toUTCString()
  let user = await User.findById(userId)
  if (user) {
    user.log.push({description, duration, date})
    user.save()
    res.send({
      _id: user._id, 
      username: user.username,
      description: description,
      duration: duration,
      date: dateStr
    })
  }
})

app.get('/api/exercise/users', async function(req, res) {
  let users = await User.find({}).select('_id username')
  res.send(users)
})

app.get('/api/exercise/log', async function(req, res) {
  // pull query params off the URL
  const userId = req.query.userId
  const fromDate = req.query.from
  const toDate = req.query.to
  const limit = req.query.limit

  var user = await User.findById(userId).sort('-exerciseDate')
  if (user._id) {
    let userVal = {
      _id: user._id,
      username: user.username,
    }
    let logs = user.log.filter((log) => {
      if (fromDate) {
        let fd = new Date(fromDate)
        userVal.from = fd.toUTCString()
        if (toDate) {
          let td = new Date(toDate)
          userVal.to = td.toUTCString()
          return log.exerciseDate >= fd && log.exerciseDate <= td
        }
        return log.exerciseDate >= fd
      } else if (toDate) {
        let td = new Date(toDate)
        userVal.to = td.toUTCString()
        return log.exerciseDate <= td
      }
      return true
    })
    if (limit) {
      logs = logs.slice(0, limit)
    }
    userVal.log = logs
    userVal.count = logs.length

    res.send(userVal)
  } else {
    res.send('unknown userId')
  }
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
