pub mod emit;
pub mod mcp_emit;
pub mod mcp_schema;
pub mod sidecar_json;
pub mod sidecar_ts;
pub mod signals;
pub mod ssr_string_emit;
pub mod state_emit;
pub mod template_emit;
pub mod use_registry;

pub use emit::{
    emit, emit_with_css_layer, emit_with_options, validate_css_layer_name, EmitResult, IslandKind,
    DEFAULT_CSS_LAYER_NAME,
};
pub use mcp_emit::has_exposed_agent_members;
pub use signals::{resolve_signals, SignalMap};
