const fs = require('fs');
const parse = require('csv-parse');
const request = require('request');
const async = require('async');

require('dotenv').config();

const subdomain = process.env.SUBDOMAIN;
const username = process.env.USERNAME + '/token';
const password = process.env.PASSWORD;
const csvFile = process.env.CSV_FILE;

// Zendesk API endpoint for deleting tickets
const deleteEndpoint = 'https://' + subdomain + '.zendesk-staging.com/api/v2/tickets/destroy_many.json';

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

    // Extract min and max ID from the rows
    const minId = parseInt(rows[0].ID);
    const maxId = parseInt(rows[1].ID);

    if (isNaN(minId) || isNaN(maxId)) {
      console.error('Invalid ID range in CSV file');
      return;
    }

    let currentId = minId;

    async.whilst(
      function test(cb) {
        console.log('Checking loop condition:', currentId <= maxId, 'Current ID:', currentId, 'Max ID:', maxId);
        cb(null, currentId <= maxId);
      },
      function iter(next) {
        console.log('Inside the loop: currentId =', currentId);
        const ticketIds = [];
        
        // Generate ticket IDs for the current batch
        for (let i = 0; i < batchSize && currentId <= maxId; i++, currentId++) {
          ticketIds.push(currentId);
        }

        console.log('Generated ticket IDs for deletion:', ticketIds);

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
            console.log('Response status code:', response ? response.statusCode : 'No response');
            if (!error && response && response.statusCode === 200) {
              console.log('Tickets deleted successfully:', body);
              // Wait for 1 second before starting the next iteration
              setTimeout(() => {
                next(null); // Proceed to the next batch
              }, 2000); 
            } else {
              console.error('Error deleting tickets:', error || body);
              next(error || new Error('Failed to delete tickets.')); // Stop on error
            }
          });
        } else {
          console.log('No ticket IDs to delete, proceeding to next iteration.');
          // Wait for 1 second before starting the next iteration
          setTimeout(() => {
            next(); // No ticket IDs to delete, proceed to next iteration
          }, 1000); // 1000 milliseconds = 1 second
        }
      },
      function (err) {
        if (err) {
          console.error('Error during deletion process:', err);
        } else {
          console.log('All iterations completed');
        }
      }
    );
  });
});