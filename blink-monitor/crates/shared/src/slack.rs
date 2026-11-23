use anyhow::{Context, Result};
use reqwest::Client;
use serde_json::json;
use tracing::{info, warn};

/// Fire-and-forget Slack Incoming Webhook post.
pub async fn post_webhook(http: &Client, webhook_url: &str, text: &str) {
    match send(http, webhook_url, text).await {
        Ok(()) => info!(%text, "slack alert sent"),
        Err(err) => warn!(error = %err, "slack alert failed"),
    }
}

async fn send(http: &Client, webhook_url: &str, text: &str) -> Result<()> {
    let resp = http
        .post(webhook_url)
        .json(&json!({ "text": text }))
        .send()
        .await
        .context("slack webhook request")?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        anyhow::bail!("slack webhook HTTP {status}: {body}");
    }
    Ok(())
}
