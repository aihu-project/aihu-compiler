use aihu_compiler::{compile_full, emit, sfc};

/// Bound values on a child component use the compiler-only property channel.
/// This protects callbacks from Arbor's DOM listener shortcut and ordinary
/// props from property-vs-attribute decisions made before element upgrade.
#[test]
fn component_bound_props_use_property_channel() {
    let src = r#"
@state {
  const onSave = () => 'saved'
  const back = () => 'back'
  const label = 'dynamic'
}
@template {
  <child-card onSave={onSave} back={back} label={label} aria-label={label} data-state={label} title="static"></child-card>
  <button onClick={onSave}></button>
}
"#;
    let parsed = sfc::parse(src).unwrap();
    let unit = compile_full(&parsed).unwrap();
    let js = emit(&unit, "x-parent").js;

    for prop in ["onSave", "back", "label"] {
        assert!(
            js.contains(&format!("'__aihu_prop:{prop}':")),
            "component prop `{prop}` must use the property channel, got:\n{js}"
        );
    }
    for attr in ["aria-label", "data-state"] {
        assert!(
            js.contains(&format!("'{attr}':")),
            "component attribute `{attr}` must keep its public attribute name, got:\n{js}"
        );
        assert!(
            !js.contains(&format!("'__aihu_prop:{attr}':")),
            "component attribute `{attr}` must not use the property marker, got:\n{js}"
        );
    }
    assert!(
        js.contains("title: 'static'"),
        "static custom-element attributes remain attributes, got:\n{js}"
    );
    assert!(
        js.contains("onClick: onSave"),
        "native event handlers remain DOM listeners, got:\n{js}"
    );
    assert!(
        !js.contains("'__aihu_prop:onClick'"),
        "native event handlers must not use the component property channel, got:\n{js}"
    );
}

/// A ref on a child custom element is mount-time wiring, so it must stay
/// attached to the component branch rather than being dropped with its attrs.
#[test]
fn child_component_ref_keeps_mount_time_wiring() {
    let src = r#"
@state {
  let childEl: HTMLElement | null = null
}
@template {
  <child-card ref={childEl}></child-card>
}
"#;
    let parsed = sfc::parse(src).unwrap();
    let unit = compile_full(&parsed).unwrap();
    let js = emit(&unit, "x-parent").js;

    assert!(
        js.contains("branch('child-card', undefined, [])"),
        "child element must be emitted, got:\n{js}"
    );
    assert!(
        js.contains("childEl = _el"),
        "child ref must retain its mount-time assignment, got:\n{js}"
    );
}
