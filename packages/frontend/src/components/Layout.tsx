import type { ReactNode } from 'react';
import { Navbar } from './Navbar.js';
import { Footer } from './Footer.js';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
