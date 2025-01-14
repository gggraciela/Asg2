const express = require('express');
require("./utils.js");
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000; // if PORT is not defined in .env, use port 3000

// for encrypting the password
const bcrypt = require('bcrypt');
const saltRounds = 12;

// for session storage in mongoDB ( sessions for logged in verified users )
const session = require('express-session');
const MongoStore = require('connect-mongo');
const expireTime = 1000 * 60 * 60; // expires after 1 hour in milliseconds ( 1000ms * 60s * 60m = 1 hour)

// to store users in mongoDB
const Joi = require("joi");

// secret information section
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_database = process.env.MONGODB_DATABASE; // check on MongoDB Atlas https://cloud.mongodb.com/ > Deployment > Database > Cluster0 > Collections
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET; // generated by https://guidgenerator.com/ 
const node_session_secret = process.env.NODE_SESSION_SECRET; // generated by https://guidgenerator.com/
// end secret section
 

var { database } = include('databaseConnection');

const userCollection = database.db(mongodb_database).collection('users');
 

app.use(express.urlencoded({ extended: false })); // to parse the body of the POST request

var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`, // connection string to MongoDB Atlas
  crypto: {
    secret: mongodb_session_secret
  }
});

app.use(session({
  secret: node_session_secret,
  store: mongoStore, //default is memory store
  saveUninitialized: false,
  resave: true
}));



// users and passwords ( in memory 'database' ), but this one disappears when the server is restarted ( the page is refreshed )
// var users = [];

let pageHits = 0; // Variable to store the number of times the page has been visited

app.get('/', (req, res) => {
  if (req.session.pageHits) { // Check if the session exists
    req.session.pageHits++; // Increment the page hit counter
  }
  else { // If the session does not exist
    req.session.pageHits = 1; // "create session" and Set the page hit counter to 1
  }

  // before using session, we were just using a simple example :
  // pageHits++;
  // res.send('Hello! You\'ve visited this page ' + pageHits + ' time(s)');

  res.send('Hello! You\'ve visited this page ' + req.session.pageHits + ' time(s)');
});


// localhost:3000/about?color=blue
// localhost:3000/about?color=white&bg=black
app.get('/about', (req, res) => {
  var color = req.query.color;
  var bg = req.query.bg;
  res.send("<h1 style='color:" + color + ";background-color:" + bg + "'>About Us</h1>");
});

// localhost:3000/cat/1
// colon before id means it is a variable and it's passed as a parameter to var cat = req.params.id;
app.get('/cat/:id', (req, res) => {
  var cat = req.params.id;

  if (cat == 1) {
    res.send("Fluffy: <img src='/fluffy.gif' style='width:250px;'>" + "<br><a href='/'>Back</a) ");
  }
  else if (cat == 2) {
    res.send("This is cat 2");
  }
  else {
    res.send("Invalid cat id: " + cat);
  }
});

app.use(express.static(__dirname + "/public")); // so that we can host the images from the media folder


app.get('/contact', (req, res) => {
  var missingEmail = req.query.missing;
  var html = `
    email address:
    <form action='/submitEmail' method='post'>
      <input name='email' type='text' placeholder='email'>
      <button>Submit</button>
    </form>
  `;

  if (missingEmail) {
    html += "<br>Email is required";
  }

  res.send(html);
});

app.post('/submitEmail', (req, res) => {
  var email = req.body.email; // for this to work, we need to parse the body with express.urlencoded on line 18
  if (!email) {
    res.redirect('/contact?missing=1');
  }
  else {
    res.send('Thank you for subscribing with your email: ' + email);
  }
});


app.get('/createUser', (req, res) => {
  var html = `
  create user
    <form action='/submitUser' method='post'>
      <input name='username' type='text' placeholder='username'>
      <input name='password' type='password' placeholder='password'>
      <button>Submit</button>
    </form>
  `;
  res.send(html);
});

// submitUser before joi
// app.post('/submitUser', (req, res) => {
//   var username = req.body.username;
//   var password = req.body.password;

//   // add the user to the users array, with the password in plain text ( before or without encryption )
//   // users.push({ username: username, password: password }); 

//   var hashedPassword = bcrypt.hashSync(password, saltRounds); // hash or encrypt the password
//   users.push({ username: username, password: hashedPassword }); // add the user to the users array

//   console.log(users);

//   var usershtml = "";
//   for (var i = 0; i < users.length; i++) {
//     usershtml += "<li>" + users[i].username + ": " + users[i].password + "</li>";
//   }

//   var html = "<ul>" + usershtml + "</ul>";
//   res.send(html);
// });

// submitUser after joi
app.post('/submitUser', async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;

  const schema = Joi.object(
    {
      username: Joi.string().alphanum().max(20).required(),
      password: Joi.string().max(20).required()
    });

  const validationResult = schema.validate({ username, password });
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/createUser");
    return;
  }

  var hashedPassword = await bcrypt.hash(password, saltRounds);

  await userCollection.insertOne({ username: username, password: hashedPassword });
  console.log("Inserted user");

  var html = "successfully created user";

  res.send(html);
});


app.get('/login', (req, res) => {
  var html = `
  log in
    <form action='/loggingin' method='post'>
      <input name='username' type='text' placeholder='username'>
      <input name='password' type='password' placeholder='password'>
      <button>Submit</button>
    </form>
  `;
  res.send(html);
});


// before joi
// app.post('/loggingin', (req, res) => {
//   var username = req.body.username;
//   var password = req.body.password;

//   var usershtml = "";
//   for (var i = 0; i < users.length; i++) {
//     if (users[i].username == username) {
//       if (bcrypt.compareSync(password, users[i].password)) {
//         req.session.authenticated = true; 
//         req.session.username = username;
//         req,session.Cookie.maxAge = expireTime; // set the session to expire according to the expireTime variable
//         res.redirect('/loggedin');
//         return;
//       }
//     }
//   }

//   // if the user is not found or the password is incorrect, redirect to the login page
//   res.redirect('/login');
// });


// after joi
app.post('/loggingin', async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;

  const schema = Joi.string().max(20).required();
  const validationResult = schema.validate(username);
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/login");
    return;
  }
  
  const result = await userCollection.find({ username: username }).project({ username: 1, password: 1, _id: 1 }).toArray();

  console.log(result);
  if (result.length != 1) {
    console.log("user not found");
    res.redirect("/login");
    return;
  }

  if (await bcrypt.compare(password, result[0].password)) {
    console.log("correct password");
    req.session.authenticated = true;
    req.session.username = username;
    req.session.cookie.maxAge = expireTime;

    res.redirect('/loggedIn');
    return;
  }
  else {
    console.log("incorrect password");
    res.redirect("/login");
    return;
  }
});


app.get('/loggedin', (req, res) => {
  if (!req.session.authenticated) {
    res.redirect('/login');
  }
  var html = `
  You are logged in!
  `;
  res.send(html);
});

app.get('/logout', (req,res) => {
	req.session.destroy(); // deletes the cookie, so it automatically logs out the user
    var html = `
    You are logged out.
    `;
    res.send(html);
});

app.get('*', (req, res) => {
  res.status(404);
  res.send('Page not found - 404');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});