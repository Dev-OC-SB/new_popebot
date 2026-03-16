/**
 * Parse Docker container logs from a headless coding agent container.
 * Supports both Claude Code (--output-format stream-json) and Pi coding agent (JSONL sessions).
 *
 * Three layers:
 * 1. Docker multiplexed frame parser (binary)
 * 2. NDJSON line splitter
 * 3. Agent output → chat event mapper (auto-detects format)
 *
 * @param {import('http').IncomingMessage} dockerLogStream - Raw Docker log stream
 * @yields {{ type: string, text?: string, toolCallId?: string, toolName?: string, args?: object, result?: string }}
 */
export async function* parseHeadlessStream(dockerLogStream) {
  let frameBuf = Buffer.alloc(0);
  let lineBuf = '';

  for await (const chunk of dockerLogStream) {
    // Layer 1: Docker multiplexed frame parser
    frameBuf = Buffer.concat([frameBuf, chunk]);

    let decoded = '';
    while (frameBuf.length >= 8) {
      const size = frameBuf.readUInt32BE(4);
      if (frameBuf.length < 8 + size) break; // incomplete frame
      const streamType = frameBuf[0];
      if (streamType === 1) { // stdout only
        decoded += frameBuf.slice(8, 8 + size).toString('utf8');
      }
      frameBuf = frameBuf.slice(8 + size);
    }

    if (!decoded) continue;

    // Layer 2: NDJSON line splitter
    lineBuf += decoded;
    const lines = lineBuf.split('\n');
    lineBuf = lines.pop(); // keep incomplete last piece

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Layer 3: Event mapper
      for (const event of mapLine(trimmed)) {
        yield event;
      }
    }
  }

  // Process any remaining partial line
  if (lineBuf.trim()) {
    for (const event of mapLine(lineBuf.trim())) {
      yield event;
    }
  }
}

/**
 * Map a single line from a coding agent's output to chat events.
 * Auto-detects between Claude Code stream-json and Pi JSONL session format.
 * @param {string} line
 * @returns {Array<object>} Zero or more chat events
 */
export function mapLine(line) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    // Non-JSON lines (NO_CHANGES, MERGE_SUCCESS, AGENT_FAILED, etc.)
    return [{ type: 'text', text: `\n${line}\n` }];
  }

  // Detect Pi session format: entries have { type: "message", message: { role, content } }
  // vs Claude Code format: entries have { type: "assistant"|"user", message: { content } }
  if (parsed.type === 'message' && parsed.message?.role) {
    return mapPiLine(parsed);
  }

  return mapClaudeCodeLine(parsed);
}

/**
 * Map a Pi JSONL session entry to chat events.
 */
function mapPiLine(parsed) {
  const events = [];
  const msg = parsed.message;
  if (!msg) return events;

  if (msg.role === 'assistant' && Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === 'text' && block.text) {
        events.push({ type: 'text', text: block.text });
      } else if (block.type === 'toolCall') {
        events.push({
          type: 'tool-call',
          toolCallId: block.id,
          toolName: block.name,
          args: block.arguments,
        });
      }
    }
  } else if (msg.role === 'toolResult') {
    const resultText = Array.isArray(msg.content)
      ? msg.content.map(b => b.text || '').join('')
      : typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    events.push({
      type: 'tool-result',
      toolCallId: msg.toolCallId,
      result: resultText,
    });
  } else if (msg.role === 'bashExecution') {
    const output = msg.output || '';
    const prefix = msg.exitCode !== 0 ? `[exit ${msg.exitCode}] ` : '';
    events.push({
      type: 'tool-call',
      toolCallId: `bash-${Date.now()}`,
      toolName: 'bash',
      args: { command: msg.command },
    });
    events.push({
      type: 'tool-result',
      toolCallId: `bash-${Date.now()}`,
      result: `${prefix}${output}`,
    });
  }
  // Skip session headers, model_change, compaction, label, session_info, custom entries

  return events;
}

/**
 * Map a Claude Code stream-json line to chat events.
 */
function mapClaudeCodeLine(parsed) {
  const events = [];
  const { type, message, result, tool_use_result } = parsed;

  if (type === 'assistant' && message?.content) {
    for (const block of message.content) {
      if (block.type === 'text' && block.text) {
        events.push({ type: 'text', text: block.text });
      } else if (block.type === 'tool_use') {
        events.push({
          type: 'tool-call',
          toolCallId: block.id,
          toolName: block.name,
          args: block.input,
        });
      }
    }
  } else if (type === 'user' && message?.content) {
    for (const block of message.content) {
      if (block.type === 'tool_result') {
        const resultText = tool_use_result?.stdout ?? (
          typeof block.content === 'string' ? block.content :
          Array.isArray(block.content) ? block.content.map(b => b.text || '').join('') :
          JSON.stringify(block.content)
        );
        events.push({
          type: 'tool-result',
          toolCallId: block.tool_use_id,
          result: resultText,
        });
      }
    }
  } else if (type === 'result' && result) {
    events.push({ type: 'text', text: result, _resultSummary: result });
  }
  // Skip system init messages and other unknown types

  return events;
}
