#!/bin/bash

# Run the extraction script with o3-pro for all papers
# This script runs in the background to avoid timeout issues

echo "Starting extraction of all papers with o3-pro..."
echo "Output will be saved to extraction.log"
echo "You can monitor progress with: tail -f extraction.log"

nohup npm run extract -- --papers example-papers.csv --use-responses-api > extraction.log 2>&1 &

echo "Process started with PID: $!"
echo "To check progress: tail -f extraction.log"
echo "To stop: kill $!"