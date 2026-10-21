//! RFC-A5-001 (issue #58) — `<theme>` scoped theme-provider primitive.
//!
//! Validates that:
//! - `<theme>` is recognized as a core template element (grammar v2 is
//!   prefix-less — naked `<theme>`, not the issue's own retired `<$theme>`
//!   spelling; see `macro_element_retired` in parser/template.rs).
//! - `mode`/`tokens` lower to `createThemeBoundary(modeFn, tokensKey, b)`,
//!   with `mode` always wrapped as a reactive thunk (static enum literal,
//!   bare-expression static value, or a `mode={expr}` binding).
//! - The boundary provides `theme.resolved`/`theme.toggle()` via the same
//!   `provide`/`contextKey` primitives `$context` itself lowers to, and
//!   pulls in `signal`/`computed`/`effect`/`onMount`/`onCleanup`.
//!
//! These tests exercise the full pipeline (`compile_full` + `emit`) and
//! assert structural invariants on the emitted JS, mirroring
//! `route_macros.rs`'s approach for `<router>`/`<outlet>`/`<navigate>`.

use aihu_compiler::{compile_full, emit, sfc};

fn compile(source: &str, tag: &str) -> String {
    let parsed = sfc::parse(source).expect("parse");
    let unit = compile_full(&parsed).expect("compile_full");
    let result = emit(&unit, tag);
    result.js
}

#[test]
fn theme_element_emits_boundary_with_default_mode_and_tokens() {
    let source = r#"@template {
  <theme>
    <slot></slot>
  </theme>
}"#;
    let js = compile(source, "x-theme");
    assert!(
        js.contains("createThemeBoundary(() => ('auto'), null, () => {"),
        "<theme> with no attrs should default mode to 'auto' and tokens to null, got:\n{js}"
    );
}

#[test]
fn theme_element_static_enum_mode_and_tokens_key() {
    let source = r#"@template {
  <theme mode="dark" tokens="brand">
    <slot></slot>
  </theme>
}"#;
    let js = compile(source, "x-theme");
    assert!(
        js.contains("createThemeBoundary(() => ('dark'), 'brand', () => {"),
        "static mode=\"dark\" should lower to a thunk returning the literal, and tokens to a quoted key, got:\n{js}"
    );
}

#[test]
fn theme_element_static_non_enum_mode_is_treated_as_an_expression() {
    // Mirrors `focusTrap`'s `active` handling: a static attribute value that
    // isn't one of the three recognized enum literals ('light'/'dark'/'auto')
    // is treated as a bare expression reference, not the literal string. This
    // is what makes the issue's own `mode="mode"` example (referencing a prop
    // named `mode`, not the four-letter string) do something reasonable.
    let source = r#"@state {
  $prop: { mode: { type: String, default: 'auto' } }
}
@template {
  <theme mode="mode">
    <slot></slot>
  </theme>
}"#;
    let js = compile(source, "x-theme");
    assert!(
        js.contains("createThemeBoundary(() => (mode), null, () => {"),
        "mode=\"mode\" should lower to a thunk over the bare identifier `mode`, got:\n{js}"
    );
}

#[test]
fn theme_element_binding_mode_emits_reactive_thunk() {
    let source = r#"@template {
  <theme mode={userMode}>
    <slot></slot>
  </theme>
}"#;
    let js = compile(source, "x-theme");
    assert!(
        js.contains("createThemeBoundary(() => (userMode), null, () => {"),
        "mode={{userMode}} should wrap the binding expr in a reactive thunk, got:\n{js}"
    );
}

#[test]
fn theme_boundary_provides_resolved_and_toggle_via_context_primitives() {
    let source = r#"@template {
  <theme>
    <slot></slot>
  </theme>
}"#;
    let js = compile(source, "x-theme");
    assert!(
        js.contains("import { provide, contextKey } from '@aihu/context'"),
        "<theme> should import provide/contextKey (not inject — it never consumes), got:\n{js}"
    );
    assert!(
        js.contains("provide(contextKey('theme'), { resolved: resolved.read, toggle })"),
        "<theme> boundary should provide theme.resolved/theme.toggle to descendants, got:\n{js}"
    );
    assert!(
        js.contains("const toggle = () => { override.write(resolved.read() === 'dark' ? 'light' : 'dark'); };"),
        "toggle() should flip the resolved mode, got:\n{js}"
    );
}

#[test]
fn theme_boundary_tracks_prefers_color_scheme_and_sets_custom_properties() {
    let source = r#"@template {
  <theme tokens="brand">
    <slot></slot>
  </theme>
}"#;
    let js = compile(source, "x-theme");
    assert!(
        js.contains("window.matchMedia('(prefers-color-scheme: dark)')"),
        "auto mode should reactively track prefers-color-scheme, got:\n{js}"
    );
    assert!(
        js.contains("globalThis.__aihu_themes && globalThis.__aihu_themes[tokensKey]"),
        "tokens should resolve against the globalThis.__aihu_themes runtime registry, got:\n{js}"
    );
    assert!(
        js.contains("el.style.setProperty("),
        "resolved custom properties should be set on the <theme> host element, got:\n{js}"
    );
}

#[test]
fn theme_boundary_imports_signal_computed_effect_onmount_oncleanup() {
    // No other state/effect/router usage in this SFC — every one of these
    // imports must come from `<theme>` alone, not ride along on an
    // unrelated flag.
    let source = r#"@template {
  <theme>
    <slot></slot>
  </theme>
}"#;
    let js = compile(source, "x-theme");
    assert!(
        js.contains("import { signal, computed, effect } from '@aihu/signals'"),
        "got:\n{js}"
    );
    assert!(
        js.contains("import { defineComponent, defineElement, onMount, onCleanup } from '@aihu/runtime'"),
        "got:\n{js}"
    );
}

#[test]
fn nested_theme_and_outlet_both_emit_their_own_boundary_and_share_router_ns_independence() {
    // `<theme>` must not pull in the `@aihu/router` namespace import — that
    // is strictly a routing-element (`<router>`/`<a>`/`<outlet>`/`<navigate>`)
    // concern, and `<theme>` shares none of their runtime surface.
    let source = r#"@template {
  <theme>
    <slot></slot>
  </theme>
}"#;
    let js = compile(source, "x-theme");
    assert!(
        !js.contains("@aihu/router"),
        "<theme> alone should not pull in the router namespace import, got:\n{js}"
    );
}
