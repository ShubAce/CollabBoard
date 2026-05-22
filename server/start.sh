#!/bin/sh

echo "Starting email worker..."
node src/queues/workers/emailWorker.js &

echo "Starting activity worker..."
node src/queues/workers/activityWorker.js &

echo "Starting web server..."
exec node server.js