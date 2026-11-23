use axum::extract::FromRequestParts;
use axum::http::StatusCode;
use axum::http::request::Parts;

pub struct ApiKey;

impl<S> FromRequestParts<S> for ApiKey
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let expected = parts
            .extensions
            .get::<ExpectedApiKey>()
            .map(|k| k.0.as_str())
            .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;

        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let token = header
            .strip_prefix("Bearer ")
            .or_else(|| header.strip_prefix("bearer "))
            .ok_or(StatusCode::UNAUTHORIZED)?;

        if constant_time_eq(token.as_bytes(), expected.as_bytes()) {
            Ok(ApiKey)
        } else {
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

#[derive(Clone)]
pub struct ExpectedApiKey(pub String);

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}
