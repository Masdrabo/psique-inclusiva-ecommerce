import { Link, usePage } from "@inertiajs/react";

export default function Navbar({ auth = null, locale = "pt" }) {
  // se não passares props, tenta ler do Inertia (útil em ambos layouts)
  const page = usePage();
  const resolvedAuth = auth ?? page.props.auth ?? null;
  const resolvedLocale = locale ?? page.props.locale ?? "pt";

  const user = resolvedAuth?.user ?? null;
  const role = user?.role ?? null;

  const canSeeCart = !!user; // só autenticado
  const canSeeManager = role === "admin" || role === "manager";
  const canSeeAdmin = role === "admin";

  // helper para manter locale nas rotas que o esperam
  const withLocale = (params = {}) => ({ locale: resolvedLocale, ...params });

  return (
    <header className="w-full border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link
          href={route("home", withLocale())}
          className="font-semibold text-lg"
        >
          MyShop
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-4">
          <Link
            href={route("home", withLocale())}
            className="text-sm hover:underline"
          >
            Home
          </Link>

          <Link
            href={route("shop.index", withLocale())}
            className="text-sm hover:underline"
          >
            Shop
          </Link>

          {canSeeCart && (
            <Link
              href={route("cart.index", withLocale())}
              className="text-sm hover:underline"
            >
              Cart
            </Link>
          )}

          {canSeeManager && (
            <Link
              href={route("manager.dashboard", withLocale())}
              className="text-sm hover:underline"
            >
              Manager
            </Link>
          )}

          {canSeeAdmin && (
            <Link
              href={route("admin.dashboard", withLocale())}
              className="text-sm hover:underline"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {!user ? (
            <>
              <Link
                href={route("login", withLocale())}
                className="text-sm hover:underline"
              >
                Login
              </Link>

              <Link
                href={route("register", withLocale())}
                className="text-sm hover:underline"
              >
                Register
              </Link>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-600">
                {user.name} ({role})
              </span>

              <Link
                href={route("logout", withLocale())}
                method="post"
                as="button"
                className="text-sm hover:underline"
              >
                Logout
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
