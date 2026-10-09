export const metadata = { title: 'Rock Pet', description: 'One shared rock. Its needs continue while nobody is looking.' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
