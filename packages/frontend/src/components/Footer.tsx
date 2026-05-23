export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__links">
          <a href="https://github.com/banxia-O/plugin-marketplace" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span>关于</span>
          <span>联系</span>
        </div>
        <p className="footer__disclaimer">
          本平台采用 AI 自动审核，覆盖基础安全检查（许可证合规、已知漏洞扫描、代码行为分析）。
          审核不构成安全保证，使用插件前请自行评估风险。
        </p>
      </div>
    </footer>
  );
}
