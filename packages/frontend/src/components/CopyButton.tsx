import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface Props {
  text: string;
  label?: string;
  className?: string;
}

async function copy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label, className }: Props) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    if (await copy(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-label={label ?? '复制'}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {label != null && <span>{copied ? '已复制' : label}</span>}
    </button>
  );
}
