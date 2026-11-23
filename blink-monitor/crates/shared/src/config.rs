use anyhow::{Context, Result, bail};
use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Clone, Copy, Debug)]
pub enum AgentProfile {
    Chat,
    Set,
}

impl AgentProfile {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Chat => "chat-agent",
            Self::Set => "set-agent",
        }
    }
}

#[derive(Clone, Debug)]
pub struct ServiceCheck {
    pub name: String,
    pub target: String,
}

#[derive(Clone, Debug)]
pub struct Config {
    pub agent: AgentProfile,
    pub api_key: String,
    pub bind: SocketAddr,
    pub db_path: PathBuf,
    pub poll_interval: Duration,
    pub host_name: String,
    pub checks: Vec<ServiceCheck>,
    pub sample_retain: Duration,
    pub rollup_retain: Duration,
    /// Slack Incoming Webhook URL (`SLACK_WEBHOOK_URL`). Empty = alerts off.
    pub slack_webhook_url: Option<String>,
    /// How long a check must stay down before Slack fires (default 5s).
    pub slack_down_secs: Duration,
}

impl Config {
    pub fn from_env(agent: AgentProfile) -> Result<Self> {
        let _ = dotenvy::dotenv();

        let api_key = env::var("BLINK_API_KEY").context("BLINK_API_KEY is required")?;
        if api_key.len() < 16 {
            bail!("BLINK_API_KEY must be at least 16 characters");
        }

        let default_bind = match agent {
            AgentProfile::Chat => "127.0.0.1:8790",
            AgentProfile::Set => "127.0.0.1:8788",
        };
        let bind: SocketAddr = env::var("BIND_ADDR")
            .unwrap_or_else(|_| default_bind.into())
            .parse()
            .context("invalid BIND_ADDR")?;

        let default_db = match agent {
            AgentProfile::Chat => "data/chat-agent.db",
            AgentProfile::Set => "data/set-agent.db",
        };
        let db_path = PathBuf::from(env::var("DB_PATH").unwrap_or_else(|_| default_db.into()));

        let poll_secs: u64 = env::var("POLL_INTERVAL_SECS")
            .unwrap_or_else(|_| "1".into())
            .parse()
            .context("invalid POLL_INTERVAL_SECS")?;

        let default_host = match agent {
            AgentProfile::Chat => "chatserver",
            AgentProfile::Set => "mapserver",
        };
        let host_name = env::var("HOST_NAME").unwrap_or_else(|_| default_host.into());

        let checks = match agent {
            AgentProfile::Chat => {
                let chat = env::var("CHAT_CHECK")
                    .context("CHAT_CHECK is required (tcp host:port or http URL)")?;
                let mut checks = vec![ServiceCheck {
                    name: "chat".into(),
                    target: chat,
                }];
                if let Ok(record) = env::var("RECORD_CHECK")
                    && !record.is_empty()
                {
                    checks.push(ServiceCheck {
                        name: "record".into(),
                        target: record,
                    });
                }
                checks
            }
            AgentProfile::Set => {
                let set = env::var("SET_CHECK")
                    .context("SET_CHECK is required (tcp host:port or http URL for PHP set)")?;
                vec![ServiceCheck {
                    name: "set".into(),
                    target: set,
                }]
            }
        };

        let slack_webhook_url = env::var("SLACK_WEBHOOK_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let slack_down_secs: u64 = env::var("SLACK_DOWN_SECS")
            .unwrap_or_else(|_| "5".into())
            .parse()
            .context("invalid SLACK_DOWN_SECS")?;

        Ok(Self {
            agent,
            api_key,
            bind,
            db_path,
            poll_interval: Duration::from_secs(poll_secs.max(1)),
            host_name,
            checks,
            // Keep ~1 hour of samples only (2-day history was too heavy).
            sample_retain: Duration::from_secs(60 * 60),
            rollup_retain: Duration::from_secs(60 * 60),
            slack_webhook_url,
            slack_down_secs: Duration::from_secs(slack_down_secs.max(1)),
        })
    }

    pub fn service_names(&self) -> (String, String) {
        let s1 = self
            .checks
            .first()
            .map(|c| c.name.clone())
            .unwrap_or_else(|| "primary".into());
        let s2 = self
            .checks
            .get(1)
            .map(|c| c.name.clone())
            .unwrap_or_else(|| "secondary".into());
        (s1, s2)
    }
}
