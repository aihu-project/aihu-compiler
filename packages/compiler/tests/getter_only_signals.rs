//! aihu-compiler#22 — a getter-only destructure `const [rows] = signal(…)` is a
//! read-only signal. Before the fix `resolve_signals` registered only the
//! two-name form, so every template binding treated `rows` as a plain value:
//! `each` received `[() => (rows)]` (a thunk returning the getter itself, so
//! arbor read the function's arity and rendered no rows), `{rows.length}` read
//! that arity once, and `value={key}` / `when={open}` passed the raw getter.
use aihu_compiler::{compile_full, emit, sfc};

fn compile(src: &str, tag: &str) -> String {
    let parsed = sfc::parse(src).unwrap_or_else(|e| panic!("parse error: {}", e.message));
    let unit =
        compile_full(&parsed).unwrap_or_else(|e| panic!("compile_full error: {}", e.message));
    emit(&unit, tag).js
}

const GETTER_ONLY: &str = r#"@state {
  import { signal } from '@aihu/signals'
  const [rows] = signal<{ key: string; label: string }[]>([{ key: 'a', label: 'A' }])
  const [key] = signal<string>('a')
  const [open] = signal<boolean>(true)
}

@template {
  <main>
    <ul>
      <li each={row of rows} key={row.key}>{row.label}</li>
    </ul>
    <p>{rows.length}</p>
    <input value={key} />
    <section when={open}>shown</section>
  </main>
}"#;

#[test]
fn each_over_getter_only_signal_passes_a_callable_list_source() {
    let js = compile(GETTER_ONLY, "x-getter-only");
    assert!(
        js.contains("each([rows], (row) => row.key"),
        "each must receive the read-only getter tuple:\n{js}"
    );
    assert!(
        !js.contains("[() => (rows)]"),
        "each must not wrap the bare getter in a thunk that returns the function:\n{js}"
    );
}

#[test]
fn text_attr_and_when_bindings_read_the_getter_only_signal_reactively() {
    let js = compile(GETTER_ONLY, "x-getter-only");
    assert!(
        js.contains("leaf([() => (rows() as any).length, () => {}]"),
        "{{rows.length}} must be a reactive read of rows():\n{js}"
    );
    assert!(
        js.contains("value: [key]"),
        "value={{key}} must bind the getter tuple:\n{js}"
    );
    assert!(
        js.contains("when: [open]"),
        "when={{open}} must bind the getter tuple:\n{js}"
    );
}

#[test]
fn two_name_signal_output_is_unchanged() {
    let src = GETTER_ONLY.replace("const [rows] = signal", "const [rows, setRows] = signal");
    let js = compile(&src, "x-two-name");
    assert!(
        js.contains("each([rows, setRows], (row) => row.key"),
        "two-name form keeps its [getter, setter] tuple:\n{js}"
    );
}
