//! Port availability + negotiation (FID-030 §Step 8).
//!
//! Spec implementation: `is_port_available(port) -> bool` via
//! `TcpListener::bind` + `negotiate_port(preferred) -> Result<u16,
//! SavantCliError>` with the +0..+9 fallback chain (per FID-030
//! §Decisions Q7 + §Missed Questions Q13).

use crate::SavantCliError;
use tokio::net::TcpListener;

/// Returns `true` if the port is available on the local loopback
/// interface (binds to `127.0.0.1:port`). Returns `false` if the
/// bind fails (port already bound, permission denied, etc.).
pub async fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).await.is_ok()
}

/// Negotiate a port starting at `preferred`. Tries `preferred + 0`,
/// `+1`, ..., `+9`. Returns the first available port, or
/// `SavantCliError::Port(_)` if all 10 candidates are bound.
///
/// Skips port 0 (kernel-assigned; not bindable explicitly).
pub async fn negotiate_port(preferred: u16) -> Result<u16, SavantCliError> {
    for offset in 0u16..10 {
        let candidate = preferred.saturating_add(offset);
        // Skip port 0 -- it's the kernel-assigned sentinel, not
        // bindable via TcpListener::bind.
        if candidate == 0 {
            continue;
        }
        if is_port_available(candidate).await {
            return Ok(candidate);
        }
    }
    Err(SavantCliError::Port(format!(
        "no port available in range {}-{} (all bound)",
        preferred,
        preferred.saturating_add(9)
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_is_port_available_false_for_bound_port() {
        // Bind a listener on a kernel-assigned port.
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let claimed_port = listener.local_addr().unwrap().port();

        // The port is claimed -- is_port_available must return false.
        assert!(
            !is_port_available(claimed_port).await,
            "is_port_available should return false for claimed port {claimed_port}"
        );

        drop(listener);
    }

    #[tokio::test]
    async fn test_negotiate_port_finds_fallback_after_bound_port() {
        // Claim a port via TcpListener.
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let claimed_port = listener.local_addr().unwrap().port();

        // negotiate_port should skip claimed_port and find claimed_port + 1.
        let negotiated =
            negotiate_port(claimed_port).await.expect("negotiate_port should find a fallback");
        assert_ne!(
            negotiated, claimed_port,
            "negotiate_port must not return the bound port"
        );
        assert!(
            negotiated > claimed_port && negotiated < claimed_port + 10,
            "negotiate_port must return a port in the +0..+9 range, got {negotiated}"
        );

        // The negotiated port must actually be available.
        assert!(
            is_port_available(negotiated).await,
            "negotiate_port returned a port that is not actually available"
        );

        drop(listener);
    }

    #[tokio::test]
    async fn test_negotiate_port_errors_when_all_bound() {
        // Claim 10 adjacent ports in the user-private range
        // (50000-50999 per IANA). negotiate_port starting at the
        // base should fail with SavantCliError::Port.
        let base_port: u16 = 51000;
        let mut listeners = Vec::with_capacity(10);
        for i in 0..10 {
            let listener = TcpListener::bind(("127.0.0.1", base_port + i))
                .await
                .unwrap_or_else(|e| {
                    panic!("failed to bind 127.0.0.1:{}: {e}", base_port + i)
                });
            listeners.push(listener);
        }

        let result = negotiate_port(base_port).await;
        assert!(
            matches!(result, Err(SavantCliError::Port(_))),
            "expected SavantCliError::Port, got {result:?}"
        );

        drop(listeners);
    }
}