const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const ExcelJS = require('exceljs');
const router = express.Router();
const Event = require('../models/event');
const { protect } = require('../middleware/auth');
// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Add an event
router.post('/', protect, async (req, res) => {
  const { title, description, start, end, allDay, organizer, created_by, location, attendees, categories, priority, reminderEnabled, reminderDate } = req.body;

  try {
    const event = new Event({ title, description, start, end, allDay, organizer, created_by, location, attendees, categories, priority, reminderEnabled, reminderDate });
    await event.save();
    res.status(201).json(event);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server error' });
  }
});



// Update an event
router.put('/:id', protect, async (req, res) => {
  const { title, description, start, end, allDay, organizer, created_by, location, attendees, categories, priority, reminderEnabled, reminderDate } = req.body;

  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { title, description, start, end, allDay, organizer, created_by, location, attendees, categories, priority, reminderEnabled, reminderDate },
      { new: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete an event
router.delete('/:id', protect, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ msg: 'Event deleted' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel an event
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Optional: You could add logic to update the event's status to 'canceled' if needed
    // For now, we simply mark the event as canceled
    event.cancelled = true; // Ensure you add a 'cancelled' field to the schema if you use this

    await event.save();
    res.json({ msg: 'Event canceled', event });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search events based on date range and organizer
router.post('/search', protect, async (req, res) => {
  const { startDate, endDate, organizer, priority, reminderEnabled } = req.body;

  let query = {};
  if (startDate && endDate) {
    query.start = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  if (organizer) {
    query.organizer = organizer;
  }
  if (priority) {
    query.priority = priority;
  }
  if (reminderEnabled !== undefined) {
    query.reminderEnabled = reminderEnabled;
  }

  try {
    const events = await Event.find(query);
    res.json(events);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server error' });
  }
});


// Function to convert date and time to JavaScript Date object
const parseDateTime = (date, time) => {
  const [month, day, year] = date.split('/');
  const formattedDate = `${year}-${month}-${day}`;
  const formattedTime = time.toLowerCase().includes('am') || time.toLowerCase().includes('pm')
    ? new Date(`${formattedDate} ${time}`).toISOString()
    : `${formattedDate}T${time}`;
  return new Date(formattedTime);
};

// Function to normalize priority values
const normalizePriority = (priority) => {
  const normalized = priority.toLowerCase();
  if (['low', 'medium', 'high'].includes(normalized)) {
    return normalized;
  }
  return 'low'; // Default to 'low' if not valid
};

// Handle CSV file upload
router.post('/upload-csv', upload.single('file'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const extname = path.extname(file.originalname).toLowerCase();

  if (extname !== '.csv') {
    fs.unlinkSync(file.path); // Delete the file if it's not a CSV
    return res.status(400).json({ error: 'Unsupported file type' });
  }

  try {
    const events = [];
    fs.createReadStream(file.path)
      .pipe(csvParser())
      .on('data', (rawRow) => {
        // Clean up the keys
        const row = {};
        for (let key in rawRow) {
          const cleanKey = key.trim().replace(/^"|"$/g, '');
          row[cleanKey] = rawRow[key].trim();
        }

        try {
          const startDateTime = parseDateTime(row['Start Date'], row['Start Time']);
          const endDateTime = parseDateTime(row['End Date'], row['End Time']);
          const reminderDateTime = row['Reminder on/off'].toLowerCase() === 'true'
            ? parseDateTime(row['Reminder Date'], row['Reminder Time'])
            : null;

          events.push({
            title: row['Subject'] || '',
            start: startDateTime,
            end: endDateTime,
            allDay: row['All day event'].toLowerCase() === 'true',
            reminderEnabled: row['Reminder on/off'].toLowerCase() === 'true',
            reminderDate: reminderDateTime,
            organizer: row['Meeting Organizer'] || 'system',
            attendees: row['Required Attendees'] ? row['Required Attendees'].split(';') : [],
            categories: row['Categories'] ? row['Categories'].split(';') : [],
            description: row['Description'],
            location: row['Location'],
            priority: normalizePriority(row['Priority']),
            created_by: row['Created By'] || 'system', // Default to 'system' if not provided
          });
        } catch (error) {
          console.error('Error parsing row:', row, error.message);
        }
      })
      .on('end', async () => {
        try {
          await Event.insertMany(events);
          fs.unlinkSync(file.path); // Delete the file after processing
          res.status(200).json({ message: 'CSV file processed and events saved' });
        } catch (error) {
          fs.unlinkSync(file.path); // Delete the file on error
          console.error(error.message);
          res.status(500).json({ error: 'Server error' });
        }
      });
  } catch (error) {
    fs.unlinkSync(file.path); // Delete the file on error
    console.error(error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
