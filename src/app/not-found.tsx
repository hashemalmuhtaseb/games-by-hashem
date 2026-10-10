import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-5 text-center">
      <div className="overline">404</div>
      <h1 className="serif mt-4 text-[44px] leading-none text-fg">Nothing here.</h1>
      <p className="mt-4 text-fg-3">The page moved, or the link was mistyped.</p>
      <Link href="/" className="btn-ghost mt-8">
        Back to the library
      </Link>
    </div>
  );
}
