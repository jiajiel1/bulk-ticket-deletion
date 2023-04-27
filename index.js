const fs = require('fs');
const parse = require('csv-parse');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const request = require('request');
var async = require('async');

require('dotenv').config();

const subdomain = process.env.SUBDOMAIN;
const username = process.env.USERNAME + '/token';
const password = process.env.PASSWORD;
const csvFile = process.env.CSV_FILE;

// Zendesk API endpoint for deleting tickets
const deleteEndpoint = 'https://' + subdomain + '.zendesk.com/api/v2/tickets/destroy_many.json';

// Maximum number of tickets to delete in each iteration
const batchSize = 100;

// Read the CSV file
fs.readFile(csvFile, function (err, fileData) {
  if (err) {
    console.error('Error reading CSV file:', err);
    return;
  }

  // Parse the CSV file
  parse(fileData, { columns: true }, function (err, rows) {
    if (err) {
      console.error('Error parsing CSV file:', err);
      return;
    }

    // Loop through the rows and delete tickets in batches
    let start = 0;
    let end = Math.min(batchSize, rows.length);
    let errored = false;

    async.until(function(cb) {
      cb(null, !(start < rows.length));
    }, function(next) {
      const ticketIds = [];
      for (let i = start; i < end; i++) {
        const row = rows[i];
        let ticketId = parseInt(row.ID);
        if (!isNaN(ticketId)) {
          ticketIds.push(ticketId);
        } else if(!isNaN(row[0])) {
          ticketIds.push(row[0]);
        }
      }

      if (ticketIds.length > 0) {
        // Build the request options
        const options = {
          url: deleteEndpoint,
          method: 'DELETE',
          auth: {
            user: username,
            pass: password
          },
          json: {
            ids: ticketIds.join(',')
          }
        };

        console.log('Making request to delete', ticketIds);

        // Send the request to delete the tickets
        request(options, function (error, response, body) {
          if (!error && response.statusCode === 200) {
            console.log('Tickets deleted successfully:', body);

            // Remove the deleted tickets from the source CSV
            rows = rows.filter(function(row, row_idx) {
              return !ticketIds.includes(parseInt(row.ID));
            });
            // rows = rows.filter(row => !row.ID == 'ID'); // Leave header row in place

            const csvWriter = createCsvWriter({
              path: csvFile,
              header: Object.keys(rows[0]).map(column => ({ id: column, title: column })),
              alwaysQuote: true
            });

            csvWriter.writeRecords(rows)
              .then(() => {
                console.log('CSV file updated successfully');

                start = end;
                end = Math.min(start + batchSize, rows.length);

                next(null);
              })
              .catch(err => {
                console.error(err);
              });
          } else {
            console.error('Error deleting tickets:', error || body);
            errored = true;
          }
        });
      }
    }, function() {
      console.log('iteration completed');
    });
  });
});
