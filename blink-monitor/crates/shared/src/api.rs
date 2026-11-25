use crate::auth::{ApiKey, ExpectedApiKey};
use crate::config::WebPushConfig;
use crate::db::Db;
use crate::models::{
    HistoryPoint, PushPayload, PushPublicKeyResponse, PushSubscriptionRequest,
    PushUnsubscribeRequest, StatusSnapshot,
};
use crate::push;
use axum::Router;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, extract::Request};
use chrono::{Duration as ChronoDuration, Utc};
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;

#[derive(Clone)]
pub struct AppState {
    pub api_key: String,
    pub host_name: String,
    pub db: Arc<Db>,
    pub latest: Arc<RwLock<Option<StatusSnapshot>>>,
    pub web_push: Option<WebPushConfig>,
}

pub fn router(state: AppState) -> Router {
    let expected = ExpectedApiKey(state.api_key.clone());

    Router::new()
        .route("/healthz", get(healthz))
        .route("/status", get(status))
        .route("/history", get(history))
        .route("/push/public-key", get(push_public_key))
        .route("/push/subscribe", post(push_subscribe))
        .route("/push/unsubscribe", post(push_unsubscribe))
        .route("/push/test", post(push_test))
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

async fn push_public_key(
    State(state): State<AppState>,
    _auth: ApiKey,
) -> Result<Json<PushPublicKeyResponse>, StatusCode> {
    let Some(cfg) = state.web_push.as_ref() else {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    };
    Ok(Json(PushPublicKeyResponse {
        public_key: cfg.public_key.clone(),
    }))
}

async fn push_subscribe(
    State(state): State<AppState>,
    _auth: ApiKey,
    Json(sub): Json<PushSubscriptionRequest>,
) -> Result<StatusCode, StatusCode> {
    if state.web_push.is_none() {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    if sub.endpoint.trim().is_empty()
        || sub.keys.p256dh.trim().is_empty()
        || sub.keys.auth.trim().is_empty()
    {
        return Err(StatusCode::BAD_REQUEST);
    }
    state
        .db
        .upsert_push_subscription(&sub)
        .map(|()| StatusCode::CREATED)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn push_unsubscribe(
    State(state): State<AppState>,
    _auth: ApiKey,
    Json(req): Json<PushUnsubscribeRequest>,
) -> Result<StatusCode, StatusCode> {
    if req.endpoint.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    state
        .db
        .delete_push_subscription(&req.endpoint)
        .map(|()| StatusCode::NO_CONTENT)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn push_test(
    State(state): State<AppState>,
    _auth: ApiKey,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let Some(cfg) = state.web_push.as_ref() else {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    };
    let payload = PushPayload {
        title: "Blink Notifications Active".into(),
        body: format!("Push alerts connected to {}", state.host_name),
        url: "/#servers".into(),
        tag: "blink-test".into(),
    };
    let delivered = push::broadcast(&state.db, cfg, &payload).await;
    Ok(Json(serde_json::json!({ "delivered": delivered })))
}
