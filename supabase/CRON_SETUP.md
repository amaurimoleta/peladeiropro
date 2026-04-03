# Cron Job Setup for Overdue Fees

This document explains how to set up an automatic daily job that marks pending fees as overdue directly in PostgreSQL using pg_cron.

## 1. Enable pg_cron Extension

1. Go to the Supabase Dashboard for your project.
2. Navigate to **Database > Extensions**.
3. Search for `pg_cron`.
4. Toggle it on to enable the extension.

## 2. Create the Cron Job

Open the **SQL Editor** in the Supabase Dashboard and run the following:

```sql
SELECT cron.schedule(
  'mark-overdue-fees',
  '0 6 * * *',  -- daily at 6 AM UTC
  $$
  UPDATE monthly_fees
  SET status = 'overdue'
  WHERE status = 'pending'
  AND due_date < CURRENT_DATE;
  $$
);
```

This schedules a job named `mark-overdue-fees` that runs every day at 6:00 AM UTC. It updates all rows in `monthly_fees` where `status` is `'pending'` and `due_date` is before today, setting their status to `'overdue'`.

## 3. Verify the Job

To confirm the job was created:

```sql
SELECT * FROM cron.job;
```

## 4. Remove the Job (if needed)

```sql
SELECT cron.unschedule('mark-overdue-fees');
```
