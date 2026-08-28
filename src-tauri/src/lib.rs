use serde::{Deserialize, Serialize};
use std::{collections::HashMap, time::Duration};
use tauri::State;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

struct AppState {
    http_client: reqwest::Client,
}

#[derive(Debug, Serialize, Deserialize)]
struct GraphQLRequest {
    query: String,
    variables: Option<serde_json::Value>,
    #[serde(rename = "operationName", skip_serializing_if = "Option::is_none")]
    operation_name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum GraphQLCommandError {
    InvalidUrl {
        message: String,
    },
    RequestFailed {
        message: String,
    },
    ResponseReadFailed {
        status: u16,
        message: String,
    },
    HttpStatus {
        status: u16,
        body: String,
    },
    InvalidResponseBody {
        status: u16,
        body: String,
        message: String,
    },
}

fn build_http_client() -> Result<reqwest::Client, reqwest::Error> {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .user_agent(concat!("hex-graphql/", env!("CARGO_PKG_VERSION")))
        .build()
}

fn validate_url(url: &str) -> Result<(), GraphQLCommandError> {
    let parsed = reqwest::Url::parse(url).map_err(|error| GraphQLCommandError::InvalidUrl {
        message: error.to_string(),
    })?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(GraphQLCommandError::InvalidUrl {
            message: "URL must use the http or https scheme".to_string(),
        });
    }
    Ok(())
}

fn build_cookie_header(cookies: &HashMap<String, String>) -> Option<String> {
    if cookies.is_empty() {
        return None;
    }
    Some(
        cookies
            .iter()
            .map(|(name, value)| format!("{}={}", name, value))
            .collect::<Vec<_>>()
            .join("; "),
    )
}

#[tauri::command]
async fn execute_graphql(
    state: State<'_, AppState>,
    url: String,
    headers: HashMap<String, String>,
    cookies: HashMap<String, String>,
    query: String,
    variables: Option<serde_json::Value>,
    operation_name: Option<String>,
) -> Result<serde_json::Value, GraphQLCommandError> {
    validate_url(&url)?;
    let body = GraphQLRequest {
        query,
        variables,
        operation_name,
    };

    let mut request = state.http_client.post(&url).json(&body);
    for (key, value) in &headers {
        request = request.header(key, value);
    }
    if let Some(cookie_header) = build_cookie_header(&cookies) {
        request = request.header(reqwest::header::COOKIE, cookie_header);
    }

    let response = request
        .send()
        .await
        .map_err(|error| GraphQLCommandError::RequestFailed {
            message: error.to_string(),
        })?;
    let status = response.status().as_u16();
    let text = response
        .text()
        .await
        .map_err(|error| GraphQLCommandError::ResponseReadFailed {
            status,
            message: error.to_string(),
        })?;

    if !(200..300).contains(&status) {
        return Err(GraphQLCommandError::HttpStatus { status, body: text });
    }

    serde_json::from_str(&text).map_err(|error| GraphQLCommandError::InvalidResponseBody {
        status,
        body: text,
        message: error.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_cookie_header_from_settings() {
        let cookies = HashMap::from([
            ("session".to_string(), "abc123".to_string()),
            ("locale".to_string(), "en-GB".to_string()),
        ]);

        let header = build_cookie_header(&cookies).unwrap();
        let parts = header.split("; ").collect::<Vec<_>>();
        assert_eq!(parts.len(), 2);
        assert!(parts.contains(&"session=abc123"));
        assert!(parts.contains(&"locale=en-GB"));
    }

    #[test]
    fn omits_cookie_header_when_no_cookies_are_configured() {
        assert_eq!(build_cookie_header(&HashMap::new()), None);
    }

    #[test]
    fn rejects_non_http_urls() {
        assert!(matches!(
            validate_url("file:///tmp/schema.json"),
            Err(GraphQLCommandError::InvalidUrl { .. })
        ));
    }

    #[test]
    fn command_errors_serialize_with_structured_details() {
        let error = GraphQLCommandError::HttpStatus {
            status: 502,
            body: "upstream unavailable".to_string(),
        };

        assert_eq!(
            serde_json::to_value(error).unwrap(),
            serde_json::json!({
                "type": "http_status",
                "status": 502,
                "body": "upstream unavailable",
            })
        );
    }

    #[test]
    fn builds_shared_client() {
        assert!(build_http_client().is_ok());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            http_client: build_http_client().expect("failed to build HTTP client"),
        })
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![execute_graphql])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
