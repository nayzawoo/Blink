use crate::config::Config;
use crate::db::Db;
use crate::models::{DiskStatus, MemStatus, ProcessStatus, ServiceStatus, StatusSnapshot};
use crate::slack;
use anyhow::Result;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use sysinfo::{Disks, ProcessesToUpdate, System};
use tokio::net::TcpStream;
use tokio::sync::RwLock;
use tokio::time::{interval, sleep, timeout};
use tracing::{debug, warn};

const TOP_PROCESS_COUNT: usize = 3;

#[derive(Debug, Default)]
struct ServiceAlertState {
    /// When the check first went down (cleared on recovery).
    down_since: Option<Instant>,
    /// Already sent the DOWN Slack message for this outage.
    down_notified: bool,
}

pub async fn run_loop(config: Config, db: Arc<Db>, latest: Arc<RwLock<Option<StatusSnapshot>>>) {
    let mut sys = System::new().expect("sysinfo System::new");
    sys.refresh_cpu_all();
    sleep(Duration::from_millis(200)).await;

    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .expect("http client");

    // Longer timeout for Slack posts (separate from health checks).
    let slack_http = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("slack http client");

    let mut tick = interval(config.poll_interval);
    let mut loops: u64 = 0;
    let mut alerts: HashMap<String, ServiceAlertState> = HashMap::new();

    loop {
        tick.tick().await;
        match collect_once(&config, &mut sys, &http).await {
            Ok(snap) => {
                if let Err(err) = db.insert_sample(&snap) {
                    warn!(error = %err, "sqlite insert failed");
                }

                evaluate_slack_alerts(&config, &slack_http, &snap, &mut alerts).await;

                *latest.write().await = Some(snap);

                loops += 1;
                if loops.is_multiple_of(60)
                    && let Err(err) =
                        db.prune_and_rollup(config.sample_retain, config.rollup_retain)
                {
                    warn!(error = %err, "prune/rollup failed");
                }
            }
            Err(err) => warn!(error = %err, "collect failed"),
        }
    }
}

/// After continuous DOWN for `slack_down_secs`, post once; post again on recovery.
async fn evaluate_slack_alerts(
    config: &Config,
    http: &reqwest::Client,
    snap: &StatusSnapshot,
    alerts: &mut HashMap<String, ServiceAlertState>,
) {
    let Some(webhook) = config.slack_webhook_url.as_deref() else {
        return;
    };

    let now = Instant::now();
    let threshold = config.slack_down_secs;

    for svc in &snap.services {
        let state = alerts.entry(svc.name.clone()).or_default();

        if svc.up {
            if state.down_notified {
                let text = format!(
                    "✅ *{}* / `{}` is back UP on `{}`",
                    svc.name,
                    config.agent.as_str(),
                    config.host_name
                );
                slack::post_webhook(http, webhook, &text).await;
            }
            state.down_since = None;
            state.down_notified = false;
            continue;
        }

        // Down
        let since = state.down_since.get_or_insert(now);
        if !state.down_notified && now.duration_since(*since) >= threshold {
            let secs = threshold.as_secs();
            let text = format!(
                "🚨 *ALARM* · `{}` / `{}` DOWN ≥{secs}s on `{}`",
                svc.name,
                config.agent.as_str(),
                config.host_name
            );
            slack::post_webhook(http, webhook, &text).await;
            state.down_notified = true;
        }
    }
}

async fn collect_once(
    config: &Config,
    sys: &mut System,
    http: &reqwest::Client,
) -> Result<StatusSnapshot> {
    sys.refresh_cpu_all();
    sys.refresh_memory();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let cpu_pct = sys.global_cpu_usage();
    let cpu_cores: Vec<f32> = sys.cpus().iter().map(|cpu| cpu.usage()).collect();
    let total = sys.total_memory();
    let used = sys.used_memory();
    let used_pct = if total > 0 {
        (used as f32 * 100.0) / total as f32
    } else {
        0.0
    };

    let disk = read_root_disk();
    let top_processes = top_cpu_processes(sys, TOP_PROCESS_COUNT);

    let mut services = Vec::with_capacity(config.checks.len());
    for check in &config.checks {
        let up = check_target(http, &check.target).await;
        services.push(ServiceStatus {
            name: check.name.clone(),
            up,
        });
    }

    let ok = services.first().map(|s| s.up).unwrap_or(false);

    debug!(
        cpu_pct,
        cores = cpu_cores.len(),
        used_pct,
        disk_pct = disk.used_pct,
        ?services,
        top = top_processes.len(),
        "sample"
    );

    Ok(StatusSnapshot {
        agent: config.agent.as_str().into(),
        host: config.host_name.clone(),
        ok,
        cpu_pct,
        cpu_cores,
        mem: MemStatus {
            used_bytes: used,
            total_bytes: total,
            used_pct,
        },
        disk,
        services,
        top_processes,
        updated_at: Utc::now(),
    })
}

fn top_cpu_processes(sys: &System, limit: usize) -> Vec<ProcessStatus> {
    let mut rows: Vec<ProcessStatus> = sys
        .processes()
        .values()
        .map(|process| {
            let raw = process.name().to_string_lossy();
            let name = raw
                .rsplit('/')
                .next()
                .unwrap_or(raw.as_ref())
                .chars()
                .take(48)
                .collect::<String>();
            ProcessStatus {
                pid: process.pid().as_u32(),
                name,
                cpu_pct: process.cpu_usage(),
            }
        })
        .filter(|p| !p.name.is_empty())
        .collect();

    rows.sort_by(|a, b| b.cpu_pct.total_cmp(&a.cpu_pct));
    rows.truncate(limit);
    rows
}

fn read_root_disk() -> DiskStatus {
    let disks = match Disks::new_with_refreshed_list() {
        Ok(d) => d,
        Err(_) => {
            return DiskStatus {
                used_bytes: 0,
                total_bytes: 0,
                used_pct: 0.0,
            };
        }
    };
    let mut best: Option<(u64, u64)> = None;

    for disk in &disks {
        let mount = disk.mount_point();
        let total = disk.total_space();
        let avail = disk.available_space();
        if total == 0 {
            continue;
        }
        let used = total.saturating_sub(avail);
        // Prefer root filesystem
        if mount == std::path::Path::new("/") {
            best = Some((used, total));
            break;
        }
        // Fallback: largest disk
        match best {
            Some((_, t)) if t >= total => {}
            _ => best = Some((used, total)),
        }
    }

    let (used_bytes, total_bytes) = best.unwrap_or((0, 0));
    let used_pct = if total_bytes > 0 {
        (used_bytes as f32 * 100.0) / total_bytes as f32
    } else {
        0.0
    };

    DiskStatus {
        used_bytes,
        total_bytes,
        used_pct,
    }
}

async fn check_target(http: &reqwest::Client, target: &str) -> bool {
    if target.starts_with("http://") || target.starts_with("https://") {
        match http.get(target).send().await {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    } else {
        matches!(
            timeout(Duration::from_secs(2), TcpStream::connect(target)).await,
            Ok(Ok(_))
        )
    }
}
