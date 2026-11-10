import React from "react";

/**
 * Renders message text as clean conversational text instead of dumping raw markdown.
 * Handles **bold**, leading "* " / "- " bullets, and ``` code fences without needing
 * a markdown library — just enough to stop asterisks/hashes showing up literally.
 */
export function formatMessageText(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const nodes = [];
  let inCodeBlock = false;
  let codeBuffer = [];

  const renderInline = (line) => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        nodes.push(
          <pre key={`code-${idx}`} style={{
            background: '#09090b', border: '1px solid #27272a', borderRadius: 6,
            padding: '8px 10px', fontSize: 12, overflowX: 'auto', margin: '4px 0',
            fontFamily: 'monospace', whiteSpace: 'pre-wrap',
          }}>{codeBuffer.join('\n')}</pre>
        );
        codeBuffer = [];
      }
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      return;
    }

    if (!trimmed) {
      nodes.push(<div key={`sp-${idx}`} style={{ height: 6 }} />);
      return;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      nodes.push(
        <div key={idx} style={{ display: 'flex', gap: 6, paddingLeft: 2 }}>
          <span style={{ opacity: 0.6 }}>•</span>
          <span>{renderInline(bulletMatch[1])}</span>
        </div>
      );
      return;
    }

    const headerMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (headerMatch) {
      nodes.push(<div key={idx} style={{ fontWeight: 700, marginTop: 2 }}>{renderInline(headerMatch[1])}</div>);
      return;
    }

    nodes.push(<div key={idx}>{renderInline(trimmed)}</div>);
  });

  return nodes;
}
