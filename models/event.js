const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: false
  },
  description: {
    type: String
  },
  start: {
    type: Date,
    required: true
  },
  end: {
    type: Date,
    required: true
  },
  allDay: {
    type: Boolean,
    default: false
  },
  organizer: {
    type: String,
    required: false
  },
  created_by: {
    type: String,
    required: true
  },
  location: {
    type: String
  },
  attendees: [String],
  categories: [String],
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  reminderEnabled: {
    type: Boolean,
    default: false // Default is false if not provided
  },
  reminderDate: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Event', EventSchema);
