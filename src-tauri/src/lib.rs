use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
struct GraphQLRequest {
    query: String,
    variables: Option<serde_json::Value>,
    #[serde(rename = "operationName", skip_serializing_if = "Option::is_none")]
    operation_name: Option<String>,
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
    url: String,
    headers: HashMap<String, String>,
    cookies: HashMap<String, String>,
    query: String,
    variables: Option<serde_json::Value>,
    operation_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent(concat!("hex-graphql/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;
    let body = GraphQLRequest {
        query,
        variables,
        operation_name,
    };

    let mut request = client.post(&url).json(&body);
    for (key, value) in &headers {
        request = request.header(key, value);
    }
    if let Some(cookie_header) = build_cookie_header(&cookies) {
        request = request.header(reqwest::header::COOKIE, cookie_header);
    }

    let response = request.send().await.map_err(|e| {
        if e.is_builder() {
            format!("Invalid URL: {}", url)
        } else {
            e.to_string()
        }
    })?;
    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| {
        format!(
            "HTTP {} — {}\n\nRESPONSE_BODY\n{}",
            status.as_u16(),
            e,
            text
        )
    })?;
    Ok(json)
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
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![execute_graphql])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
