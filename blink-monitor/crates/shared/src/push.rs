use crate::config::WebPushConfig;
use crate::db::Db;
use crate::models::{PushPayload, PushSubscriptionRequest};
use anyhow::Result;
use tracing::{info, warn};
use web_push::{
    ContentEncoding, HyperWebPushClient, SubscriptionInfo, VapidSignatureBuilder, WebPushClient,
    WebPushError, WebPushMessageBuilder,
};

/// Broadcast a Web Push notification to all stored subscriptions.
/// Expired or revoked endpoints (404/410) are pruned automatically.
pub async fn broadcast(db: &Db, config: &WebPushConfig, payload: &PushPayload) -> usize {
    let subs = match db.list_push_subscriptions() {
        Ok(list) => list,
        Err(err) => {
            warn!(error = %err, "failed to list push subscriptions");
            return 0;
        }
    };

    if subs.is_empty() {
        return 0;
    }

    let body = match serde_json::to_vec(payload) {
        Ok(bytes) => bytes,
        Err(err) => {
            warn!(error = %err, "failed to serialize push payload");
            return 0;
        }
    };

    let client = HyperWebPushClient::new();
    let mut delivered = 0;

    for sub in subs {
        match send_one(&client, config, &sub, &body).await {
            Ok(()) => {
                delivered += 1;
            }
            Err(SendError::Gone) => {
                info!(endpoint = %sub.endpoint, "pruning expired push subscription");
                if let Err(err) = db.delete_push_subscription(&sub.endpoint) {
                    warn!(error = %err, "failed to prune expired push subscription");
                }
            }
            Err(SendError::Other(err)) => {
                warn!(endpoint = %sub.endpoint, error = %err, "web push send failed");
            }
        }
    }

    info!(delivered, title = %payload.title, "web push broadcast finished");
    delivered
}

enum SendError {
    Gone,
    Other(anyhow::Error),
}

async fn send_one(
    client: &HyperWebPushClient,
    config: &WebPushConfig,
    sub: &PushSubscriptionRequest,
    body: &[u8],
) -> Result<(), SendError> {
    let info = SubscriptionInfo::new(&sub.endpoint, &sub.keys.p256dh, &sub.keys.auth);

    let mut sig_builder = VapidSignatureBuilder::from_base64(&config.private_key, &info)
        .map_err(|err| SendError::Other(err.into()))?;
    sig_builder.add_claim("sub", config.subject.as_str());
    let sig = sig_builder
        .build()
        .map_err(|err| SendError::Other(err.into()))?;

    let mut msg_builder = WebPushMessageBuilder::new(&info);
    msg_builder.set_payload(ContentEncoding::Aes128Gcm, body);
    msg_builder.set_vapid_signature(sig);
    let message = msg_builder
        .build()
        .map_err(|err| SendError::Other(err.into()))?;

    client.send(message).await.map_err(|err| match err {
        WebPushError::EndpointNotValid(_) | WebPushError::EndpointNotFound(_) => SendError::Gone,
        other => SendError::Other(other.into()),
    })
}
