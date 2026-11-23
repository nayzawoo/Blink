use crate::auth::{ApiKey, ExpectedApiKey};
use crate::db::Db;
use crate::models::{HistoryPoint, StatusSnapshot};
use axum::Router;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, extract::Request};
use chrono::{Duration as ChronoDuration, Utc};
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;

#[derive(Clone)]
pub struct AppState {
    pub api_key: String,
    pub db: Arc<Db>,
    pub latest: Arc<RwLock<Option<StatusSnapshot>>>,
}

pub fn router(state: AppState) -> Router {
    let expected = ExpectedApiKey(state.api_key.clone());

    Router::new()
        .route("/healthz", get(healthz))
        .route("/status", get(status))
        .route("/history", get(history))
        .layer(middleware::from_fn(move |req, next| {
            let expected = expected.clone();
            async move { inject_api_key(expected, req, next).await }
        }))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn inject_api_key(expected: ExpectedApiKey, mut req: Request, next: Next) -> Response {
    req.extensions_mut().insert(expected);
    next.run(req).await
}

async fn healthz() -> impl IntoResponse {
    StatusCode::OK
}

async fn status(
    State(state): State<AppState>,
    _auth: ApiKey,
) -> Result<Json<StatusSnapshot>, StatusCode> {
    let guard = state.latest.read().await;
    match guard.as_ref() {
        Some(snap) => Ok(Json(snap.clone())),
        None => Err(StatusCode::SERVICE_UNAVAILABLE),
    }
}

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    #[serde(default = "default_range")]
    pub range: String,
}

fn default_range() -> String {
    "1h".into()
}

async fn history(
    State(state): State<AppState>,
    _auth: ApiKey,
    Query(_q): Query<HistoryQuery>,
) -> Result<Json<Vec<HistoryPoint>>, StatusCode> {
    let now = Utc::now();
    // Retention is ~1h only; range=2d is accepted but capped to last hour.
    let since = now - ChronoDuration::hours(1);
    let points = state.db.history_samples(since);

    points
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
