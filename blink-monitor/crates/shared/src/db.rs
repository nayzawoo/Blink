use crate::config::Config;
use crate::models::{HistoryPoint, PushKeys, PushSubscriptionRequest, StatusSnapshot};
use anyhow::{Context, Result};
use chrono::{DateTime, TimeZone, Utc};
use rusqlite::{Connection, params};
use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

pub struct Db {
    conn: Mutex<Connection>,
    s1_name: String,
    s2_name: String,
}

impl Db {
    pub fn open(path: &Path, config: &Config) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("create db dir {}", parent.display()))?;
        }

        let conn =
            Connection::open(path).with_context(|| format!("open sqlite {}", path.display()))?;
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;

            CREATE TABLE IF NOT EXISTS samples (
                ts INTEGER NOT NULL PRIMARY KEY,
                cpu_pct REAL NOT NULL,
                mem_used INTEGER NOT NULL,
                mem_total INTEGER NOT NULL,
                disk_used INTEGER NOT NULL DEFAULT 0,
                disk_total INTEGER NOT NULL DEFAULT 0,
                s1_up INTEGER NOT NULL,
                s2_up INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS rollups (
                ts INTEGER NOT NULL PRIMARY KEY,
                cpu_pct REAL NOT NULL,
                mem_used_pct REAL NOT NULL,
                disk_used_pct REAL NOT NULL DEFAULT 0,
                s1_up_pct REAL NOT NULL,
                s2_up_pct REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS push_subscriptions (
                endpoint TEXT NOT NULL PRIMARY KEY,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            ",
        )?;

        // Soft migrations for older DBs
        let _ = conn.execute(
            "ALTER TABLE samples ADD COLUMN disk_used INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE samples ADD COLUMN disk_total INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE rollups ADD COLUMN disk_used_pct REAL NOT NULL DEFAULT 0",
            [],
        );

        let (s1_name, s2_name) = config.service_names();
        Ok(Self {
            conn: Mutex::new(conn),
            s1_name,
            s2_name,
        })
    }

    fn flags_from_snap(snap: &StatusSnapshot) -> (i64, i64) {
        let s1 = snap.services.first().map(|s| s.up).unwrap_or(false) as i64;
        let s2 = snap.services.get(1).map(|s| s.up).unwrap_or(false) as i64;
        (s1, s2)
    }

    pub fn insert_sample(&self, snap: &StatusSnapshot) -> Result<()> {
        let (s1, s2) = Self::flags_from_snap(snap);
        let conn = self.conn.lock().expect("db lock");
        conn.execute(
            "INSERT OR REPLACE INTO samples
             (ts, cpu_pct, mem_used, mem_total, disk_used, disk_total, s1_up, s2_up)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                snap.updated_at.timestamp(),
                snap.cpu_pct,
                snap.mem.used_bytes as i64,
                snap.mem.total_bytes as i64,
                snap.disk.used_bytes as i64,
                snap.disk.total_bytes as i64,
                s1,
                s2,
            ],
        )?;
        Ok(())
    }

    pub fn prune_and_rollup(&self, sample_retain: Duration, rollup_retain: Duration) -> Result<()> {
        let conn = self.conn.lock().expect("db lock");
        let now = Utc::now().timestamp();
        let sample_cut = now - sample_retain.as_secs() as i64;
        let rollup_cut = now - rollup_retain.as_secs() as i64;

        conn.execute_batch(
            "
            INSERT INTO rollups (ts, cpu_pct, mem_used_pct, disk_used_pct, s1_up_pct, s2_up_pct)
            SELECT
              (ts / 60) * 60 AS bucket,
              AVG(cpu_pct),
              AVG(CASE WHEN mem_total > 0 THEN (mem_used * 100.0) / mem_total ELSE 0 END),
              AVG(CASE WHEN disk_total > 0 THEN (disk_used * 100.0) / disk_total ELSE 0 END),
              AVG(s1_up) * 100.0,
              AVG(s2_up) * 100.0
            FROM samples
            WHERE ts >= (strftime('%s','now') - 7200)
            GROUP BY bucket
            ON CONFLICT(ts) DO UPDATE SET
              cpu_pct = excluded.cpu_pct,
              mem_used_pct = excluded.mem_used_pct,
              disk_used_pct = excluded.disk_used_pct,
              s1_up_pct = excluded.s1_up_pct,
              s2_up_pct = excluded.s2_up_pct;
            ",
        )?;

        conn.execute("DELETE FROM samples WHERE ts < ?1", params![sample_cut])?;
        conn.execute("DELETE FROM rollups WHERE ts < ?1", params![rollup_cut])?;
        Ok(())
    }

    fn services_map(&self, s1: bool, s2: bool) -> BTreeMap<String, bool> {
        let mut map = BTreeMap::new();
        map.insert(self.s1_name.clone(), s1);
        if self.s2_name != "secondary" {
            map.insert(self.s2_name.clone(), s2);
        }
        map
    }

    pub fn history_samples(&self, since: DateTime<Utc>) -> Result<Vec<HistoryPoint>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare(
            "SELECT ts, cpu_pct, mem_used, mem_total, disk_used, disk_total, s1_up, s2_up
             FROM samples WHERE ts >= ?1 ORDER BY ts ASC",
        )?;

        let rows = stmt.query_map(params![since.timestamp()], |row| {
            let ts: i64 = row.get(0)?;
            let cpu_pct: f32 = row.get(1)?;
            let mem_used: i64 = row.get(2)?;
            let mem_total: i64 = row.get(3)?;
            let disk_used: i64 = row.get(4)?;
            let disk_total: i64 = row.get(5)?;
            let s1_up: i64 = row.get(6)?;
            let s2_up: i64 = row.get(7)?;
            let mem_used_pct = if mem_total > 0 {
                (mem_used as f32 * 100.0) / mem_total as f32
            } else {
                0.0
            };
            let disk_used_pct = if disk_total > 0 {
                (disk_used as f32 * 100.0) / disk_total as f32
            } else {
                0.0
            };
            Ok((
                ts,
                cpu_pct,
                mem_used_pct,
                disk_used_pct,
                s1_up != 0,
                s2_up != 0,
            ))
        })?;

        let mut out = Vec::new();
        for row in rows {
            let (ts, cpu_pct, mem_used_pct, disk_used_pct, s1, s2) = row?;
            out.push(HistoryPoint {
                ts: Utc.timestamp_opt(ts, 0).single().unwrap_or_else(Utc::now),
                cpu_pct,
                mem_used_pct,
                disk_used_pct,
                services: self.services_map(s1, s2),
            });
        }
        Ok(out)
    }

    pub fn history_rollups(&self, since: DateTime<Utc>) -> Result<Vec<HistoryPoint>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare(
            "SELECT ts, cpu_pct, mem_used_pct, disk_used_pct, s1_up_pct, s2_up_pct
             FROM rollups WHERE ts >= ?1 ORDER BY ts ASC",
        )?;

        let rows = stmt.query_map(params![since.timestamp()], |row| {
            let ts: i64 = row.get(0)?;
            let cpu_pct: f32 = row.get(1)?;
            let mem_used_pct: f32 = row.get(2)?;
            let disk_used_pct: f32 = row.get(3)?;
            let s1_up_pct: f32 = row.get(4)?;
            let s2_up_pct: f32 = row.get(5)?;
            Ok((
                ts,
                cpu_pct,
                mem_used_pct,
                disk_used_pct,
                s1_up_pct >= 50.0,
                s2_up_pct >= 50.0,
            ))
        })?;

        let mut out = Vec::new();
        for row in rows {
            let (ts, cpu_pct, mem_used_pct, disk_used_pct, s1, s2) = row?;
            out.push(HistoryPoint {
                ts: Utc.timestamp_opt(ts, 0).single().unwrap_or_else(Utc::now),
                cpu_pct,
                mem_used_pct,
                disk_used_pct,
                services: self.services_map(s1, s2),
            });
        }
        Ok(out)
    }

    pub fn upsert_push_subscription(&self, sub: &PushSubscriptionRequest) -> Result<()> {
        let conn = self.conn.lock().expect("db lock");
        conn.execute(
            "INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(endpoint) DO UPDATE SET
               p256dh = excluded.p256dh,
               auth = excluded.auth,
               created_at = excluded.created_at",
            params![
                sub.endpoint,
                sub.keys.p256dh,
                sub.keys.auth,
                Utc::now().timestamp(),
            ],
        )?;
        Ok(())
    }

    pub fn delete_push_subscription(&self, endpoint: &str) -> Result<()> {
        let conn = self.conn.lock().expect("db lock");
        conn.execute(
            "DELETE FROM push_subscriptions WHERE endpoint = ?1",
            params![endpoint],
        )?;
        Ok(())
    }

    pub fn list_push_subscriptions(&self) -> Result<Vec<PushSubscriptionRequest>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare(
            "SELECT endpoint, p256dh, auth FROM push_subscriptions ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(PushSubscriptionRequest {
                endpoint: row.get(0)?,
                keys: PushKeys {
                    p256dh: row.get(1)?,
                    auth: row.get(2)?,
                },
            })
        })?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    }
}
