/// v0.4.7 — `@style` macro declarations parser.
///
/// Parses `$reactive`, `$media`, `$when`, `$container`, `$prefers` inside an
/// `@style { }` block. (`$global` is already handled in v0.3.3 — not
/// duplicated here.)
/// Amendment 02: `$reactive(expr)` inside `$global { }` targets `document.documentElement`.
/// RFC-A5-022/023: `$container(name?, query) { css }` and `$prefers(feature) { css }`.
/// RFC-A5-025: `$reactive(() => expr)` function-form amendment (see
/// `strip_reactive_arrow_form` below).

use crate::parser::state_macros::find_brace_close;
use crate::types::{CompileError, StyleMacro};

/// Parse `$macro` declarations from the body of an `@style { }` block.
/// Returns a list of `StyleMacro` declarations.
pub fn parse_style_macros(body: &str) -> Result<Vec<StyleMacro>, CompileError> {
    let mut result = Vec::new();
    let mut i = 0;

    while i < body.len() {
        let nl = body[i..].find('\n').map(|r| i + r).unwrap_or(body.len());
        let line = body[i..nl].trim();

        if let Some(rest) = line.strip_prefix('$') {
            // $reactive name: expr
            if let Some(decl) = rest.strip_prefix("reactive ") {
                let decl = decl.trim();
                let colon = decl.find(':').ok_or_else(|| CompileError {
                    message: format!("$reactive declaration missing ':' — expected '$reactive name: expr', got '$reactive {}'", decl),
                    line: 0,
                    col: 0,
                    code: Some("C410".to_string()),
                    ..Default::default()
                })?;
                let name = decl[..colon].trim().to_string();
                let expr = decl[colon + 1..].trim().to_string();
                result.push(StyleMacro::Reactive { name, expr });
                i = nl + 1;
                continue;
            }

            // $media breakpoint { css }
            if let Some(decl) = rest.strip_prefix("media ") {
                let decl = decl.trim();
                let end = decl
                    .find(|c: char| c == '{')
                    .unwrap_or(decl.len());
                let breakpoint = decl[..end].trim().to_string();
                let open_pos = body[i..].find('{').map(|r| i + r).ok_or_else(|| CompileError {
                    message: "$media block missing '{'".to_string(),
                    line: 0,
                    col: 0,
                    code: Some("C411".to_string()),
                    ..Default::default()
                })?;
                let close_pos = find_brace_close(body, open_pos + 1).ok_or_else(|| CompileError {
                    message: "unclosed '{' in $media block".to_string(),
                    line: 0,
                    col: 0,
                    code: Some("C411".to_string()),
                    ..Default::default()
                })?;
                let css = body[open_pos + 1..close_pos].trim().to_string();
                result.push(StyleMacro::Media { breakpoint, css });
                i = close_pos + 1;
                continue;
            }

            // $when expr { css }
            if let Some(decl) = rest.strip_prefix("when ") {
                let decl = decl.trim();
                let end = decl.find('{').unwrap_or(decl.len());
                let expr = decl[..end].trim().to_string();
                let open_pos = body[i..].find('{').map(|r| i + r).ok_or_else(|| CompileError {
                    message: "$when block missing '{'".to_string(),
                    line: 0,
                    col: 0,
                    code: Some("C412".to_string()),
                    ..Default::default()
                })?;
                let close_pos = find_brace_close(body, open_pos + 1).ok_or_else(|| CompileError {
                    message: "unclosed '{' in $when block".to_string(),
                    line: 0,
                    col: 0,
                    code: Some("C412".to_string()),
                    ..Default::default()
                })?;
                let css = body[open_pos + 1..close_pos].trim().to_string();
                result.push(StyleMacro::When { expr, css });
                i = close_pos + 1;
                continue;
            }

            // $container(name?, query) { css }
            if rest.starts_with("container(") {
                let rel = body[i..].find("container(").ok_or_else(|| CompileError {
                    message: "internal error: '$container(' not found".to_string(),
                    line: 0,
                    col: 0,
                    code: Some("C413".to_string()),
                    ..Default::default()
                })?;
                let args_start = i + rel + "container(".len();
                let close_paren = find_matching_paren(body, args_start);
                let args_str = body[args_start..close_paren].trim();
                let parts = split_top_level_commas(args_str);
                let (name, query) = if parts.len() >= 2 {
                    (
                        Some(parts[0].trim().to_string()),
                        parts[1..].join(",").trim().to_string(),
                    )
                } else {
                    (None, parts.first().map(|s| s.trim().to_string()).unwrap_or_default())
                };
                let open_brace = body[close_paren..].find('{').map(|r| r + close_paren).ok_or_else(|| CompileError {
                    message: "$container block missing '{'".to_string(),
                    line: 0,
                    col: 0,
                    code: Some("C413".to_string()),
                    ..Default::default()
                })?;
                let close_brace = find_brace_close(body, open_brace + 1).ok_or_else(|| CompileError {
                    message: "unclosed '{' in $container block".to_string(),
                    line: 0,
                    col: 0,
                    code: Some("C413".to_string()),
                    ..Default::default()
                })?;
                let css = body[open_brace + 1..close_brace].trim().to_string();
                result.push(StyleMacro::Container { name, query, css });
                i = close_brace + 1;
                continue;
            }

            // $prefers(feature) { css }
            if rest.starts_with("prefers(") {
                let rel = body[i..].find("prefers(").ok_or_else(|| CompileError {
                    message: "internal error: '$prefers(' not found".to_string(),
                    line: 0,
                    col: 0,
                    code: Some("C414".to_string()),
                    ..Default::default()
                })?;
                let args_start = i + rel + "prefers(".len();
                let close_paren = find_matching_paren(body, args_start);
                let feature = body[args_start..close_paren].trim().to_string();
                if prefers_feature_value(&feature).is_none() {
                    return Err(CompileError {
                        message: format!(
                            "unsupported $prefers feature '{}' — supported: reduced-motion, reduced-transparency, reduced-data, contrast, color-scheme; use $media directly for other media features",
                            feature
                        ),
                        line: 0,
                        col: 0,
                        code: Some("C415".to_string()),
                        ..Default::default()
                    });
                }
                let open_brace = body[close_paren..].find('{').map(|r| r + close_paren).ok_or_else(|| CompileError {
                    message: "$prefers block missing '{'".to_string(),
                    line: 0,
                    col: 0,
                    code: Some("C414".to_string()),
                    ..Default::default()
                })?;
                let close_brace = find_brace_close(body, open_brace + 1).ok_or_else(|| CompileError {
                    message: "unclosed '{' in $prefers block".to_string(),
                    line: 0,
                    col: 0,
                    code: Some("C414".to_string()),
                    ..Default::default()
                })?;
                let css = body[open_brace + 1..close_brace].trim().to_string();
                result.push(StyleMacro::Prefers { feature, css });
                i = close_brace + 1;
                continue;
            }
        }

        i = nl + 1;
    }

    Ok(result)
}

/// Split a macro argument list on top-level commas (not nested inside `( )`).
/// Used for `$container(name?, query)`, where `query` itself may contain no
/// parens today but is kept depth-aware for forward compatibility with
/// parenthesized media-feature expressions.
fn split_top_level_commas(s: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut depth: i32 = 0;
    let mut start = 0;
    let bytes = s.as_bytes();
    for (idx, &b) in bytes.iter().enumerate() {
        match b {
            b'(' => depth += 1,
            b')' => depth -= 1,
            b',' if depth == 0 => {
                parts.push(s[start..idx].to_string());
                start = idx + 1;
            }
            _ => {}
        }
    }
    parts.push(s[start..].to_string());
    parts
}

/// `$prefers(feature)` (RFC-A5-023) — `feature` is a bare identifier, not a
/// full media-feature expression, so it maps to the CSS value representing
/// that preference's explicit opt-in state (mirroring how `prefers-reduced-motion:
/// reduce` is the "user asked for this" value, as opposed to the `no-preference`
/// default). Unsupported/ambiguous features are rejected at parse time (C415)
/// rather than guessed — use `$media` directly for anything not listed here.
fn prefers_feature_value(feature: &str) -> Option<&'static str> {
    match feature {
        "reduced-motion" => Some("reduce"),
        "reduced-transparency" => Some("reduce"),
        "reduced-data" => Some("reduce"),
        "contrast" => Some("more"),
        "color-scheme" => Some("dark"),
        _ => None,
    }
}

/// Scan CSS body text for `$reactive(expr)` call patterns (Amendment 02 — global context).
///
/// Returns `(cleaned_css, reactives)` where:
/// - `cleaned_css` replaces each `$reactive(expr)` with `var(--reactive-global-N)`
/// - `reactives` is a list of `(index, expr)` pairs, one per found call
///
/// This is used when the body comes from a `$global { }` block so that the
/// emitter can generate `document.documentElement.style.setProperty(...)` effects.
pub fn extract_global_reactives(body: &str) -> (String, Vec<(usize, String)>) {
    let needle = "$reactive(";
    let mut result = String::new();
    let mut reactives: Vec<(usize, String)> = Vec::new();
    let mut pos = 0;

    while pos < body.len() {
        if let Some(rel) = body[pos..].find(needle) {
            let abs = pos + rel;
            // Append everything before this match verbatim
            result.push_str(&body[pos..abs]);
            // Find the matching closing paren (depth 1 since `(` opens)
            let after_open = abs + needle.len();
            let expr_end = find_matching_paren(body, after_open);
            let raw_expr = body[after_open..expr_end].trim();
            let expr = strip_reactive_arrow_form(raw_expr);
            let idx = reactives.len();
            reactives.push((idx, expr));
            // Replace with CSS custom property reference
            result.push_str(&format!("var(--reactive-global-{})", idx));
            pos = expr_end + 1; // skip the closing ')'
        } else {
            // No more matches — append the rest
            result.push_str(&body[pos..]);
            break;
        }
    }

    (result, reactives)
}

/// `$reactive(() => expr)` (RFC-A5-025) — backward-compatible function-form
/// amendment to `$reactive(expr)`. `effect()` already scopes dependency
/// tracking to whatever signal reads happen synchronously inside its
/// callback, and the emitted effect callback body IS `expr` either way — so
/// unwrapping the concise-body arrow to its inner expression reproduces the
/// exact same tracking behavior while letting authors mark the dependency
/// boundary explicitly. `$reactive(signal)` (no arrow) is returned unchanged.
fn strip_reactive_arrow_form(expr: &str) -> String {
    let trimmed = expr.trim();
    for prefix in ["() =>", "()=>"] {
        if let Some(rest) = trimmed.strip_prefix(prefix) {
            return rest.trim().to_string();
        }
    }
    trimmed.to_string()
}

/// Find the position of the closing `)` that matches the `(` at `open_pos - 1`.
/// `start` is the index of the first character *inside* the parentheses.
/// Returns the index of the `)`.
fn find_matching_paren(s: &str, start: usize) -> usize {
    let mut depth: usize = 1;
    let bytes = s.as_bytes();
    let mut i = start;
    while i < bytes.len() {
        match bytes[i] {
            b'(' => depth += 1,
            b')' => {
                depth -= 1;
                if depth == 0 {
                    return i;
                }
            }
            _ => {}
        }
        i += 1;
    }
    // Unclosed paren — return end of string
    s.len()
}

/// Emit CSS and JS side-effects for style macros.
///
/// Returns `(css_additions, js_effects)` where:
/// - `css_additions` is CSS text to append to the stylesheet.
/// - `js_effects` is JS code to append to the component setup.
pub fn emit_style_macros(macros: &[StyleMacro]) -> (String, String) {
    let mut css_lines: Vec<String> = Vec::new();
    let mut js_lines: Vec<String> = Vec::new();

    for (idx, mac) in macros.iter().enumerate() {
        match mac {
            StyleMacro::Reactive { name, expr } => {
                // CSS variable placeholder
                css_lines.push(format!("--reactive-{}: initial;", name));
                // JS effect to update it
                js_lines.push(format!(
                    "effect(() => {{ el.style.setProperty('--reactive-{}', String({})) }});",
                    name, expr
                ));
            }
            StyleMacro::GlobalReactive { index, expr } => {
                // Amendment 02: target document.documentElement, not component root.
                // CSS: unscoped :root custom property declaration
                css_lines.push(format!(":root {{ --reactive-global-{}: ; }}", index));
                // JS effect targeting the document root element
                js_lines.push(format!(
                    "effect(() => {{ document.documentElement.style.setProperty('--reactive-global-{}', String({})) }});",
                    index, expr
                ));
            }
            StyleMacro::Media { breakpoint, css } => {
                css_lines.push(format!("@media ({}) {{ {} }}", breakpoint, css));
            }
            StyleMacro::When { expr, css } => {
                let n = idx;
                css_lines.push(format!("[data-when-{}] {{ {} }}", n, css));
                js_lines.push(format!(
                    "effect(() => {{ el.dataset.when{} = String(Boolean({})) }});",
                    n, expr
                ));
            }
            StyleMacro::Container { name, query, css } => {
                let header = match name {
                    Some(n) if !n.is_empty() => format!("@container {} ({})", n, query),
                    _ => format!("@container ({})", query),
                };
                css_lines.push(format!("{} {{ {} }}", header, css));
            }
            StyleMacro::Prefers { feature, css } => {
                let value = prefers_feature_value(feature).unwrap_or(feature.as_str());
                css_lines.push(format!(
                    "@media (prefers-{}: {}) {{ {} }}",
                    feature, value, css
                ));
            }
        }
    }

    (css_lines.join("\n"), js_lines.join("\n"))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_reactive_macro() {
        let macros = parse_style_macros("$reactive color: theme.primary").unwrap();
        assert_eq!(macros.len(), 1);
        assert_eq!(
            macros[0],
            StyleMacro::Reactive {
                name: "color".to_string(),
                expr: "theme.primary".to_string()
            }
        );
    }

    #[test]
    fn parse_media_macro() {
        let body = "$media max-width: 600px { color: red }";
        let macros = parse_style_macros(body).unwrap();
        assert_eq!(macros.len(), 1);
        assert_eq!(
            macros[0],
            StyleMacro::Media {
                breakpoint: "max-width: 600px".to_string(),
                css: "color: red".to_string()
            }
        );
    }

    #[test]
    fn parse_when_macro() {
        let body = "$when isActive { color: blue }";
        let macros = parse_style_macros(body).unwrap();
        assert_eq!(macros.len(), 1);
        assert_eq!(
            macros[0],
            StyleMacro::When {
                expr: "isActive".to_string(),
                css: "color: blue".to_string()
            }
        );
    }

    #[test]
    fn emit_reactive() {
        let macros = vec![StyleMacro::Reactive {
            name: "bg".to_string(),
            expr: "theme.bg".to_string(),
        }];
        let (css, js) = emit_style_macros(&macros);
        assert!(css.contains("--reactive-bg"));
        assert!(js.contains("setProperty('--reactive-bg'"));
    }

    #[test]
    fn emit_media() {
        let macros = vec![StyleMacro::Media {
            breakpoint: "max-width: 768px".to_string(),
            css: "font-size: 14px".to_string(),
        }];
        let (css, js) = emit_style_macros(&macros);
        assert!(css.contains("@media (max-width: 768px)"));
        assert!(js.is_empty());
    }

    #[test]
    fn emit_when() {
        let macros = vec![StyleMacro::When {
            expr: "isActive".to_string(),
            css: "opacity: 1".to_string(),
        }];
        let (css, js) = emit_style_macros(&macros);
        assert!(css.contains("data-when-0"));
        assert!(js.contains("isActive"));
    }

    // ─── RFC-A5-022: $container ────────────────────────────────────────────

    #[test]
    fn parse_container_macro_without_name() {
        let body = "$container(inline-size > 400px) { .x {} }";
        let macros = parse_style_macros(body).unwrap();
        assert_eq!(
            macros[0],
            StyleMacro::Container {
                name: None,
                query: "inline-size > 400px".to_string(),
                css: ".x {}".to_string(),
            }
        );
    }

    #[test]
    fn parse_container_macro_with_name() {
        let body = "$container(sidebar, inline-size > 400px) {\n  .label { display: block }\n}";
        let macros = parse_style_macros(body).unwrap();
        assert_eq!(
            macros[0],
            StyleMacro::Container {
                name: Some("sidebar".to_string()),
                query: "inline-size > 400px".to_string(),
                css: ".label { display: block }".to_string(),
            }
        );
    }

    #[test]
    fn emit_container_without_name_matches_conformance_snapshot() {
        let macros = vec![StyleMacro::Container {
            name: None,
            query: "inline-size > 400px".to_string(),
            css: ".x {}".to_string(),
        }];
        let (css, _) = emit_style_macros(&macros);
        assert_eq!(css, "@container (inline-size > 400px) { .x {} }");
    }

    #[test]
    fn emit_container_with_name() {
        let macros = vec![StyleMacro::Container {
            name: Some("sidebar".to_string()),
            query: "inline-size > 400px".to_string(),
            css: ".label { display: block }".to_string(),
        }];
        let (css, _) = emit_style_macros(&macros);
        assert_eq!(css, "@container sidebar (inline-size > 400px) { .label { display: block } }");
    }

    // ─── RFC-A5-023: $prefers ──────────────────────────────────────────────

    #[test]
    fn parse_prefers_macro() {
        let body = "$prefers(reduced-motion) { * { transition: none !important } }";
        let macros = parse_style_macros(body).unwrap();
        assert_eq!(
            macros[0],
            StyleMacro::Prefers {
                feature: "reduced-motion".to_string(),
                css: "* { transition: none !important }".to_string(),
            }
        );
    }

    #[test]
    fn parse_prefers_macro_rejects_unsupported_feature() {
        let body = "$prefers(not-a-real-feature) { color: red }";
        let err = parse_style_macros(body).unwrap_err();
        assert_eq!(err.code.as_deref(), Some("C415"));
    }

    #[test]
    fn emit_prefers_reduced_motion_matches_conformance_snapshot() {
        let macros = vec![StyleMacro::Prefers {
            feature: "reduced-motion".to_string(),
            css: "* { transition: none !important }".to_string(),
        }];
        let (css, _) = emit_style_macros(&macros);
        assert_eq!(
            css,
            "@media (prefers-reduced-motion: reduce) { * { transition: none !important } }"
        );
    }

    // ─── RFC-A5-025: $reactive(() => expr) function-form amendment ─────────

    #[test]
    fn global_reactive_function_form_unwraps_to_same_expr_as_plain_form() {
        let (_, plain) = extract_global_reactives("--x: $reactive(theme().primary);");
        let (_, function_form) = extract_global_reactives("--x: $reactive(() => theme().primary);");
        assert_eq!(plain, vec![(0, "theme().primary".to_string())]);
        assert_eq!(function_form, vec![(0, "theme().primary".to_string())]);
    }

    #[test]
    fn global_reactive_function_form_still_replaces_css_with_var_reference() {
        let (css, _) = extract_global_reactives("--x: $reactive(() => a());");
        assert_eq!(css, "--x: var(--reactive-global-0);");
    }

    #[test]
    fn global_reactive_function_form_effect_only_tracks_callback_reads() {
        // A signal read outside the `$reactive(() => ...)` callback — `b` is
        // never mentioned inside the parens — must not appear in the emitted
        // effect, so mutating it cannot trigger this effect.
        let (_, reactives) = extract_global_reactives("--x: $reactive(() => a());");
        let macros: Vec<StyleMacro> = reactives
            .into_iter()
            .map(|(index, expr)| StyleMacro::GlobalReactive { index, expr })
            .collect();
        let (_, js) = emit_style_macros(&macros);
        assert!(js.contains("a()"));
        assert!(!js.contains("b()"));
    }

    #[test]
    fn global_reactive_plain_signal_form_still_works_unchanged() {
        let (css, reactives) = extract_global_reactives("--x: $reactive(theme.primary);");
        assert_eq!(css, "--x: var(--reactive-global-0);");
        assert_eq!(reactives, vec![(0, "theme.primary".to_string())]);
    }
}
