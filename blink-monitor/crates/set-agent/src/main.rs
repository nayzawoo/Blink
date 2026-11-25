use anyhow::Result;
use blink_monitor_shared::{AgentProfile, AppState, Config, Db, router, run_loop};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                "set_agent=info,blink_monitor_shared=info,tower_http=info".into()
            }),
        )
        .init();

    let config = Config::from_env(AgentProfile::Set)?;
    let db = Arc::new(Db::open(&config.db_path, &config)?);
    let latest = Arc::new(RwLock::new(None));

    {
        let config = config.clone();
        let db = db.clone();
        let latest = latest.clone();
        tokio::spawn(async move {
            run_loop(config, db, latest).await;
        });
    }

    let state = AppState {
        api_key: config.api_key.clone(),
        host_name: config.host_name.clone(),
        db,
        latest,
        web_push: config.web_push.clone(),
    };

    let app = router(state);
    let listener = tokio::net::TcpListener::bind(config.bind).await?;
    info!(%config.bind, host = %config.host_name, "set-agent listening");
    axum::serve(listener, app).await?;
    Ok(())
}
