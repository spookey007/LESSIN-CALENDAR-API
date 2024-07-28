const express = require('express');
const connectDB = require('./db');
const auth = require('./routes/auth');
const events = require('./routes/events');

const app = express();

connectDB();
app.use(express.json());

app.use('/auth', auth);
app.use('/events', events);

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
