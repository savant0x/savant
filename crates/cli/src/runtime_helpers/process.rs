//! Child-process spawn + readiness poll + tree-kill (FID-030
//! §Step 7).
//!
//! Spec implementation: `spawn_npx(args) -> Child`,
//! `wait_for_http(host, port, timeout) -> Result<()>`,
//! `kill_process_tree(child) -> Result<()>` for the dev-mode
//! `next dev` child only (the gateway is in-process via `tokio::spawn`,
//! not a child process).

use crate::SavantCliError;
use std::process::Stdio;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::process::{Child, Command};

/// Spawn `npx` (or any portable binary) with the given arguments,
/// inheriting stdout/stderr so the dashboard's `next dev` output
/// is visible in the same terminal as the CLI's `tracing` output
/// (per FID-030 §Missed Questions Q4).
///
/// `kill_on_drop(true)` is set so the child is killed if the CLI
/// panics before reaching the explicit shutdown handler (per FID-030
/// §Missed Questions Q14).
pub fn spawn_npx(args: &[&str]) -> Result<Child, SavantCliError> {
    let mut cmd = Command::new("npx");
    cmd.args(args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .kill_on_drop(true); // FID-030 §Missed Questions Q14
    cmd.spawn()
        .map_err(|e| SavantCliError::Spawn(format!("npx spawn failed: {e}")))
}

/// Poll the given TCP endpoint until a connection succeeds or
/// `timeout` elapses. Returns `Ok(())` on first successful connect,
/// or `SavantCliError::Spawn(_)` on timeout.
///
/// **Why TCP probe instead of HTTP**: avoids adding `reqwest` (heavy)
/// just for a readiness check. A successful TCP connect is a strong
/// signal that the dashboard's `next dev` server is up; the first
/// HTTP request after that will succeed. Per FID-030 §Step 13 the
/// readiness check is best-effort.
pub async fn wait_for_http(
    host: &str,
    port: u16,
    timeout: Duration,
) -> Result<(), SavantCliError> {
    let start = std::time::Instant::now();
    let poll_interval = Duration::from_millis(250);

    while start.elapsed() < timeout {
        if TcpStream::connect((host, port)).await.is_ok() {
            return Ok(());
        }
        tokio::time::sleep(poll_interval).await;
    }

    Err(SavantCliError::Spawn(format!(
        "wait_for_http timed out after {:?} waiting for {}:{}",
        timeout, host, port
    )))
}

/// Best-effort kill of the child + reap. Uses tokio's portable
/// `Child::kill()` API which translates to SIGKILL on Unix and
/// `TerminateProcess` on Windows.
///
/// **Orphan grandchild caveat**: `kill()` only signals the direct
/// child. On Unix, `npx` typically spawns `node` (the Vite/Next dev
/// server) as a grandchild; that grandchild becomes orphaned and
/// must exit on its own (typically when its stdio handles close).
/// For production-grade process-tree cleanup, a future FID could
/// use `nix::sys::signal::killpg` + `setsid` on spawn. Per FID-030
/// §Missed Questions Q14, the current best-effort is acceptable
/// for the dev-mode workflow; the spec's spec `taskkill /F /T`
/// Windows-only path is the spec's chosen alternative.
pub async fn kill_process_tree(child: &mut Child) -> Result<(), SavantCliError> {
    child
        .kill()
        .await
        .map_err(|e| SavantCliError::Spawn(format!("kill_process_tree: kill failed: {e}")))?;
    child
        .wait()
        .await
        .map_err(|e| SavantCliError::Spawn(format!("kill_process_tree: wait failed: {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;

    #[tokio::test]
    async fn test_wait_for_http_succeeds_when_server_listening() {
        // Bind a listener + accept connections in a background task
        // to simulate a listening HTTP server.
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let accept_task = tokio::spawn(async move {
            loop {
                let _ = listener.accept().await;
            }
        });

        // wait_for_http should succeed within the poll interval.
        let result = wait_for_http("127.0.0.1", port, Duration::from_secs(2)).await;
        assert!(
            result.is_ok(),
            "wait_for_http should succeed when server is listening"
        );

        accept_task.abort();
    }

    #[tokio::test]
    async fn test_wait_for_http_times_out_when_no_server() {
        // Port 1 is privileged (root-only bindable); nothing should
        // be listening on it in a test environment. TcpStream::connect
        // returns ECONNREFUSED immediately. wait_for_http should
        // return Spawn error.
        let result = wait_for_http("127.0.0.1", 1, Duration::from_millis(500)).await;
        assert!(
            matches!(result, Err(SavantCliError::Spawn(_))),
            "expected Spawn variant on timeout, got {result:?}"
        );
    }
}