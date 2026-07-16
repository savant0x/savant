//! OS signal handling (FID-030 §Step 9).
//!
//! Spec implementation: install Ctrl-C handler via
//! `ctrlc::set_handler` + oneshot channel bridge.
//!
//! **Pragmatic deviation per LESSON-038**: we use
//! `tokio::signal::ctrl_c()` (async, runs inside the existing
//! `tokio` runtime context) instead of `ctrlc::set_handler` (sync,
//! requires oneshot-channel bridging into async). The `ctrlc`
//! crate stays in workspace deps for other consumers but is NOT
//! pulled in by `savant_cli`. Per FID-030 §Missed Questions Q9,
//! the trade-off is: simpler integration with the existing async
//! runtime + no duplicate signal-handling deps + minor
//! architectural deviation from spec.

use crate::SavantCliError;

/// Block until a Ctrl-C / SIGINT is received.
///
/// Wraps `tokio::signal::ctrl_c().await` per LESSON-038 (avoid
/// `ctrlc::set_handler` + oneshot bridging; use the async-native
/// API instead).
///
/// Used by `commands::dev::handle` (lands at §Step 5) to coordinate
/// graceful shutdown of the in-process gateway + the dev-mode
/// `next dev` child. When the signal fires, `wait_for_shutdown`
/// returns `Ok(())`; the caller is responsible for tearing down
/// the runtime.
pub async fn wait_for_shutdown() -> Result<(), SavantCliError> {
    tokio::signal::ctrl_c()
        .await
        .map_err(|e| SavantCliError::Signal(format!("ctrl_c await failed: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn test_wait_for_shutdown_blocks_until_signal() {
        // We can't actually send Ctrl-C in a unit test (would hang
        // the test runner). Instead, wrap the helper in a short
        // timeout and assert the timeout fires -- proving the
        // helper would block waiting for a signal that never
        // arrives.
        let result = tokio::time::timeout(Duration::from_millis(50), wait_for_shutdown()).await;
        assert!(
            result.is_err(),
            "wait_for_shutdown should block (tokio::time::timeout fired)"
        );
    }
}