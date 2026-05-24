import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

interface Props {
  placeholder?: string;
  initialValue?: string;
  autoFocus?: boolean;
}

export function SearchBox({ placeholder = '搜“翻译”“微信”“写论文”…', initialValue = '', autoFocus }: Props) {
  const [value, setValue] = useState(initialValue);
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form className="search-wrap" onSubmit={onSubmit} role="search">
      <Search className="search-icon" size={18} aria-hidden />
      <input
        className="search-input"
        type="search"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label="搜索插件"
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  );
}
