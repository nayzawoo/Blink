use chrono::{DateTime, Utc};
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Clone, Debug, Serialize)]
pub struct MemStatus {
    pub used_bytes: u64,
    pub total_bytes: u64,
    pub used_pct: f32,
}

#[derive(Clone, Debug, Serialize)]
pub struct DiskStatus {
    pub used_bytes: u64,
    pub total_bytes: u64,
    pub used_pct: f32,
}

#[derive(Clone, Debug, Serialize)]
pub struct ServiceStatus {
    pub name: String,
    pub up: bool,
}

/// Top CPU consumers (htop-style), for live `/status` only.
#[derive(Clone, Debug, Serialize)]
pub struct ProcessStatus {
    pub pid: u32,
    pub name: String,
    pub cpu_pct: f32,
}

#[derive(Clone, Debug, Serialize)]
pub struct StatusSnapshot {
    pub agent: String,
    pub host: String,
    pub ok: bool,
    pub cpu_pct: f32,
    /// Per-logical-CPU usage (0–100), same order as the OS.
    pub cpu_cores: Vec<f32>,
    pub mem: MemStatus,
    pub disk: DiskStatus,
    pub services: Vec<ServiceStatus>,
    pub top_processes: Vec<ProcessStatus>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
pub struct HistoryPoint {
    pub ts: DateTime<Utc>,
    pub cpu_pct: f32,
    pub mem_used_pct: f32,
    pub disk_used_pct: f32,
    pub services: BTreeMap<String, bool>,
}
