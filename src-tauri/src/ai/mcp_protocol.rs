// MCP (Model Context Protocol) type definitions.
// These types model the JSON-RPC messages used to advertise tools to an LLM
// and to represent tool-call requests / results in the ScribeAI chat flow.

use serde::{Deserialize, Serialize};

/// An MCP tool definition that can be advertised to an LLM.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    /// JSON Schema describing the tool's parameters.
    pub parameters: serde_json::Value,
}

/// A tool call request parsed from an LLM response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolCall {
    pub name: String,
    pub arguments: serde_json::Value,
}

/// The result of executing an MCP tool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolResult {
    pub tool_name: String,
    pub success: bool,
    pub content: String,
}
