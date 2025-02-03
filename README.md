Delete a range of tickets starting from min and end at max. 

Min and Max value are specify via csv files. like his format 
```
ID
66010
79903
```

Each batch delete has size 100 and each iteration will wait 2 second to avoid causing this error "Too many TicketBulkUpdateJobV3 jobs are currently queued or running. Try again later."
