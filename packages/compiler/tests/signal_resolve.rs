use aihu_compiler::codegen::signals::resolve_signals;
use insta::assert_debug_snapshot;

#[test]
fn single_signal() {
    assert_debug_snapshot!(resolve_signals("const [count, setCount] = signal(0)"));
}

#[test]
fn multiple_signals() {
    assert_debug_snapshot!(resolve_signals(
        "const [count, setCount] = signal(0)\nconst [name, setName] = signal(\"\")"
    ));
}

#[test]
fn non_signal_var_excluded() {
    assert_debug_snapshot!(resolve_signals("const x = 1\nconst y = foo()"));
}

#[test]
fn mixed_vars_and_signals() {
    assert_debug_snapshot!(resolve_signals(
        "import { signal } from '@aihu/signals'\nconst x = 1\nconst [count, setCount] = signal(0)\nconst increment = () => setCount(c => c + 1)"
    ));
}

#[test]
fn empty_script() {
    assert_debug_snapshot!(resolve_signals(""));
}

#[test]
fn getter_only_destructure_is_read_only() {
    let map = resolve_signals("const [rows] = signal([1, 2])");
    assert!(map.is_reactive("rows"));
    assert!(map.is_computed("rows"));
}

#[test]
fn getter_only_destructure_with_type_param_and_trailing_comma() {
    let map = resolve_signals(
        "const [rows] = signal<{ key: string }[]>([])\nconst [key, ] = signal<string>('b')",
    );
    assert!(map.is_computed("rows"));
    assert!(map.is_computed("key"));
}

#[test]
fn two_name_destructure_still_has_its_setter() {
    let map = resolve_signals("const [rows, setRows] = signal([])\nconst [open] = signal(true)");
    assert_eq!(map.0.get("rows").map(String::as_str), Some("setRows"));
    assert!(!map.is_computed("rows"));
    assert!(map.is_computed("open"));
}

#[test]
fn name_attr_script_meta() {
    assert_debug_snapshot!(resolve_signals(
        "// @name x-counter\nconst [foo, setFoo] = signal(true)"
    ));
}
