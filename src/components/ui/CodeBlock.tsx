'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}

const TOKEN_PATTERNS: [RegExp, string][] = [
  [/\/\/.*$/gm, 'text-text-muted'],           // single-line comments
  [/\/\*[\s\S]*?\*\//g, 'text-text-muted'],   // multi-line comments
  [/(["'`])(?:(?!\1|\\).|\\.)*\1/g, 'text-brand-400'],  // strings
  [/\b(const|let|var|function|return|if|else|for|while|import|export|from|default|class|new|this|async|await|try|catch|throw|typeof|instanceof)\b/g, 'text-purple-400'],  // keywords
  [/\b(true|false|null|undefined|NaN|Infinity)\b/g, 'text-warning-400'],  // literals
  [/\b(\d+\.?\d*)\b/g, 'text-warning-400'],   // numbers
];

function tokenize(code: string): { text: string; className: string }[] {
  const tokens: { text: string; className: string; start: number; end: number }[] = [];

  for (const [pattern, cls] of TOKEN_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(code)) !== null) {
      tokens.push({
        text: match[0],
        className: cls,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Sort by position, remove overlaps
  tokens.sort((a, b) => a.start - b.start);
  const filtered: typeof tokens = [];
  let lastEnd = 0;
  for (const t of tokens) {
    if (t.start >= lastEnd) {
      filtered.push(t);
      lastEnd = t.end;
    }
  }

  // Build final result with gaps
  const result: { text: string; className: string }[] = [];
  let pos = 0;
  for (const t of filtered) {
    if (t.start > pos) {
      result.push({ text: code.slice(pos, t.start), className: 'text-text-primary' });
    }
    result.push({ text: t.text, className: t.className });
    pos = t.end;
  }
  if (pos < code.length) {
    result.push({ text: code.slice(pos), className: 'text-text-primary' });
  }

  return result;
}

export function CodeBlock({ code, showLineNumbers = true, className = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const lines = code.split('\n');
  const lineNumberWidth = String(lines.length).length;

  return (
    <div className={`relative group rounded-sm border border-white/8 bg-surface-950 overflow-hidden ${className}`}>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-sm bg-surface-800 text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity z-10"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-4 w-4 text-brand-400" /> : <Copy className="h-4 w-4" />}
      </button>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        <code>
          {lines.map((line, i) => {
            const tokens = tokenize(line);
            return (
              <div key={i} className="flex">
                {showLineNumbers && (
                  <span
                    className="select-none text-text-muted mr-4 text-right shrink-0"
                    style={{ width: `${lineNumberWidth}ch` }}
                  >
                    {i + 1}
                  </span>
                )}
                <span>
                  {tokens.map((t, j) => (
                    <span key={j} className={t.className}>{t.text}</span>
                  ))}
                </span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
