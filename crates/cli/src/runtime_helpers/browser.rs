//! Default-browser launch wrapper (FID-030 §Step 10).
//!
//! Spec implementation: `open_browser(url)` wrapper around
//! `webbrowser::open` with graceful no-browser fallback (per FID-030
//! §Decisions Q5: open-by-default + `--no-browser` opt-out).

use crate::SavantCliError;

/// Open the user's default browser at the given URL.
///
/// Returns `SavantCliError::Browser(_)` on failure (no display
/// available, missing browser binary, etc.). Callers should log +
/// continue (the failure is non-fatal: the URL is printed to stdout
/// so the user can manually open it).
///
/// Cross-platform via `webbrowser` crate v0.8:
/// - Windows: `ShellExecute`
/// - macOS: `open` command
/// - Linux: `xdg-open`
#[allow(dead_code)] // Used at §Step 5 (commands::dev::handle); suppress until then
pub fn open_browser(url: &str) -> Result<(), SavantCliError> {
    webbrowser::open(url).map_err(|e| SavantCliError::Browser(format!("open({url}): {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Browser open is environment-dependent (no display in CI; some
    /// test runners have no default browser configured). Marked
    /// `#[ignore]` so `cargo test` doesn't hang or fail on
    /// environments without a browser. Run explicitly with
    /// `cargo test -- --ignored open_browser`.
    #[test]
    #[ignore = "requires interactive desktop environment with default browser"]
    fn test_open_browser_live() {
        // Use a no-op URL that the browser will load instantly
        // without making external requests.
        open_browser("about:blank").expect("about:blank should always open");
    }
}